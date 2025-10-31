/**
 * Custom error classes for API error handling
 * Provides standardized error responses with proper HTTP status codes
 */

/**
 * Base API error class
 * All custom errors extend this
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON response
   */
  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

/**
 * 400 Bad Request - Invalid input/validation error
 */
export class ValidationError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/**
 * 401 Unauthorized - Missing or invalid authentication
 */
export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/**
 * 403 Forbidden - User lacks permission for resource
 */
export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * 404 Not Found - Resource does not exist
 */
export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

/**
 * 410 Gone - Resource has expired or been permanently deleted
 */
export class GoneError extends ApiError {
  constructor(message: string) {
    super(message, 410, 'RESOURCE_GONE');
  }
}

/**
 * 413 Payload Too Large - File/request exceeds size limit
 */
export class PayloadTooLargeError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 413, 'PAYLOAD_TOO_LARGE', details);
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends ApiError {
  constructor(retryAfter?: number) {
    super('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED', {
      ...(retryAfter && { retry_after: retryAfter }),
    });
  }
}

/**
 * 500 Internal Server Error - Unexpected error
 */
export class InternalServerError extends ApiError {
  constructor(message = 'Internal server error') {
    super(message, 500, 'INTERNAL_SERVER_ERROR');
  }
}

/**
 * Error response handler for API routes
 * Converts errors to standardized JSON responses
 * 
 * @param error - Error to handle
 * @returns Response object with error details
 * 
 * @example
 * try {
 *   // ... API logic
 * } catch (error) {
 *   return handleApiError(error);
 * }
 */
export const handleApiError = (error: unknown): Response => {
  console.error('API Error:', error);

  if (error instanceof ApiError) {
    return new Response(JSON.stringify(error.toJSON()), {
      status: error.statusCode,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Unknown error - hide details in production
  const message =
    process.env.NODE_ENV === 'development'
      ? error instanceof Error
        ? error.message
        : 'Unknown error'
      : 'Internal server error';

  return new Response(
    JSON.stringify({
      error: {
        message,
        code: 'INTERNAL_SERVER_ERROR',
      },
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};

