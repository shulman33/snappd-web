/**
 * Unified API Error Handling System
 *
 * This module provides comprehensive error handling for all API routes,
 * extending the authentication error pattern to screenshots, uploads, storage,
 * and quota management operations.
 *
 * @module lib/api/errors
 */

import { NextRequest, NextResponse } from 'next/server';
import { PostgrestError } from '@supabase/supabase-js';
import { ZodError } from 'zod';
import { AuthErrorCode, AuthError } from '@/lib/auth/errors';
import { logger } from '@/lib/logger';

/**
 * Comprehensive API error codes for all domains
 */
export enum ApiErrorCode {
  // === Auth Errors (re-exported from AuthErrorCode) ===
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_EMAIL = 'INVALID_EMAIL',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  EMAIL_EXISTS = 'EMAIL_EXISTS',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // === Screenshot Errors ===
  SCREENSHOT_NOT_FOUND = 'SCREENSHOT_NOT_FOUND',
  SCREENSHOT_EXPIRED = 'SCREENSHOT_EXPIRED',
  SCREENSHOT_ACCESS_DENIED = 'SCREENSHOT_ACCESS_DENIED',
  SCREENSHOT_INVALID_PASSWORD = 'SCREENSHOT_INVALID_PASSWORD',
  SCREENSHOT_DELETE_FAILED = 'SCREENSHOT_DELETE_FAILED',
  SCREENSHOT_UPDATE_FAILED = 'SCREENSHOT_UPDATE_FAILED',

  // === Upload Errors ===
  UPLOAD_SESSION_NOT_FOUND = 'UPLOAD_SESSION_NOT_FOUND',
  UPLOAD_SESSION_EXPIRED = 'UPLOAD_SESSION_EXPIRED',
  UPLOAD_SESSION_INVALID = 'UPLOAD_SESSION_INVALID',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  UPLOAD_FILE_TOO_LARGE = 'UPLOAD_FILE_TOO_LARGE',
  UPLOAD_INVALID_FILE_TYPE = 'UPLOAD_INVALID_FILE_TYPE',
  UPLOAD_DUPLICATE_DETECTED = 'UPLOAD_DUPLICATE_DETECTED',
  UPLOAD_INCOMPLETE = 'UPLOAD_INCOMPLETE',

  // === Quota & Limits Errors ===
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  STORAGE_LIMIT_EXCEEDED = 'STORAGE_LIMIT_EXCEEDED',
  BANDWIDTH_LIMIT_EXCEEDED = 'BANDWIDTH_LIMIT_EXCEEDED',
  MONTHLY_UPLOAD_LIMIT_EXCEEDED = 'MONTHLY_UPLOAD_LIMIT_EXCEEDED',

  // === Storage Errors ===
  STORAGE_ERROR = 'STORAGE_ERROR',
  STORAGE_BUCKET_NOT_FOUND = 'STORAGE_BUCKET_NOT_FOUND',
  STORAGE_UPLOAD_FAILED = 'STORAGE_UPLOAD_FAILED',
  STORAGE_DELETE_FAILED = 'STORAGE_DELETE_FAILED',
  STORAGE_ACCESS_DENIED = 'STORAGE_ACCESS_DENIED',

  // === Database Errors ===
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
  DATABASE_QUERY_ERROR = 'DATABASE_QUERY_ERROR',

  // === Generic Errors ===
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  FORBIDDEN = 'FORBIDDEN',
  BAD_REQUEST = 'BAD_REQUEST',
  METHOD_NOT_ALLOWED = 'METHOD_NOT_ALLOWED',
}

/**
 * Quota information for limit-related errors
 */
export interface QuotaInfo {
  /** Current usage */
  current: number;
  /** Maximum allowed */
  limit: number;
  /** When the quota resets (ISO timestamp) */
  resetAt?: string;
  /** Unit of measurement (bytes, count, etc.) */
  unit?: string;
}

/**
 * Upgrade prompt information for quota errors
 */
export interface UpgradeInfo {
  /** Message prompting upgrade */
  message: string;
  /** Recommended plan */
  plan: 'pro' | 'team';
  /** URL to upgrade page */
  url: string;
}

/**
 * Individual failure result for bulk operations
 */
export interface BulkFailure {
  /** ID of the failed item */
  id: string;
  /** Error code */
  error: string;
  /** Error message */
  message: string;
}

/**
 * Bulk operation result for partial failures
 */
export interface BulkResult {
  /** Total items requested */
  totalRequested: number;
  /** Number of successful operations */
  successCount: number;
  /** Number of failed operations */
  failedCount: number;
  /** Details of failures */
  failures: BulkFailure[];
}

/**
 * Standardized API error response structure
 */
