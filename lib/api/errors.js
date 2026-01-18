/**
 * Custom Error Classes for API Routes
 *
 * Provides structured error handling with HTTP status codes.
 * Used with withErrorHandler decorator for consistent error responses.
 */

/**
 * Base API Error
 * All custom API errors should extend this class
 */
export class ApiError extends Error {
  constructor(message, statusCode = 500, code = 'API_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation Error (400)
 * Use when request data fails validation
 */
export class ValidationError extends ApiError {
  constructor(message, code = 'VALIDATION_ERROR') {
    super(message, 400, code);
  }
}

/**
 * Unauthorized Error (401)
 * Use when authentication is required but not provided
 */
export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}

/**
 * Forbidden Error (403)
 * Use when user is authenticated but lacks permissions
 */
export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

/**
 * Not Found Error (404)
 * Use when requested resource doesn't exist
 */
export class NotFoundError extends ApiError {
  constructor(message = 'Not found', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

/**
 * Conflict Error (409)
 * Use when request conflicts with current state (e.g., duplicate)
 */
export class ConflictError extends ApiError {
  constructor(message = 'Conflict', code = 'CONFLICT') {
    super(message, 409, code);
  }
}

/**
 * Rate Limit Error (429)
 * Use when rate limit is exceeded
 */
export class RateLimitError extends ApiError {
  constructor(message = 'Rate limit exceeded', code = 'RATE_LIMIT_EXCEEDED') {
    super(message, 429, code);
  }
}

/**
 * Internal Server Error (500)
 * Use for unexpected server errors
 */
export class InternalServerError extends ApiError {
  constructor(message = 'Internal server error', code = 'INTERNAL_ERROR') {
    super(message, 500, code);
  }
}

/**
 * Service Unavailable Error (503)
 * Use when external service is down
 */
export class ServiceUnavailableError extends ApiError {
  constructor(message = 'Service temporarily unavailable', code = 'SERVICE_UNAVAILABLE') {
    super(message, 503, code);
  }
}
