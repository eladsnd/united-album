/**
 * Uploader ID Utility
 *
 * Generates and manages unique uploader IDs for tracking photo uploads.
 * IDs are stored in localStorage and persist across browser sessions.
 */

import { logger } from './logger';

/**
 * Get or create a unique uploader ID
 *
 * Returns an existing uploader ID from localStorage, or generates a new one
 * if none exists. Format: uploader_{timestamp}_{random}
 *
 * @returns {string|null} The uploader ID, or null if localStorage is unavailable (SSR)
 *
 * @example
 * const uploaderId = getOrCreateUploaderId();
 * if (uploaderId) {
 *   // Use uploaderId for photo upload
 * }
 */
export function getOrCreateUploaderId() {
  // SSR safety check
  if (typeof window === 'undefined') {
    return null;
  }

  // Check if localStorage is available (can fail in private browsing)
  if (!window.localStorage) {
    logger.warn('[uploaderId] localStorage not available');
    return null;
  }

  try {
    // Try to get existing uploader ID
    let uploaderId = localStorage.getItem('uploaderId');

    // Generate new ID if none exists
    if (!uploaderId) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      uploaderId = `uploader_${timestamp}_${random}`;

      // Save to localStorage
      localStorage.setItem('uploaderId', uploaderId);
      logger.debug('[uploaderId] Generated new uploader ID:', uploaderId);
    }

    return uploaderId;
  } catch (error) {
    // Handle localStorage errors (quota exceeded, private browsing, etc.)
    logger.error('[uploaderId] Error accessing localStorage:', error);
    return null;
  }
}

/**
 * Clear the stored uploader ID (useful for testing)
 *
 * @returns {boolean} True if cleared successfully, false otherwise
 */
export function clearUploaderId() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    localStorage.removeItem('uploaderId');
    logger.debug('[uploaderId] Cleared uploader ID');
    return true;
  } catch (error) {
    logger.error('[uploaderId] Error clearing ID:', error);
    return false;
  }
}