export interface ApiErrorResponse {
  /** Machine-readable error code */
  error: string;
  /** User-friendly error message */
  message: string;
  /** HTTP status code */
  statusCode: number;

  // Optional contextual fields
  /** Additional error details (dev mode only) */
  details?: unknown;
  /** Field that caused validation error */
  field?: string;
  /** Whether the client can retry this request */
  retryable?: boolean;
  /** Seconds to wait before retry (for rate limits) */
  retryAfter?: number;
  /** Quota information for limit errors */
  quota?: QuotaInfo;
  /** Upgrade prompt for quota errors */
  upgrade?: UpgradeInfo;
  /** Bulk operation results */
  bulkResult?: BulkResult;
}

/**
 * Options for customizing error responses
 */
interface ErrorHandlerOptions {
  /** Include detailed error information (only in development) */
  includeDetails?: boolean;
  /** Additional context to include in error logs */
  logContext?: Record<string, unknown>;
  /** Additional error details (dev mode only) */
  details?: unknown;
  /** Field name for validation errors */
  field?: string;
  /** Whether operation can be retried */
  retryable?: boolean;
  /** Seconds until retry allowed */
  retryAfter?: number;
  /** Quota information */
  quota?: QuotaInfo;
  /** Upgrade information */
  upgrade?: UpgradeInfo;
  /** Bulk operation result */
  bulkResult?: BulkResult;
  /** Next.js request object (for extracting request ID) */
  request?: NextRequest | Request | null;
}

/**
 * Unified API Error Handler
 *
 * Centralized error handling for all API routes including screenshots,
 * uploads, storage, and quota management.
 */
export class ApiErrorHandler {
  /**
   * Main error handler that routes errors to specific handlers
   */
  static handle(
    error: unknown,
    options: ErrorHandlerOptions = {}
  ): NextResponse<ApiErrorResponse> {
    // Log error with request correlation using centralized logger
    logger.error('API error occurred', options.request, {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      ...options.logContext,
    });

    // Postgres/Supabase database errors
    if (this.isPostgrestError(error)) {
      return this.handleDatabaseError(error, options);
    }

    // Validation errors
    if (error instanceof ZodError) {
      return this.handleValidationError(error, options);
    }

    // Custom API errors (thrown by our code)
    if (this.isApiError(error)) {
      return this.handleApiError(error, options);
    }

    // Generic errors
    return this.handleGenericError(error, options);
  }

  // ========== Specific Error Creators ==========

  /**
   * Create a 400 Bad Request error
   */
  static badRequest(
    code: ApiErrorCode,
    message: string,
    details?: unknown,
    request?: NextRequest | Request | null
  ): NextResponse<ApiErrorResponse> {
    logger.warn(`Bad Request: ${message}`, request, { code, details });
    return this.createErrorResponse(code, message, 400, { details });
  }

  /**
   * Create a 401 Unauthorized error
   */
  static unauthorized(
    code: ApiErrorCode = ApiErrorCode.UNAUTHORIZED,
    message: string = 'Authentication required',
    details?: unknown,
    request?: NextRequest | Request | null
  ): NextResponse<ApiErrorResponse> {
    logger.warn(`Unauthorized: ${message}`, request, { code, details });
    return this.createErrorResponse(code, message, 401, { details });
  }

  /**
   * Create a 403 Forbidden error
   */
  static forbidden(
    code: ApiErrorCode,
    message: string,
    details?: unknown,
    request?: NextRequest | Request | null
  ): NextResponse<ApiErrorResponse> {
    logger.warn(`Forbidden: ${message}`, request, { code, details });
    return this.createErrorResponse(code, message, 403, { details });
  }

  /**
   * Create a 404 Not Found error
   */
  static notFound(
    code: ApiErrorCode,
    message: string,
    details?: unknown,
    request?: NextRequest | Request | null
  ): NextResponse<ApiErrorResponse> {
    logger.info(`Not Found: ${message}`, request, { code, details });
    return this.createErrorResponse(code, message, 404, { details });
  }

  /**
   * Create a 409 Conflict error
   */
  static conflict(
    code: ApiErrorCode,
    message: string,
    details?: unknown,
    request?: NextRequest | Request | null
  ): NextResponse<ApiErrorResponse> {
    logger.warn(`Conflict: ${message}`, request, { code, details });
    return this.createErrorResponse(code, message, 409, { details });
  }

  /**
   * Create a 410 Gone error (for expired resources)
   */
  static gone(
    code: ApiErrorCode,
    message: string,
    details?: unknown,
    request?: NextRequest | Request | null
  ): NextResponse<ApiErrorResponse> {
    logger.info(`Resource Gone: ${message}`, request, { code, details });
    return this.createErrorResponse(code, message, 410, { details });
  }

