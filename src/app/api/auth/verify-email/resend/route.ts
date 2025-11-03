/**
 * POST /api/auth/verify-email/resend
 *
 * User Story 1: Email/Password Account Creation
 * Handles resending verification emails with rate limiting
 *
 * @module api/auth/verify-email/resend
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { AuthEventLogger, AuthEventType, getIpAddress, getUserAgent } from '@/lib/auth/logger';
import { verificationLimiter } from '@/lib/auth/rate-limit';
import { z, ZodError } from 'zod';

/**
 * Request body schema for resending verification email
 */
const resendVerificationSchema = z.object({
  email: z.string()
    .email({ message: 'Invalid email address' })
    .transform(email => email.toLowerCase().trim()),
});

/**
 * POST /api/auth/verify-email/resend
 *
 * Resends verification email to the specified address.
 * Rate limited to 3 requests per hour per email.
 *
 * Request Body:
 * - email (string, required): Email address to resend verification to
 *
 * Success Response (200):
 * {
 *   "message": "Verification email sent. Please check your inbox."
 * }
 *
 * Error Responses:
 * - 400: Validation error
 * - 429: Rate limit exceeded (3/hour)
 * - 500: Internal server error
 */
export async function POST(request: NextRequest) {
  const ipAddress = getIpAddress(request);
  const userAgent = getUserAgent(request);

  try {
    // Parse and validate request body
    const body = await request.json();
    const { email } = resendVerificationSchema.parse(body);

    // Check rate limiting (3 verification emails per hour)
    const { success: rateLimitSuccess, reset } = await verificationLimiter.limit(email);

    if (!rateLimitSuccess) {
      await AuthEventLogger.log({
        eventType: AuthEventType.VERIFICATION_RESEND,
        email,
        ipAddress,
        userAgent,
        metadata: {
          rate_limited: true,
        },
      });

      return NextResponse.json(
        {
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many verification emails sent. Please check your inbox or try again later.',
          retryAfter: Math.ceil((reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Create Supabase server client
    const supabase = await createServerClient();

    // Resend verification email
    // Using signInWithOtp as per Supabase docs for resending verification
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    });

    // Handle Supabase errors
    if (error) {
      // If user doesn't exist or email already verified, return generic success message
      // to prevent email enumeration attacks
      if (
        error.message.includes('not found') ||
        error.message.includes('already confirmed') ||
        error.message.includes('already verified')
      ) {
        // Still return success to prevent enumeration
        return NextResponse.json(
          {
            message: 'If an unverified account exists with this email, a verification email has been sent.',
          },
          { status: 200 }
        );
      }

      // Log generic failure
      await AuthEventLogger.log({
        eventType: AuthEventType.VERIFICATION_RESEND,
        email,
        ipAddress,
        userAgent,
        metadata: {
          success: false,
          error_message: error.message,
        },
      });

      return NextResponse.json(
        {
          error: 'INTERNAL_ERROR',
          message: 'Failed to resend verification email. Please try again later.',
        },
        { status: 500 }
      );
    }

    // Log successful resend
    await AuthEventLogger.log({
      eventType: AuthEventType.VERIFICATION_RESEND,
      email,
      ipAddress,
      userAgent,
      metadata: {
        success: true,
      },
    });

    // Return generic success message (prevent email enumeration)
    return NextResponse.json(
      {
        message: 'If an unverified account exists with this email, a verification email has been sent.',
      },
      { status: 200 }
    );
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Invalid email address',
        },
        { status: 400 }
      );
    }

    // Handle unexpected errors
    console.error('Unexpected error in verify-email/resend route:', error);

    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Please try again later.',
      },
      { status: 500 }
    );
  }
}
