/**
 * Logging interceptor for API routes
 * Logs request/response information in structured format
 */
export class LoggingInterceptor {
  /**
   * Log request information
   * @param {Request} request - Next.js request object
   */
  static logRequest(request) {
    const log = {
      level: 'INFO',
      type: 'REQUEST',
      method: request.method,
      url: request.url,
      headers: this.sanitizeHeaders(request.headers),
      timestamp: new Date().toISOString(),
    };

    console.log(JSON.stringify(log));
  }

  /**
   * Log response information
   * @param {Request} request - Next.js request object
   * @param {NextResponse} response - Next.js response object
   * @param {number} duration - Request duration in ms
   */
  static logResponse(request, response, duration) {
    const log = {
      level: 'INFO',
      type: 'RESPONSE',
      method: request.method,
      url: request.url,
      status: response.status,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    };

    console.log(JSON.stringify(log));
  }

  /**
   * Sanitize headers (remove sensitive data)
   * @private
   * @param {Headers} headers - Request headers
   * @returns {Object} Sanitized headers
   */
  static sanitizeHeaders(headers) {
    const sanitized = {};
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

    for (const [key, value] of headers.entries()) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

/**
 * Wrapper function to add logging to API route handlers
 * @param {Function} handler - Route handler function
 * @returns {Function} Wrapped handler with logging
 */
export function withLogging(handler) {
  return async (request, context) => {
    const startTime = Date.now();

    // Log request
    LoggingInterceptor.logRequest(request);

    // Execute handler
    const response = await handler(request, context);

    // Log response
    const duration = Date.now() - startTime;
    LoggingInterceptor.logResponse(request, response, duration);

    return response;
  };
}