  /**
   * Create a 413 Payload Too Large error
   */
  static payloadTooLarge(
    code: ApiErrorCode,
    message: string,
    quota?: QuotaInfo,
    request?: NextRequest | Request | null
  ): NextResponse<ApiErrorResponse> {
    logger.warn(`Payload Too Large: ${message}`, request, { code, quota });
    return this.createErrorResponse(code, message, 413, { quota });
  }

  /**
   * Create a 422 Unprocessable Entity error
   */
  static unprocessableEntity(
    code: ApiErrorCode,
    message: string,
    field?: string,
    request?: NextRequest | Request | null
  ): NextResponse<ApiErrorResponse> {
    logger.warn(`Unprocessable Entity: ${message}`, request, { code, field });
    return this.createErrorResponse(code, message, 422, { field });
  }

  /**
   * Create a 429 Rate Limit error
   */
  static rateLimitExceeded(
    message: string = 'Too many requests. Please try again later.',
    retryAfter?: number,
    request?: NextRequest | Request | null
  ): NextResponse<ApiErrorResponse> {
    logger.warn(`Rate Limit Exceeded: ${message}`, request, { retryAfter });
    return this.createErrorResponse(
      ApiErrorCode.RATE_LIMIT_EXCEEDED,
      message,
      429,
      { retryAfter, retryable: true }
    );
  }

  /**
   * Create a 500 Internal Server Error
   */
  static internal(
    code: ApiErrorCode = ApiErrorCode.INTERNAL_ERROR,
    message: string = 'An unexpected error occurred',
    details?: unknown,
    request?: NextRequest | Request | null
  ): NextResponse<ApiErrorResponse> {
    logger.error(`Internal Server Error: ${message}`, request, { code, details });
    return this.createErrorResponse(code, message, 500, { details, retryable: true });
  }

  /**
   * Create a quota exceeded error with upgrade prompt
   */
  static quotaExceeded(
    code: ApiErrorCode,
    message: string,
    quota: QuotaInfo,
    upgrade: UpgradeInfo,
    request?: NextRequest | Request | null
  ): NextResponse<ApiErrorResponse> {
    logger.warn(`Quota Exceeded: ${message}`, request, { code, quota, upgrade });
    return this.createErrorResponse(code, message, 403, { quota, upgrade });
  }

  /**
   * Create a bulk operation partial failure response (207 Multi-Status)
   */
  static bulkPartialFailure(
    message: string,
    bulkResult: BulkResult,
    request?: NextRequest | Request | null
  ): NextResponse<ApiErrorResponse> {
    logger.warn(`Bulk Operation Partial Failure: ${message}`, request, { bulkResult });
    return this.createErrorResponse(
      ApiErrorCode.INTERNAL_ERROR,
      message,
      207,
      { bulkResult }
    );
  }

  // ========== Private Helper Methods ==========

  /**
   * Create a standardized error response
   */
  private static createErrorResponse(
    code: ApiErrorCode,
    message: string,
    statusCode: number,
    options: Omit<ErrorHandlerOptions, 'includeDetails' | 'logContext'> = {}
  ): NextResponse<ApiErrorResponse> {
    const isDev = process.env.NODE_ENV !== 'production';

    const response: ApiErrorResponse = {
      error: code,
      message,
      statusCode,
    };

    // Add optional fields if provided
    if (options.details !== undefined && isDev) {
      response.details = options.details;
    }
    if (options.field !== undefined) {
      response.field = options.field;
    }
    if (options.retryable !== undefined) {
      response.retryable = options.retryable;
    }
    if (options.retryAfter !== undefined) {
      response.retryAfter = options.retryAfter;
    }
    if (options.quota !== undefined) {
      response.quota = options.quota;
    }
    if (options.upgrade !== undefined) {
      response.upgrade = options.upgrade;
    }
    if (options.bulkResult !== undefined) {
      response.bulkResult = options.bulkResult;
    }

    return NextResponse.json(response, { status: statusCode });
  }

  /**
   * Handle Postgres/Supabase database errors
   */
  private static handleDatabaseError(
    error: PostgrestError,
    options: ErrorHandlerOptions
  ): NextResponse<ApiErrorResponse> {
    const isDev = process.env.NODE_ENV !== 'production';

    // Map common database error codes
    const code = error.code;

    if (code === '23505') {
      // Unique constraint violation
      return this.conflict(
        ApiErrorCode.DATABASE_ERROR,
        'A record with this information already exists',
        isDev && options.includeDetails ? error.message : undefined
      );
    }

    if (code === '23503') {
      // Foreign key violation
      return this.badRequest(
        ApiErrorCode.DATABASE_ERROR,
        'Referenced resource does not exist',
        isDev && options.includeDetails ? error.message : undefined
      );
    }

    // Generic database error
    return this.internal(
      ApiErrorCode.DATABASE_ERROR,
      'Database operation failed',
      isDev && options.includeDetails ? error.message : undefined
    );
  }

