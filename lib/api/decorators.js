/**
 * API Route Decorators (Decorator Pattern)
 *
 * Composable middleware decorators for Next.js API routes.
 * Eliminates 90% of API route boilerplate by extracting common concerns:
 * - Error handling
 * - Rate limiting
 * - Admin authentication
 *
 * Based on the Decorator pattern from refactoring.guru.
 *
 * Usage:
 *   export const POST = withApi(handleUpload, { rateLimit: 'upload' });
 */

import { NextResponse } from 'next/server';
import { applyRateLimit } from '../rateLimit';
import { isAdminAuthenticated } from '../adminAuth';

/**
 * Error Handling Decorator
 *
 * Wraps handler with try-catch to provide consistent error responses.
 * Handles custom ApiError instances with statusCode and generic errors.
 *
 * Eliminates 14+ duplicate try-catch blocks across API routes.
 *
 * @param {Function} handler - Async API route handler
 * @returns {Function} Decorated handler with error handling
 *
 * @example
 * ```javascript
 * const handler = async (request) => {
 *   throw new ValidationError('Invalid input');
 * };
 *
 * export const POST = withErrorHandler(handler);
 * // Returns: { error: 'Invalid input', code: 'VALIDATION_ERROR' } with status 400
 * ```
 */
export function withErrorHandler(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error('[API Error]', error);

      // Handle custom error types with statusCode
      if (error.statusCode) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.statusCode }
        );
      }

      // Handle generic errors as 500
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Rate Limiting Decorator
 *
 * Checks rate limit before allowing handler execution.
 * Blocks requests that exceed configured limits.
 *
 * Eliminates 6 duplicate rate limit checks across API routes.
 *
 * @param {Function} handler - Async API route handler
 * @param {string} limitType - Type of rate limit ('api', 'upload', 'admin')
 * @returns {Function} Decorated handler with rate limiting
 *
 * @example
 * ```javascript
 * const handler = async (request) => { ... };
 *
 * export const POST = withRateLimit(handler, 'upload');
 * // Applies upload-specific rate limit (e.g., 10 requests/minute)
 * ```
 */
export function withRateLimit(handler, limitType = 'api') {
  return async (request, context) => {
    const rateLimitResult = applyRateLimit(request, limitType);

    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    return handler(request, context);
  };
}

/**
 * Admin Authentication Decorator
 *
 * Verifies admin authentication before allowing handler execution.
 * Returns 401 if authentication fails.
 *
 * Eliminates 4 duplicate admin checks across API routes.
 *
 * @param {Function} handler - Async API route handler
 * @returns {Function} Decorated handler with admin auth check
 *
 * @example
 * ```javascript
 * const handler = async (request) => {
 *   // Only accessible to authenticated admins
 *   return NextResponse.json({ data: 'sensitive' });
 * };
 *
 * export const POST = withAdminAuth(handler);
 * ```
 */
export function withAdminAuth(handler) {
  return async (request, context) => {
    if (!isAdminAuthenticated(request)) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin authentication required.' },
        { status: 401 }
      );
    }

    return handler(request, context);
  };
}

/**
 * Composable API Decorator
 *
 * Combines multiple decorators in a single function call.
 * Applies decorators in order: rate limit → admin auth → error handling
 *
 * This is the recommended way to decorate API routes.
 *
 * @param {Function} handler - Async API route handler
 * @param {Object} options - Decorator options
 * @param {string} [options.rateLimit] - Rate limit type ('api', 'upload', 'admin')
 * @param {boolean} [options.adminOnly] - Require admin authentication
 * @returns {Function} Fully decorated handler
 *
 * @example
 * ```javascript
 * // Simple API with just error handling
 * export const GET = withApi(async (request) => {
 *   const data = await fetchData();
 *   return NextResponse.json(data);
 * });
 *
 * // Upload API with rate limiting
 * export const POST = withApi(handleUpload, { rateLimit: 'upload' });
 *
 * // Admin-only API with rate limiting
 * export const DELETE = withApi(handleDelete, {
 *   rateLimit: 'admin',
 *   adminOnly: true,
 * });
 * ```
 *
 * **Transformation Example**:
 *
 * BEFORE (97 lines with duplication):
 * ```javascript
 * export async function POST(request) {
 *   const rateLimitResult = applyRateLimit(request, 'upload');
 *   if (!rateLimitResult.allowed) {
 *     return rateLimitResult.response;
 *   }
 *
 *   try {
 *     const formData = await request.formData();
 *     // ... 70 lines of logic
 *   } catch (error) {
 *     console.error('[Upload API] Error:', error);
 *     return NextResponse.json({ error: error.message }, { status: 500 });
 *   }
 * }
 * ```
 *
 * AFTER (30 lines, clean separation):
 * ```javascript
 * async function handleUpload(request) {
 *   const formData = await request.formData();
 *   const uploadService = new UploadService();
 *   const result = await uploadService.processUpload(formData);
 *   return NextResponse.json({ success: true, ...result });
 * }
 *
 * export const POST = withApi(handleUpload, { rateLimit: 'upload' });
 * ```
 */
export function withApi(handler, options = {}) {
  let decorated = handler;

  // Apply rate limiting if specified
  if (options.rateLimit) {
    decorated = withRateLimit(decorated, options.rateLimit);
  }

  // Apply admin auth if specified
  if (options.adminOnly) {
    decorated = withAdminAuth(decorated);
  }

  // Always apply error handling last (outermost decorator)
  decorated = withErrorHandler(decorated);

  return decorated;
}
