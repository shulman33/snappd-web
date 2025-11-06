/**
 * POST /api/v1/auth/verify-email
 *
 * User Story 1: Email/Password Account Creation
 * Handles email verification via token_hash (PKCE flow)
 *
 * @module api/auth/verify-email
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { AuthEventLogger, AuthEventType, getIpAddress, getUserAgent } from '@/lib/auth/logger';
import { type EmailOtpType } from '@supabase/supabase-js';

/**
 * GET /api/v1/auth/verify-email
 *
 * Verifies user email address using token_hash from email link (PKCE flow).
 * This endpoint is called when the user clicks the verification link in their email.
 *
 * Query Parameters:
 * - token_hash (string, required): Hashed verification token from email link
 * - type (string, required): OTP type (should be 'email' for email verification)
 * - next (string, optional): Redirect URL after successful verification
 *
 * Success Response (302):
 * Redirects to the `next` URL parameter or `/dashboard` by default
 *
 * Error Response (302):
 * Redirects to `/auth/error` with error details in query string
 */
export async function GET(request: NextRequest) {
  const ipAddress = getIpAddress(request);
  const userAgent = getUserAgent(request);

  try {
    const { searchParams } = new URL(request.url);
    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type') as EmailOtpType | null;
    const next = searchParams.get('next') ?? '/dashboard';

    // Validate required parameters
    if (!token_hash || !type) {
      return NextResponse.redirect(
        new URL('/auth/error?message=Missing verification parameters', request.url)
      );
    }

    // Verify token_hash must be 'email' type for email verification
    if (type !== 'email') {
      return NextResponse.redirect(
        new URL('/auth/error?message=Invalid verification type', request.url)
      );
    }

    // Create Supabase server client
    const supabase = await createServerClient();

    // Verify the OTP token
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    // Handle verification errors
    if (error) {
      // Check if token is expired
      if (error.message.includes('expired') || error.message.includes('invalid')) {
        await AuthEventLogger.log({
          eventType: AuthEventType.SIGNUP_FAILURE,
          email: null,
          ipAddress,
          userAgent,
          metadata: {
            reason: 'verification_token_expired',
            error_message: error.message,
          },
        });

        return NextResponse.redirect(
          new URL(
            '/auth/error?message=Verification link has expired. Please request a new verification email.',
            request.url
          )
        );
      }

      // Generic verification failure
      await AuthEventLogger.log({
        eventType: AuthEventType.SIGNUP_FAILURE,
        email: null,
        ipAddress,
        userAgent,
        metadata: {
          reason: 'verification_failed',
          error_message: error.message,
        },
      });

      return NextResponse.redirect(
        new URL('/auth/error?message=Email verification failed. Please try again.', request.url)
      );
    }

    // Verify that user was authenticated successfully
    if (!data.user) {
      return NextResponse.redirect(
        new URL('/auth/error?message=Invalid verification response', request.url)
      );
    }

    // Log successful email verification
    await AuthEventLogger.log({
      eventType: AuthEventType.EMAIL_VERIFIED,
      userId: data.user.id,
      email: data.user.email || null,
      ipAddress,
      userAgent,
      metadata: {
        verification_method: 'link',
      },
    });

    // Redirect to the specified next URL or dashboard
    const redirectUrl = new URL(next, request.url);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    // Handle unexpected errors
    console.error('Unexpected error in verify-email route:', error);

    return NextResponse.redirect(
      new URL('/auth/error?message=An unexpected error occurred during verification', request.url)
    );
  }
}
