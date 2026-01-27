/**
 * Download Rate Limiting Middleware
 *
 * Prevents bandwidth abuse by limiting:
 * - Concurrent downloads per user
 * - Total downloads per minute
 * - Album size limits
 *
 * Protects against:
 * - Exceeding Cloudinary's 25 GB/month bandwidth limit
 * - Server overload from massive parallel downloads
 * - Abuse from bots/scrapers
 */

import { storageConfig } from '../config/storage';

// In-memory rate limit tracking
const downloadTracking = new Map();

/**
 * Track download for a user
 * @param {string} userId - User identifier (IP or session ID)
 * @returns {object} { allowed: boolean, reason?: string, retryAfter?: number }
 */
function trackDownload(userId) {
  const config = storageConfig.downloads;

  // If rate limiting disabled, always allow
  if (!config.enableRateLimit) {
    return { allowed: true };
  }

  const now = Date.now();
  const userKey = `user:${userId}`;

  // Get or create user tracking
  if (!downloadTracking.has(userKey)) {
    downloadTracking.set(userKey, {
      concurrent: 0,
      downloads: [],
    });
  }

  const tracking = downloadTracking.get(userKey);

  // Check concurrent downloads
  if (tracking.concurrent >= config.maxConcurrent) {
    return {
      allowed: false,
      reason: `Too many concurrent downloads. Max: ${config.maxConcurrent}`,
      retryAfter: 5, // seconds
    };
  }

  // Check downloads per minute
  const oneMinuteAgo = now - 60000;
  tracking.downloads = tracking.downloads.filter((time) => time > oneMinuteAgo);

  if (tracking.downloads.length >= config.maxPerMinute) {
    const oldestDownload = Math.min(...tracking.downloads);
    const retryAfter = Math.ceil((oldestDownload + 60000 - now) / 1000);

    return {
      allowed: false,
      reason: `Rate limit exceeded. Max: ${config.maxPerMinute} downloads/minute`,
      retryAfter,
    };
  }

  // Track this download
  tracking.concurrent++;
  tracking.downloads.push(now);

  return { allowed: true };
}

/**
 * Mark download as complete
 * @param {string} userId - User identifier
 */
function completeDownload(userId) {
  const userKey = `user:${userId}`;
  const tracking = downloadTracking.get(userKey);

  if (tracking && tracking.concurrent > 0) {
    tracking.concurrent--;
  }
}

/**
 * Cleanup old tracking data (run periodically)
 */
function cleanupTracking() {
  const now = Date.now();
  const fiveMinutesAgo = now - 300000;

  for (const [key, tracking] of downloadTracking.entries()) {
    // Remove old downloads
    tracking.downloads = tracking.downloads.filter((time) => time > fiveMinutesAgo);

    // Remove users with no recent activity
    if (tracking.concurrent === 0 && tracking.downloads.length === 0) {
      downloadTracking.delete(key);
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupTracking, 300000);

/**
 * Rate limiting middleware for download endpoints
 */
export async function downloadRateLimitMiddleware(request) {
  const config = storageConfig.downloads;

  // If disabled, allow all
  if (!config.enableRateLimit) {
    return null; // No error
  }

  // Get user identifier (IP address or session ID)
  const userId = getUserId(request);

  // Check rate limit
  const result = trackDownload(userId);

  if (!result.allowed) {
    return {
      error: result.reason,
      retryAfter: result.retryAfter,
      statusCode: 429, // Too Many Requests
    };
  }

  return null; // Allowed
}

/**
 * Get user identifier from request
 */
function getUserId(request) {
  // Try to get from session/cookie first
  const cookies = request.headers.get('cookie') || '';
  const sessionMatch = cookies.match(/uploaderId=([^;]+)/);
  if (sessionMatch) {
    return sessionMatch[1];
  }

  // Fallback to IP address
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Last resort: random ID (not ideal but prevents global lockout)
  return `anonymous-${Math.random().toString(36).substring(7)}`;
}

/**
 * Wrapper for download operations with automatic cleanup
 */
export async function withDownloadRateLimit(request, downloadFn) {
  // Check rate limit
  const limitError = await downloadRateLimitMiddleware(request);
  if (limitError) {
    return {
      error: true,
      message: limitError.error,
      retryAfter: limitError.retryAfter,
      statusCode: limitError.statusCode,
    };
  }

  const userId = getUserId(request);

  try {
    // Execute download
    const result = await downloadFn();
    return result;
  } catch (error) {
    throw error;
  } finally {
    // Always mark download as complete
    completeDownload(userId);
  }
}

/**
 * Check if album size is within limits
 */
export function validateAlbumSize(photoCount) {
  const config = storageConfig.downloads;

  if (photoCount > config.maxAlbumSize) {
    return {
      valid: false,
      error: `Album too large. Max: ${config.maxAlbumSize} photos. Use batching instead.`,
    };
  }

  return { valid: true };
}

/**
 * Calculate recommended batch size for album
 */
export function calculateBatchSize(totalPhotos) {
  const config = storageConfig.downloads;

  if (!config.enableBatching || totalPhotos <= config.batchSize) {
    return {
      batches: 1,
      batchSize: totalPhotos,
      recommendBatching: false,
    };
  }

  const batches = Math.ceil(totalPhotos / config.batchSize);

  return {
    batches,
    batchSize: config.batchSize,
    recommendBatching: true,
  };
}

export { completeDownload, trackDownload };