  /**
   * Handle Zod validation errors
   */
  private static handleValidationError(
    error: ZodError,
    options: ErrorHandlerOptions
  ): NextResponse<ApiErrorResponse> {
    const isDev = process.env.NODE_ENV !== 'production';

    // Get first error for field-specific message
    const firstError = error.issues[0];
    const field = firstError?.path.join('.') || undefined;

    // Format all validation errors
    const formattedErrors = error.issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));

    return this.badRequest(
      ApiErrorCode.VALIDATION_ERROR,
      firstError?.message || 'Validation failed. Please check your input.',
      isDev && options.includeDetails ? formattedErrors : undefined
    );
  }

  /**
   * Handle custom API errors thrown by application code
   */
  private static handleApiError(
    error: {
      code: ApiErrorCode;
      message: string;
      status?: number;
      retryAfter?: number;
      retryable?: boolean;
      quota?: QuotaInfo;
      upgrade?: UpgradeInfo;
    },
    _options: ErrorHandlerOptions
  ): NextResponse<ApiErrorResponse> {
    const status = error.status || 500;

    const response: ApiErrorResponse = {
      error: error.code,
      message: error.message,
      statusCode: status,
    };

    if (error.retryAfter !== undefined) {
      response.retryAfter = error.retryAfter;
    }
    if (error.retryable !== undefined) {
      response.retryable = error.retryable;
    }
    if (error.quota !== undefined) {
      response.quota = error.quota;
    }
    if (error.upgrade !== undefined) {
      response.upgrade = error.upgrade;
    }

    return NextResponse.json(response, { status });
  }

  /**
   * Handle generic/unknown errors
   */
  private static handleGenericError(
    error: unknown,
    options: ErrorHandlerOptions
  ): NextResponse<ApiErrorResponse> {
    const isDev = process.env.NODE_ENV !== 'production';

    // Error already logged in handle() method via centralized logger

    return this.internal(
      ApiErrorCode.INTERNAL_ERROR,
      'An unexpected error occurred. Please try again later.',
      isDev && options.includeDetails ? String(error) : undefined,
      options.request
    );
  }

  /**
   * Type guard for Postgrest errors
   */
  private static isPostgrestError(error: unknown): error is PostgrestError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      'details' in error
    );
  }

  /**
   * Type guard to check if error is a custom ApiError
   */
  private static isApiError(
    error: unknown
  ): error is {
    code: ApiErrorCode;
    message: string;
    status?: number;
    retryAfter?: number;
    retryable?: boolean;
    quota?: QuotaInfo;
    upgrade?: UpgradeInfo;
  } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      Object.values(ApiErrorCode).includes((error as { code: ApiErrorCode }).code)
    );
  }
}

/**
 * Helper function to create a standardized API error
 *
 * @example
 * throw createApiError(
 *   ApiErrorCode.SCREENSHOT_NOT_FOUND,
 *   'Screenshot not found',
 *   { status: 404 }
 * );
 */
export function createApiError(
  code: ApiErrorCode,
  message: string,
  options: {
    status?: number;
    retryAfter?: number;
    retryable?: boolean;
    quota?: QuotaInfo;
    upgrade?: UpgradeInfo;
  } = {}
): {
  code: ApiErrorCode;
  message: string;
  status?: number;
  retryAfter?: number;
  retryable?: boolean;
  quota?: QuotaInfo;
  upgrade?: UpgradeInfo;
} {
  return {
    code,
    message,
    ...options,
  };
}

/**
 * Helper to check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (
    typeof error === 'object' &&
    error !== null &&
    'retryable' in error &&
    typeof error.retryable === 'boolean'
  ) {
    return error.retryable;
  }

  // Rate limit errors are always retryable
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === ApiErrorCode.RATE_LIMIT_EXCEEDED
  ) {
    return true;
  }

  return false;
}

/**
 * Helper to get retry timing information
 */
export function getRetryInfo(error: unknown): { retryAfter?: number; retryable: boolean } {
  const retryable = isRetryableError(error);

  if (
    typeof error === 'object' &&
    error !== null &&
    'retryAfter' in error &&
    typeof error.retryAfter === 'number'
  ) {
    return { retryAfter: error.retryAfter, retryable };
  }

  return { retryable };
}

// Re-export auth error types for convenience
export { AuthErrorCode, type AuthError };
