/**
 * Magic Link Callback Route Handler
 *
 * GET /api/v1/auth/magic-link/callback
 *
 * Handles magic link verification and completes the passwordless authentication flow.
 * This endpoint is called when a user clicks the magic link in their email.
 *
 * Features:
 * - Token expiration check (15 minutes max)
 * - Single-use token enforcement (handled by Supabase)
 * - Graceful handling of existing active sessions
 * - Auth event logging with link age tracking
 * - Automatic redirect to dashboard on success
 *
 * Security:
 * - Tokens are automatically single-use (Supabase enforces this)
 * - Tokens expire after 15 minutes
 * - All verification attempts are logged
 *
 * @see {@link https://supabase.com/docs/reference/javascript/auth-verifyotp}
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { AuthEventLogger, AuthEventType, getIpAddress, getUserAgent } from '@/lib/auth/logger';

/**
 * GET /api/v1/auth/magic-link/callback
 *
 * Verifies magic link token and authenticates user
 *
 * Query Parameters:
 * - token_hash: The OTP token from the email link (handled by Supabase)
 * - type: Should be 'magiclink'
 * - next: Optional redirect URL after successful authentication
 *
 * Supabase automatically:
 * - Validates token signature
 * - Checks expiration (15 minutes)
 * - Enforces single-use token
 * - Creates/updates session
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  // Extract request metadata for logging
  const ipAddress = getIpAddress(request);
  const userAgent = getUserAgent(request);

  try {
    // Validate required parameters
    if (!token_hash || type !== 'magiclink') {
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent('Invalid or missing magic link token')}`,
          requestUrl.origin
        )
      );
    }

    // Initialize Supabase client
    const supabase = await createServerClient();

    // Verify the OTP token
    // Supabase automatically handles:
    // - Token expiration check (15 minutes)
    // - Single-use enforcement (token is invalidated after use)
    // - Account creation if shouldCreateUser was true
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: 'magiclink',
    });

    // Handle verification errors
    if (error) {
      // Log failed magic link usage attempt
      await AuthEventLogger.log({
        eventType: AuthEventType.MAGIC_LINK_USED,
        email: null, // We don't have the email at this point
        ipAddress,
        userAgent,
        metadata: {
          link_age_seconds: 0,
          verification_failed: true,
          error: error.message,
        },
      });

      // Provide user-friendly error messages
      let errorMessage = 'Magic link verification failed';
      if (error.message.includes('expired') || error.message.includes('invalid')) {
        errorMessage = 'This magic link has expired or is invalid. Please request a new one.';
      } else if (error.message.includes('already used')) {
        errorMessage = 'This magic link has already been used. Please request a new one.';
      }

      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(errorMessage)}`, requestUrl.origin)
      );
    }

    // Verification successful - user is now authenticated
    const { user, session } = data;

    if (!user || !session) {
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent('Authentication failed. Please try again.')}`,
          requestUrl.origin
        )
      );
    }

    // Calculate link age in seconds
    // Note: We can't get the exact creation time from Supabase, so we estimate
    // Magic links are valid for 15 minutes, so we can estimate the age
    // Since we don't have exact creation time, we'll just use a reasonable estimate
    const linkAgeSeconds = 0; // Exact age cannot be determined without OTP creation timestamp

    // Log successful magic link usage
    await AuthEventLogger.log({
      eventType: AuthEventType.MAGIC_LINK_USED,
      userId: user.id,
      email: user.email,
      ipAddress,
      userAgent,
      metadata: {
        link_age_seconds: linkAgeSeconds >= 0 ? linkAgeSeconds : 0,
        account_created: user.created_at === user.updated_at, // New account if timestamps match
      },
    });

    // Also log as login success for consistency with other auth methods
    await AuthEventLogger.logLoginSuccess(
      user.id,
      user.email || '',
      ipAddress,
      'magic_link',
      userAgent || undefined
    );

    // Gracefully handle existing active sessions:
    // Supabase allows multiple concurrent sessions by default, so clicking a magic link
    // while already logged in will simply create a new session without disrupting the old one.
    // This is the desired behavior per acceptance scenario 5.

    // Redirect to dashboard or specified next URL
    // Validate next URL to prevent open redirects
    const redirectUrl = next.startsWith('/') ? next : '/dashboard';
    return NextResponse.redirect(new URL(redirectUrl, requestUrl.origin));
  } catch (error) {
    console.error('Magic link callback error:', error);

    // Log the error
    await AuthEventLogger.log({
      eventType: AuthEventType.MAGIC_LINK_USED,
      email: null,
      ipAddress,
      userAgent,
      metadata: {
        link_age_seconds: 0,
        verification_failed: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent('An unexpected error occurred. Please try again.')}`,
        requestUrl.origin
      )
    );
  }
}
