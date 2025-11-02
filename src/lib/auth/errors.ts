/**
 * Authentication Error Types and Handlers
 *
 * This module provides structured error handling for authentication operations,
 * including type-safe error codes, user-friendly messages, and consistent error
 * response formatting for API routes.
 *
 * @module lib/auth/errors
 */

import { NextResponse } from 'next/server';
import { AuthApiError } from '@supabase/supabase-js';
import { ZodError } from 'zod';

/**
 * Standard authentication error codes used throughout the application
 */
export enum AuthErrorCode {
  // Authentication errors
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  IP_BLOCKED = 'IP_BLOCKED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  UNAUTHORIZED = 'UNAUTHORIZED',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_EMAIL = 'INVALID_EMAIL',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  PASSWORDS_MISMATCH = 'PASSWORDS_MISMATCH',

  // Registration errors
  EMAIL_EXISTS = 'EMAIL_EXISTS',
  SIGNUP_DISABLED = 'SIGNUP_DISABLED',
  PROFILE_CREATION_FAILED = 'PROFILE_CREATION_FAILED',

  // Token errors
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_ALREADY_USED = 'TOKEN_ALREADY_USED',

  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  // OAuth errors
  OAUTH_PROVIDER_ERROR = 'OAUTH_PROVIDER_ERROR',
  OAUTH_CALLBACK_ERROR = 'OAUTH_CALLBACK_ERROR',
  OAUTH_STATE_MISMATCH = 'OAUTH_STATE_MISMATCH',
  PROVIDER_ALREADY_LINKED = 'PROVIDER_ALREADY_LINKED',
  CANNOT_REMOVE_LAST_AUTH_METHOD = 'CANNOT_REMOVE_LAST_AUTH_METHOD',

  // Email delivery
  EMAIL_DELIVERY_FAILED = 'EMAIL_DELIVERY_FAILED',

  // Generic errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  FORBIDDEN = 'FORBIDDEN',
}

/**
 * Structured authentication error response
 */
export interface AuthError {
  /** Machine-readable error code for client handling */
  error: AuthErrorCode;
  /** User-friendly error message */
  message: string;
  /** Optional detailed error information (excluded in production) */
  details?: unknown;
  /** For rate-limited requests: seconds until retry is allowed */
  retryAfter?: number;
}

/**
 * Options for customizing error responses
 */
interface ErrorHandlerOptions {
  /** Include detailed error information (only in development) */
  includeDetails?: boolean;
  /** Additional context to include in error logs */
  logContext?: Record<string, unknown>;
}

/**
 * Authentication Error Handler
 *
 * Centralized error handling for authentication operations.
 * Converts various error types to standardized AuthError responses.
 */
export class AuthErrorHandler {
  /**
   * Main error handler that routes errors to specific handlers
   *
   * @param error - The error to handle
   * @param options - Configuration options
   * @returns NextResponse with standardized error format
   */
  static handle(error: unknown, options: ErrorHandlerOptions = {}): NextResponse<AuthError> {
    // Log error for debugging (in real app, use structured logging)
    if (process.env.NODE_ENV !== 'production') {
      console.error('Auth error:', error, options.logContext);
    }

    // Supabase Auth errors
    if (error instanceof AuthApiError) {
      return this.handleSupabaseError(error, options);
    }

    // Validation errors
    if (error instanceof ZodError) {
      return this.handleValidationError(error, options);
    }

    // Custom auth errors (thrown by our code)
    if (this.isAuthError(error)) {
      return this.handleAuthError(error, options);
    }

    // Generic errors
    return this.handleGenericError(error, options);
  }

