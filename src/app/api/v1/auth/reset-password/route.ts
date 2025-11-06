/**
 * POST /api/v1/auth/reset-password
 *
 * Initiates a password reset flow by sending a password reset email to the user.
 * Includes rate limiting, exponential backoff for email delivery failures,
 * and comprehensive auth event logging.
 *
 * @see https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { resetPasswordRequestSchema } from '@/lib/schemas/auth';
import { passwordResetLimiter } from '@/lib/auth/rate-limit';
import { AuthEventLogger, AuthEventType } from '@/lib/auth/logger';
import { getIpAddress, getUserAgent } from '@/lib/auth/logger';
import { AuthErrorHandler, AuthErrorCode, createAuthError } from '@/lib/auth/errors';

/**
 * Configuration for exponential backoff retry logic
 */
const RETRY_CONFIG = {
  maxAttempts: 3,
  delays: [0, 2 * 60 * 1000, 5 * 60 * 1000], // immediate, 2min, 5min
};

/**
 * Sends password reset email with exponential backoff retry logic
 *
 * @param supabase - Supabase client instance
 * @param email - User's email address
 * @param redirectUrl - URL to redirect after password reset
 * @returns Object with success status and attempt count
 */
async function sendPasswordResetEmailWithRetry(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  email: string,
  redirectUrl: string
): Promise<{ success: boolean; attempts: number; error?: string }> {
  let lastError: string | undefined;

  for (let attempt = 0; attempt < RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      // Wait for the configured delay (0ms for first attempt)
      if (RETRY_CONFIG.delays[attempt] > 0) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_CONFIG.delays[attempt]));
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (!error) {
        return { success: true, attempts: attempt + 1 };
      }

      lastError = error.message;
      console.error(`Password reset email attempt ${attempt + 1} failed:`, error);
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Password reset email attempt ${attempt + 1} threw exception:`, error);
    }
  }

  return {
    success: false,
    attempts: RETRY_CONFIG.maxAttempts,
    error: lastError,
  };
}

/**
 * POST /api/v1/auth/reset-password
 *
 * Request body:
 * - email (string, required): User's email address
 *
 * Rate limit: 3 requests per hour per email
 *
 * Responses:
 * - 200: Password reset email sent successfully
 * - 400: Validation error (invalid email format)
 * - 429: Rate limit exceeded
 * - 500: Email delivery failure after retries
 */
export async function POST(request: NextRequest) {
  try {
    // Get request metadata for logging and rate limiting
    const ipAddress = getIpAddress(request);
    const userAgent = getUserAgent(request);

    // Parse and validate request body
    const body = await request.json();
    const { email } = resetPasswordRequestSchema.parse(body);

    // Check rate limit (3 requests per hour)
    const { success: rateLimitPassed, reset } = await passwordResetLimiter.limit(email);

    if (!rateLimitPassed) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);

      throw createAuthError(
        AuthErrorCode.RATE_LIMIT_EXCEEDED,
        'Too many password reset requests. Please try again later or contact support if you need immediate assistance.',
        { status: 429, retryAfter }
      );
    }

    // Initialize Supabase client
    const supabase = await createServerClient();

    // Build redirect URL for password reset confirmation
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/confirm`;

    // Send password reset email with retry logic
    const emailResult = await sendPasswordResetEmailWithRetry(supabase, email, redirectUrl);

    // Log the password reset event with email delivery status
    await AuthEventLogger.log({
      eventType: AuthEventType.PASSWORD_RESET,
      email,
      ipAddress,
      userAgent,
      metadata: {
        reset_token_sent: emailResult.success,
        email_delivery_attempts: emailResult.attempts,
      },
    });

    // Handle email delivery failure
    if (!emailResult.success) {
      throw createAuthError(
        AuthErrorCode.EMAIL_DELIVERY_FAILED,
        'We were unable to send the password reset email after multiple attempts. Please verify your email address is correct, or try again later. If the problem persists, contact support.',
        { status: 500 }
      );
    }

    // Success response
    // Note: We always return success even if the email doesn't exist in the system
    // This prevents account enumeration attacks
    return NextResponse.json(
      {
        message:
          'If an account exists with this email address, you will receive password reset instructions shortly. Please check your inbox and spam folder.',
      },
      { status: 200 }
    );
  } catch (error) {
    // Handle all errors (including Zod validation, custom auth errors, and unexpected errors)
    return AuthErrorHandler.handle(error, {
      includeDetails: process.env.NODE_ENV !== 'production',
      logContext: { route: 'POST /api/v1/auth/reset-password' },
    });
  }
}
