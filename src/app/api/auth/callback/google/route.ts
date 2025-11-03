/**
 * GET /api/auth/callback/google
 *
 * Handle OAuth callback from Google authentication.
 *
 * Features:
 * - OAuth authorization code exchange for session
 * - Automatic account creation for new OAuth users (FR-042)
 * - Account linking for existing users with matching emails (FR-041)
 * - Extract user email and name from Google OAuth provider (FR-040)
 * - Validate and sanitize OAuth responses with security event logging (FR-043)
 * - Error handling for malformed OAuth responses
 * - Comprehensive auth event logging
 * - Session cookie management
 *
 * @see specs/005-auth-system/contracts/openapi.yaml
 * @see specs/005-auth-system/data-model.md - OAuth Provider Links (auth.identities)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { AuthErrorHandler, AuthErrorCode, createAuthError } from '@/lib/auth/errors';
import {
  AuthEventLogger,
  AuthEventType,
  getIpAddress,
  getUserAgent,
} from '@/lib/auth/logger';

/**
 * GET /api/auth/callback/google
 *
 * Handle OAuth callback from Google
 *
 * @param request - Next.js request object
 * @returns NextResponse redirecting to dashboard or error page
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Extract request metadata for logging
    const ipAddress = getIpAddress(request);
    const userAgent = getUserAgent(request);

    // =========================================================================
    // OAuth Error Handling
    // =========================================================================

    // Check for OAuth provider errors (user cancelled, access denied, etc.)
    if (error) {
      console.error('OAuth error from Google:', {
        error,
        errorDescription,
        ipAddress,
        userAgent,
      });

      // Redirect to login with error message
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'oauth_failed');
      loginUrl.searchParams.set(
        'message',
        errorDescription || 'Authentication with Google failed. Please try again.'
      );

      return NextResponse.redirect(loginUrl);
    }

    // Check for missing authorization code
    if (!code) {
      console.error('Missing authorization code in OAuth callback', {
        ipAddress,
        userAgent,
      });

      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'oauth_failed');
      loginUrl.searchParams.set('message', 'Invalid OAuth callback. Please try again.');

      return NextResponse.redirect(loginUrl);
    }

    // =========================================================================
    // OAuth Code Exchange
    // =========================================================================

    const supabase = await createServerClient();

    // Exchange authorization code for session
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    // Handle code exchange errors
    if (exchangeError || !data.user || !data.session) {
      console.error('Failed to exchange OAuth code for session:', {
        error: exchangeError,
        ipAddress,
        userAgent,
      });

      // Log OAuth failure event
      await AuthEventLogger.log({
        eventType: AuthEventType.SIGNUP_FAILURE,
        email: undefined,
        ipAddress,
        userAgent: userAgent || undefined,
        metadata: {
          reason: 'oauth_code_exchange_failed',
          provider: 'google',
          error: exchangeError?.message,
        },
      });

      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'oauth_failed');
      loginUrl.searchParams.set(
        'message',
        'Failed to complete Google authentication. Please try again.'
      );

      return NextResponse.redirect(loginUrl);
    }

    // =========================================================================
    // Validate OAuth Response Data (FR-043)
    // =========================================================================

    // Validate user data from OAuth provider
    const { user } = data;

    // Check for required fields
    if (!user.email) {
      console.error('Missing email in OAuth response from Google', {
        userId: user.id,
        ipAddress,
        userAgent,
      });

      // Log security event for malformed OAuth response
      await AuthEventLogger.log({
        eventType: AuthEventType.SIGNUP_FAILURE,
        userId: undefined,
        email: undefined,
        ipAddress,
        userAgent: userAgent || undefined,
        metadata: {
          reason: 'malformed_oauth_response',
          provider: 'google',
          error: 'Missing required field: email',
          security_alert: true,
        },
      });

      throw createAuthError(
        AuthErrorCode.VALIDATION_ERROR,
        'Invalid authentication response from Google. Email address is required.',
        { status: 400 }
      );
    }

    // Validate email format (additional security check)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(user.email)) {
      console.error('Invalid email format in OAuth response', {
        email: user.email,
        userId: user.id,
        ipAddress,
        userAgent,
      });

      // Log security event for invalid email format
      await AuthEventLogger.log({
        eventType: AuthEventType.SIGNUP_FAILURE,
        userId: undefined,
        email: user.email,
        ipAddress,
        userAgent: userAgent || undefined,
        metadata: {
          reason: 'invalid_email_format',
          provider: 'google',
          security_alert: true,
        },
      });

      throw createAuthError(
        AuthErrorCode.VALIDATION_ERROR,
        'Invalid email format received from Google.',
        { status: 400 }
      );
    }

    // =========================================================================
    // Extract User Data from OAuth Provider (FR-040, T065)
    // =========================================================================

    // Extract user metadata from OAuth provider response
    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.display_name ||
      null;

    const email = user.email;
    const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

    // =========================================================================
    // Check if New User or Existing Account Link
    // =========================================================================

    // Fetch user profile to determine if this is a new user or account linking
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, plan, created_at')
      .eq('id', user.id)
      .single();

    // Determine if this is a new user or account linking
    const isNewUser = !existingProfile || profileError;

    // =========================================================================
    // Verify OAuth Identity Stored (T069)
    // =========================================================================

    // OAuth identities are automatically managed by Supabase Auth
    // They are stored in auth.identities and linked via user.identities
    // We can access them through the user object from the session
    const userIdentities = user.identities || [];
    const googleIdentity = userIdentities.find((id) => id.provider === 'google');

    if (!googleIdentity) {
      console.warn('Google OAuth identity not found in user.identities', {
        userId: user.id,
        email,
        identitiesCount: userIdentities.length,
      });
    } else {
      console.log('Google OAuth identity verified:', {
        userId: user.id,
        provider: googleIdentity.provider,
        providerId: googleIdentity.id,
        createdAt: googleIdentity.created_at,
      });
    }

    // =========================================================================
    // Update Profile with OAuth Data (if needed)
    // =========================================================================

    if (existingProfile && !profileError) {
      // For existing users, update full_name if not already set
      if (!existingProfile.full_name && fullName) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            full_name: fullName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        if (updateError) {
          console.error('Failed to update profile with OAuth data:', {
            error: updateError,
            userId: user.id,
            email,
          });
        }
      }
    }

    // =========================================================================
    // Auth Event Logging (T066)
    // =========================================================================

    if (isNewUser) {
      // Log successful signup via OAuth (FR-042: Automatic account creation)
      await AuthEventLogger.log({
        eventType: AuthEventType.SIGNUP_SUCCESS,
        userId: user.id,
        email,
        ipAddress,
        userAgent: userAgent || undefined,
        metadata: {
          method: 'oauth',
          provider: 'google',
          full_name: fullName,
        },
      });

      // Log OAuth linked event
      await AuthEventLogger.log({
        eventType: AuthEventType.OAUTH_LINKED,
        userId: user.id,
        email,
        ipAddress,
        userAgent: userAgent || undefined,
        metadata: {
          provider: 'google',
          provider_id: googleIdentity?.id,
          linked_at: googleIdentity?.created_at || new Date().toISOString(),
        },
      });
    } else {
      // Log OAuth linked event for existing account (FR-041: Account linking)
      await AuthEventLogger.log({
        eventType: AuthEventType.OAUTH_LINKED,
        userId: user.id,
        email,
        ipAddress,
        userAgent: userAgent || undefined,
        metadata: {
          provider: 'google',
          provider_id: googleIdentity?.id,
          linked_at: googleIdentity?.created_at || new Date().toISOString(),
          account_already_exists: true,
        },
      });

      // Log successful login
      await AuthEventLogger.logLoginSuccess(
        user.id,
        email,
        ipAddress,
        'oauth',
        userAgent || undefined
      );
    }

    // =========================================================================
    // Redirect to Dashboard
    // =========================================================================

    // Redirect to dashboard on successful authentication
    const dashboardUrl = new URL('/dashboard', request.url);

    // Add success message for new users
    if (isNewUser) {
      dashboardUrl.searchParams.set('welcome', 'true');
    }

    return NextResponse.redirect(dashboardUrl);
  } catch (error) {
    console.error('Unexpected error in Google OAuth callback:', error);

    // Handle all errors
    const response = AuthErrorHandler.handle(error, {
      includeDetails: process.env.NODE_ENV !== 'production',
      logContext: { route: 'GET /api/auth/callback/google' },
    });

    // For API errors, redirect to login page with error message
    // (since this is a GET endpoint called by OAuth redirect, not a JSON API)
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'oauth_failed');
    loginUrl.searchParams.set('message', 'An unexpected error occurred. Please try again.');

    return NextResponse.redirect(loginUrl);
  }
}