  /**
   * Handle Supabase Auth API errors
   */
  private static handleSupabaseError(
    error: AuthApiError,
    options: ErrorHandlerOptions
  ): NextResponse<AuthError> {
    const isDev = process.env.NODE_ENV !== 'production';

    // Map Supabase error codes to our error codes
    switch (error.status) {
      case 400: {
        // Bad request - could be various validation issues
        if (error.message.includes('User already registered')) {
          return NextResponse.json({
            error: AuthErrorCode.EMAIL_EXISTS,
            message: 'An account with this email already exists.',
            ...(isDev && options.includeDetails && { details: error.message }),
          }, { status: 409 });
        }

        if (error.message.includes('Password')) {
          return NextResponse.json({
            error: AuthErrorCode.WEAK_PASSWORD,
            message: 'Password does not meet security requirements.',
            ...(isDev && options.includeDetails && { details: error.message }),
          }, { status: 400 });
        }

        return NextResponse.json({
          error: AuthErrorCode.VALIDATION_ERROR,
          message: 'Invalid request. Please check your input.',
          ...(isDev && options.includeDetails && { details: error.message }),
        }, { status: 400 });
      }

      case 401: {
        // Unauthorized - invalid credentials
        return NextResponse.json({
          error: AuthErrorCode.INVALID_CREDENTIALS,
          message: 'Invalid email or password.', // Generic message to prevent account enumeration
          ...(isDev && options.includeDetails && { details: error.message }),
        }, { status: 401 });
      }

      case 403: {
        // Forbidden - email not verified or similar
        if (error.message.includes('Email not confirmed')) {
          return NextResponse.json({
            error: AuthErrorCode.EMAIL_NOT_VERIFIED,
            message: 'Please verify your email address before signing in.',
            ...(isDev && options.includeDetails && { details: error.message }),
          }, { status: 403 });
        }

        return NextResponse.json({
          error: AuthErrorCode.FORBIDDEN,
          message: 'You do not have permission to perform this action.',
          ...(isDev && options.includeDetails && { details: error.message }),
        }, { status: 403 });
      }

      case 404: {
        // Not found - user or resource doesn't exist
        return NextResponse.json({
          error: AuthErrorCode.NOT_FOUND,
          message: 'Resource not found.',
          ...(isDev && options.includeDetails && { details: error.message }),
        }, { status: 404 });
      }

      case 422: {
        // Unprocessable entity - validation issues
        if (error.message.includes('Invalid token')) {
          return NextResponse.json({
            error: AuthErrorCode.INVALID_TOKEN,
            message: 'The verification link is invalid or has expired.',
            ...(isDev && options.includeDetails && { details: error.message }),
          }, { status: 422 });
        }

        return NextResponse.json({
          error: AuthErrorCode.VALIDATION_ERROR,
          message: 'Unable to process request. Please check your input.',
          ...(isDev && options.includeDetails && { details: error.message }),
        }, { status: 422 });
      }

      case 429: {
        // Rate limited
        return NextResponse.json({
          error: AuthErrorCode.RATE_LIMIT_EXCEEDED,
          message: 'Too many requests. Please try again later.',
          ...(isDev && options.includeDetails && { details: error.message }),
        }, { status: 429 });
      }

      default: {
        // Generic error
        return NextResponse.json({
          error: AuthErrorCode.INTERNAL_ERROR,
          message: 'An unexpected error occurred. Please try again.',
          ...(isDev && options.includeDetails && { details: error.message }),
        }, { status: 500 });
      }
    }
  }

  /**
   * Handle Zod validation errors
   */
  private static handleValidationError(
    error: ZodError,
    options: ErrorHandlerOptions
  ): NextResponse<AuthError> {
    const isDev = process.env.NODE_ENV !== 'production';

    // Format validation errors for user-friendly display
    const formattedErrors = error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));

    return NextResponse.json({
      error: AuthErrorCode.VALIDATION_ERROR,
      message: 'Validation failed. Please check your input.',
      ...(isDev && options.includeDetails && { details: formattedErrors }),
    }, { status: 400 });
  }

  /**
   * Handle custom auth errors thrown by application code
   */
  private static handleAuthError(
    error: { code: AuthErrorCode; message: string; status?: number; retryAfter?: number },
    _options: ErrorHandlerOptions
  ): NextResponse<AuthError> {
    const status = error.status || 500;

    return NextResponse.json({
      error: error.code,
      message: error.message,
      ...(error.retryAfter && { retryAfter: error.retryAfter }),
    }, { status });
  }

  /**
   * Handle generic/unknown errors
   */
  private static handleGenericError(
    error: unknown,
    options: ErrorHandlerOptions
  ): NextResponse<AuthError> {
    const isDev = process.env.NODE_ENV !== 'production';

    // Log full error for debugging
    console.error('Unhandled error in auth:', error, options.logContext);

    return NextResponse.json({
      error: AuthErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred. Please try again later.',
      ...(isDev && options.includeDetails && { details: String(error) }),
    }, { status: 500 });
  }

  /**
   * Type guard to check if error is a custom AuthError
   */
  private static isAuthError(
    error: unknown
  ): error is { code: AuthErrorCode; message: string; status?: number; retryAfter?: number } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      Object.values(AuthErrorCode).includes((error as { code: AuthErrorCode }).code)
    );
  }
}

/**
 * Helper function to create a standardized auth error
 *
 * @example
 * throw createAuthError(
 *   AuthErrorCode.ACCOUNT_LOCKED,
 *   'Your account has been temporarily locked due to too many failed login attempts.',
 *   { status: 429, retryAfter: 900 }
 * );
 */
export function createAuthError(
  code: AuthErrorCode,
  message: string,
  options: { status?: number; retryAfter?: number } = {}
): { code: AuthErrorCode; message: string; status?: number; retryAfter?: number } {
  return {
    code,
    message,
    ...options,
  };
}

/**
 * Helper to check if a user is authenticated from error
 * Useful for determining if a 401 error means "not logged in" vs "invalid credentials"
 */
export function isUnauthenticatedError(error: unknown): boolean {
  if (error instanceof AuthApiError) {
    return error.status === 401;
  }

  if (AuthErrorHandler['isAuthError'](error)) {
    return (
      error.code === AuthErrorCode.UNAUTHORIZED ||
      error.code === AuthErrorCode.SESSION_EXPIRED
    );
  }

  return false;
}

/**
 * Helper to extract rate limit info from error
 */
export function getRateLimitInfo(error: unknown): { retryAfter?: number } | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'retryAfter' in error &&
    typeof error.retryAfter === 'number'
  ) {
    return { retryAfter: error.retryAfter };
  }

  return null;
}
