/**
 * Magic Link Authentication Route Handler
 *
 * POST /api/v1/auth/magic-link
 *
 * Sends a magic link to the user's email for passwordless authentication.
 * Supports both existing users and automatic account creation for new users.
 *
 * Features:
 * - Rate limiting (5 requests per hour per email)
 * - Automatic account creation for new users
 * - Exponential backoff for email delivery failures
 * - Auth event logging
 * - 15-minute link expiration
 *
 * @see {@link https://supabase.com/docs/reference/javascript/auth-signinwithotp}
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { magicLinkRequestSchema } from '@/lib/schemas/auth';
import { magicLinkLimiter } from '@/lib/auth/rate-limit';
import { AuthEventLogger, AuthEventType, getIpAddress, getUserAgent } from '@/lib/auth/logger';
import { AuthErrorHandler, AuthErrorCode, createAuthError } from '@/lib/auth/errors';

/**
 * Exponential backoff helper for email delivery
 * Retries: immediate, 2min, 5min
 */
async function sendMagicLinkWithRetry(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  email: string,
  maxAttempts: number = 3
): Promise<{ success: boolean; attempts: number; error?: string }> {
  const delays = [0, 2 * 60 * 1000, 5 * 60 * 1000]; // 0, 2min, 5min

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Wait before retry (skip on first attempt)
    if (attempt > 0 && delays[attempt]) {
      await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    }

    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/auth/magic-link/callback`,
          shouldCreateUser: true, // Allow account creation for new users
        },
      });

      if (!error) {
        return { success: true, attempts: attempt + 1 };
      }

      // If it's not a transient error, don't retry
      if (error.message && !error.message.includes('network') && !error.message.includes('timeout')) {
        return { success: false, attempts: attempt + 1, error: error.message };
      }

      // Continue to next retry for transient errors
      console.warn(`Magic link send attempt ${attempt + 1} failed:`, error.message);
    } catch (error) {
      console.error(`Magic link send attempt ${attempt + 1} error:`, error);
      // Continue to next retry
    }
  }

  return {
    success: false,
    attempts: maxAttempts,
    error: 'Failed to send magic link after multiple attempts',
  };
}

/**
 * POST /api/v1/auth/magic-link
 *
 * Request a magic link for passwordless authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedData = magicLinkRequestSchema.parse(body);
    const { email } = validatedData;

    // Extract request metadata
    const ipAddress = getIpAddress(request);
    const userAgent = getUserAgent(request);

    // Rate limiting - 5 requests per hour per email
    const rateLimitResult = await magicLinkLimiter.limit(email);
    if (!rateLimitResult.success) {
      throw createAuthError(
        AuthErrorCode.RATE_LIMIT_EXCEEDED,
        'Too many magic link requests. Please try again in an hour.',
        { status: 429, retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000) }
      );
    }

    // Initialize Supabase client
    const supabase = await createServerClient();

    // Send magic link with exponential backoff retry
    const result = await sendMagicLinkWithRetry(supabase, email);

    if (!result.success) {
      // Log failure event
      await AuthEventLogger.log({
        eventType: AuthEventType.MAGIC_LINK_SENT,
        email,
        ipAddress,
        userAgent,
        metadata: {
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          delivery_failed: true,
          email_delivery_attempts: result.attempts,
          error: result.error,
        },
      });

      throw createAuthError(
        AuthErrorCode.EMAIL_DELIVERY_FAILED,
        'Failed to send magic link email after multiple attempts. Please verify your email address or contact support.',
        { status: 500 }
      );
    }

    // Calculate expiration time (15 minutes from now)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Log successful magic link sent event
    await AuthEventLogger.log({
      eventType: AuthEventType.MAGIC_LINK_SENT,
      email,
      ipAddress,
      userAgent,
      metadata: {
        expires_at: expiresAt,
        email_delivery_attempts: result.attempts,
      },
    });

    return NextResponse.json(
      {
        message: 'Magic link sent successfully. Please check your email.',
        expiresAt,
      },
      { status: 200 }
    );
  } catch (error) {
    // Handle all errors (including Zod validation, custom auth errors, and unexpected errors)
    return AuthErrorHandler.handle(error, {
      includeDetails: process.env.NODE_ENV !== 'production',
      logContext: { route: 'POST /api/v1/auth/magic-link' },
    });
  }
}
