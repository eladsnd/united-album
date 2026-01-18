/**
 * Simple in-memory rate limiting for API endpoints
 * Prevents abuse by limiting requests per IP address
 */

const rateLimitMap = new Map();

/**
 * Rate limit configuration
 */
const RATE_LIMITS = {
    upload: {
        maxRequests: 10,
        windowMs: 60 * 1000, // 1 minute
        message: 'Too many uploads. Please wait a minute before uploading again.'
    },
    api: {
        maxRequests: 100,
        windowMs: 60 * 1000, // 1 minute
        message: 'Too many requests. Please slow down.'
    },
    auth: {
        maxRequests: 5,
        windowMs: 60 * 1000, // 1 minute
        message: 'Too many login attempts. Please wait a minute before trying again.'
    },
    delete: {
        maxRequests: 10,
        windowMs: 60 * 1000, // 1 minute
        message: 'Too many delete requests. Please slow down.'
    },
    download: {
        maxRequests: 20,
        windowMs: 60 * 1000, // 1 minute
        message: 'Too many download requests. Please wait a minute.'
    },
    downloadAlbum: {
        maxRequests: 3,
        windowMs: 60 * 60 * 1000, // 1 hour
        message: 'Album download limit reached. Please try again in an hour.'
    }
};

/**
 * Get client IP address from request
 */
function getClientIp(request) {
    // Try to get IP from various headers (proxy-aware)
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const cfConnectingIp = request.headers.get('cf-connecting-ip');

    if (forwarded) {
        // x-forwarded-for may contain multiple IPs, take the first
        return forwarded.split(',')[0].trim();
    }

    if (realIp) return realIp;
    if (cfConnectingIp) return cfConnectingIp;

    return 'unknown';
}

/**
 * Clean up old entries from rate limit map
 */
function cleanupRateLimitMap() {
    const now = Date.now();
    for (const [key, data] of rateLimitMap.entries()) {
        if (now - data.resetTime > 60000) { // Older than 1 minute
            rateLimitMap.delete(key);
        }
    }
}

// Cleanup every 5 minutes
setInterval(cleanupRateLimitMap, 5 * 60 * 1000);

/**
 * Rate limit middleware for Next.js API routes
 * @param {Request} request - Next.js request object
 * @param {string} limitType - Type of limit (upload, api)
 * @returns {Object} - { allowed: boolean, remaining: number, resetTime: number }
 */
export function checkRateLimit(request, limitType = 'api') {
    const limit = RATE_LIMITS[limitType];
    if (!limit) {
        throw new Error(`Unknown rate limit type: ${limitType}`);
    }

    const clientIp = getClientIp(request);
    const key = `${limitType}:${clientIp}`;
    const now = Date.now();

    let limitData = rateLimitMap.get(key);

    // Initialize or reset if window expired
    if (!limitData || now - limitData.resetTime > limit.windowMs) {
        limitData = {
            count: 0,
            resetTime: now + limit.windowMs
        };
        rateLimitMap.set(key, limitData);
    }

    // Increment request count
    limitData.count++;

    const allowed = limitData.count <= limit.maxRequests;
    const remaining = Math.max(0, limit.maxRequests - limitData.count);

    return {
        allowed,
        remaining,
        resetTime: limitData.resetTime,
        limit: limit.maxRequests,
        message: limit.message
    };
}

/**
 * Create rate limit response headers
 */
export function getRateLimitHeaders(limitResult) {
    return {
        'X-RateLimit-Limit': limitResult.limit.toString(),
        'X-RateLimit-Remaining': limitResult.remaining.toString(),
        'X-RateLimit-Reset': new Date(limitResult.resetTime).toISOString()
    };
}

/**
 * Helper to apply rate limiting to an API route
 * @example
 * export async function POST(request) {
 *   const rateLimitResult = await applyRateLimit(request, 'upload');
 *   if (!rateLimitResult.allowed) {
 *     return rateLimitResult.response;
 *   }
 *   // ... handle request
 * }
 */
export function applyRateLimit(request, limitType = 'api') {
    const result = checkRateLimit(request, limitType);

    if (!result.allowed) {
        const headers = getRateLimitHeaders(result);
        return {
            allowed: false,
            response: new Response(
                JSON.stringify({
                    error: result.message,
                    retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
                }),
                {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
                        ...headers
                    }
                }
            )
        };
    }

    return {
        allowed: true,
        headers: getRateLimitHeaders(result)
    };
}
