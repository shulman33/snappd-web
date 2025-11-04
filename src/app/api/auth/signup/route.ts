/**
 * POST /api/auth/signup
 *
 * User Story 1: Email/Password Account Creation
 * Handles new user registration with email/password authentication
 *
 * @module api/auth/signup
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { signupSchema } from '@/lib/schemas/auth';
import { AuthEventLogger, AuthEventType, getIpAddress, getUserAgent } from '@/lib/auth/logger';
import { accountRateLimiter } from '@/lib/auth/rate-limit';
import { AuthErrorHandler, AuthErrorCode, createAuthError } from '@/lib/auth/errors';

/**
 * POST /api/auth/signup
 *
 * Creates a new user account with email/password credentials.
 *
 * Request Body:
 * - email (string, required): Valid email address
 * - password (string, required): Min 8 chars, uppercase, lowercase, number, special char
 * - fullName (string, optional): User's full name
 *
 * Success Response (201):
 * {
 *   "user": {
 *     "id": "uuid",
 *     "email": "user@example.com",
 *     "emailVerified": false,
 *     "fullName": "John Doe",
 *     "plan": "free",
 *     "createdAt": "2025-11-02T12:00:00Z"
 *   },
 *   "message": "Signup successful! Please check your email to verify your account."
 * }
 *
 * Error Responses:
 * - 400: Validation error
 * - 409: Email already exists
 * - 429: Rate limit exceeded (account lockout)
 * - 500: Internal server error
 */
export async function POST(request: NextRequest) {
  const ipAddress = getIpAddress(request);
  const userAgent = getUserAgent(request);

  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedData = signupSchema.parse(body);

    const { email, password, fullName } = validatedData;

    // Check account-level rate limiting (prevent rapid signup abuse)
    // Note: This checks for recent signup failures, not just this specific email
    const { success: rateLimitSuccess, reset } = await accountRateLimiter.limit(email);

    if (!rateLimitSuccess) {
      // Log account lockout event
      await AuthEventLogger.logAccountLocked(
        undefined, // userId not known yet
        email,
        ipAddress,
        5, // threshold from rate limiter
        new Date(reset).toISOString(),
        userAgent || undefined
      );

      throw createAuthError(
        AuthErrorCode.ACCOUNT_LOCKED,
        'Too many signup attempts. Your account is temporarily locked for 15 minutes.',
        { status: 429, retryAfter: Math.ceil((reset - Date.now()) / 1000) }
      );
    }

    // Create Supabase server client
    const supabase = await createServerClient();

    // Attempt to sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || null,
          first_name: fullName ? fullName.split(' ')[0] : null,
          last_name: fullName ? fullName.split(' ').slice(1).join(' ') : null,
        },
        // Redirect URL after email confirmation (optional)
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    });

    // Handle Supabase errors
    if (error) {
      // Check if email already exists
      if (error.message.includes('already registered') || error.message.includes('email already exists')) {
        await AuthEventLogger.log({
          eventType: AuthEventType.SIGNUP_FAILURE,
          email,
          ipAddress,
          userAgent,
          metadata: {
            reason: 'email_exists',
          },
        });

        throw createAuthError(
          AuthErrorCode.EMAIL_EXISTS,
          'An account with this email address already exists. Please try signing in instead.',
          { status: 409 }
        );
      }

      // Log generic signup failure
      await AuthEventLogger.log({
        eventType: AuthEventType.SIGNUP_FAILURE,
        email,
        ipAddress,
        userAgent,
        metadata: {
          reason: 'validation_error',
          error_message: error.message,
        },
      });

      throw createAuthError(
        AuthErrorCode.INTERNAL_ERROR,
        'Failed to create account. Please try again later.',
        { status: 500 }
      );
    }

    // Verify user was created successfully
    if (!data.user) {
      await AuthEventLogger.log({
        eventType: AuthEventType.SIGNUP_FAILURE,
        email,
        ipAddress,
        userAgent,
        metadata: {
          reason: 'profile_creation_failed',
        },
      });

      throw createAuthError(
        AuthErrorCode.PROFILE_CREATION_FAILED,
        'Failed to create user profile. Please try again later.',
        { status: 500 }
      );
    }

    // Log successful signup
    await AuthEventLogger.log({
      eventType: AuthEventType.SIGNUP_SUCCESS,
      userId: data.user.id,
      email: data.user.email || email,
      ipAddress,
      userAgent,
      metadata: {
        method: 'email',
      },
    });

    // Return success response
    return NextResponse.json(
      {
        user: {
          id: data.user.id,
          email: data.user.email,
          emailVerified: data.user.email_confirmed_at !== null,
          fullName: data.user.user_metadata?.full_name || null,
          plan: 'free', // All new users start on free plan
          createdAt: data.user.created_at,
        },
        message: 'Signup successful! Please check your email to verify your account.',
      },
      { status: 201 }
    );
  } catch (error) {
    // Handle all errors (including Zod validation, custom auth errors, and unexpected errors)
    return AuthErrorHandler.handle(error, {
      includeDetails: process.env.NODE_ENV !== 'production',
      logContext: { route: 'POST /api/auth/signup' },
    });
  }
}
