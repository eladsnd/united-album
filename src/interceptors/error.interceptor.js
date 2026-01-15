import { NextResponse } from 'next/server';
import { AppError } from '../errors/app-error.js';

/**
 * Global error interceptor for API routes
 * Formats errors consistently and logs them
 */
export class ErrorInterceptor {
  /**
   * Handle errors in API routes
   * @param {Error} error - Error to handle
   * @param {Request} request - Next.js request object
   * @returns {NextResponse} Formatted error response
   */
  static handle(error, request) {
    // Log error with context
    const errorLog = {
      level: 'ERROR',
      message: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
    };

    // Log operational errors as warnings, others as errors
    if (error.isOperational) {
      console.warn('[API Error]', JSON.stringify(errorLog));
    } else {
      console.error('[API Error]', JSON.stringify(errorLog));
    }

    // Return formatted response
    if (error instanceof AppError) {
      // Operational error - safe to expose to client
      return NextResponse.json(error.toJSON(), {
        status: error.statusCode,
      });
    }

    // Unknown error - hide details from client
    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * Wrapper function to handle errors in async API route handlers
 * @param {Function} handler - Async route handler function
 * @returns {Function} Wrapped handler with error handling
 */
export function withErrorHandler(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return ErrorInterceptor.handle(error, request);
    }
  };
}
