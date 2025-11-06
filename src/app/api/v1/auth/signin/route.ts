/**
 * POST /api/v1/auth/signin
 *
 * Authenticate a user with email and password.
 *
 * Features:
 * - Email/password authentication via Supabase Auth
 * - Dual-scope rate limiting (per-account + per-IP)
 * - Account lockout after 5 failed attempts (15 min window)
 * - IP blocking after 20 failed attempts (15 min window)
 * - Email verification check
 * - Generic error messages to prevent account enumeration
 * - Comprehensive auth event logging
 * - Session cookie management
 *
 * @see specs/005-auth-system/contracts/openapi.yaml
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { signinSchema, type SigninInput } from '@/lib/schemas/auth';
import { AuthErrorHandler, AuthErrorCode, createAuthError } from '@/lib/auth/errors';
import { accountRateLimiter } from '@/lib/auth/rate-limit';
import {
  AuthEventLogger,
  AuthEventType,
  getIpAddress,
  getUserAgent,
} from '@/lib/auth/logger';
import { ZodError } from 'zod';

/**
 * POST /api/v1/auth/signin
 *
 * Sign in a user with email and password
 *
 * @param request - Next.js request object
 * @returns NextResponse with user data and session or error
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const { email, password }: SigninInput = signinSchema.parse(body);

    // Extract request metadata for logging and rate limiting
    const ipAddress = getIpAddress(request);
    const userAgent = getUserAgent(request);

    // =========================================================================
    // Rate Limiting & Account Lockout Checks
    // =========================================================================

    // Check IP-level blocking (20 failures in 15 min)
    const ipBlocked = await AuthEventLogger.isIpBlocked(ipAddress, 20, 15);
    if (ipBlocked) {
      // Log IP block event
      const lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await AuthEventLogger.logIpBlocked(
        ipAddress,
        20,
        lockedUntil,
        userAgent || undefined
      );

      throw createAuthError(
        AuthErrorCode.IP_BLOCKED,
        'Your IP has been temporarily blocked due to too many failed login attempts. Please try again later.',
        { status: 429, retryAfter: 900 } // 15 minutes
      );
    }

    // Check account-level lockout (5 failures in 15 min)
    const accountLocked = await AuthEventLogger.isAccountLocked(email, 5, 15);
    if (accountLocked) {
      // Log account locked event
      const lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await AuthEventLogger.logAccountLocked(
        undefined, // userId not known yet
        email,
        ipAddress,
        5,
        lockedUntil,
        userAgent || undefined
      );

      throw createAuthError(
        AuthErrorCode.ACCOUNT_LOCKED,
        'Too many failed login attempts. Your account is temporarily locked for 15 minutes.',
        { status: 429, retryAfter: 900 } // 15 minutes
      );
    }

    // Apply account-specific rate limiting (5 attempts per 15 min)
    // This is ADDITIONAL to the lockout check above - it prevents new attempts
    const { success: rateLimitSuccess } = await accountRateLimiter.limit(email);
    if (!rateLimitSuccess) {
      // Already logged as account_locked above
      throw createAuthError(
        AuthErrorCode.ACCOUNT_LOCKED,
        'Too many failed login attempts. Your account is temporarily locked for 15 minutes.',
        { status: 429, retryAfter: 900 }
      );
    }

    // =========================================================================
    // Authentication
    // =========================================================================

    const supabase = await createServerClient();

    // Attempt sign in
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Handle authentication errors
    if (authError || !data.user || !data.session) {
      // Determine failure reason for logging (NOT exposed to user)
      let failureReason: 'invalid_credentials' | 'unverified_email' | 'account_locked' =
        'invalid_credentials';

      // Check if error is due to unverified email
      if (
        authError?.message?.includes('Email not confirmed') ||
        authError?.message?.includes('not verified')
      ) {
        failureReason = 'unverified_email';
      }

      // Log failed login attempt
      await AuthEventLogger.logLoginFailure(
        email,
        ipAddress,
        failureReason,
        userAgent || undefined
      );

      // Return GENERIC error message to prevent account enumeration
      // Same message for invalid password, non-existent account, etc.
      throw createAuthError(
        AuthErrorCode.INVALID_CREDENTIALS,
        'Invalid email or password.',
        { status: 401 }
      );
    }

    // =========================================================================
    // Email Verification Check
    // =========================================================================

    // Check if email is verified (email_confirmed_at must not be null)
    if (!data.user.email_confirmed_at) {
      // Log failure with unverified email reason
      await AuthEventLogger.logLoginFailure(
        email,
        ipAddress,
        'unverified_email',
        userAgent || undefined
      );

      throw createAuthError(
        AuthErrorCode.EMAIL_NOT_VERIFIED,
        'Please verify your email address before signing in. Check your inbox for the verification link.',
        { status: 403 }
      );
    }

    // =========================================================================
    // Fetch User Profile
    // =========================================================================

    // Fetch user profile from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, plan, created_at, updated_at')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      console.error('Failed to fetch user profile:', profileError);

      throw createAuthError(
        AuthErrorCode.INTERNAL_ERROR,
        'An error occurred while signing in. Please try again.',
        { status: 500 }
      );
    }

    // =========================================================================
    // Success Logging
    // =========================================================================

    // Log successful login
    await AuthEventLogger.logLoginSuccess(
      data.user.id,
      email,
      ipAddress,
      'password',
      userAgent || undefined
    );

    // =========================================================================
    // Response
    // =========================================================================

    // Return user data and session info
    return NextResponse.json(
      {
        user: {
          id: profile.id,
          email: profile.email,
          emailVerified: true,
          fullName: profile.full_name,
          plan: profile.plan,
          createdAt: profile.created_at,
        },
        session: {
          expiresAt: new Date(
            Date.now() + (data.session.expires_in || 3600) * 1000
          ).toISOString(),
        },
      },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return AuthErrorHandler.handle(error, {
        includeDetails: process.env.NODE_ENV !== 'production',
        logContext: { route: 'POST /api/v1/auth/signin' },
      });
    }

    // Handle all other errors (including custom auth errors)
    return AuthErrorHandler.handle(error, {
      includeDetails: process.env.NODE_ENV !== 'production',
      logContext: { route: 'POST /api/v1/auth/signin' },
    });
  }
}
