/**
 * POST /api/auth/reset-password
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
 * POST /api/auth/reset-password
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
    const validation = resetPasswordRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Invalid email address',
          details: validation.error.issues.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    const { email } = validation.data;

    // Check rate limit (3 requests per hour)
    const { success: rateLimitPassed, reset } = await passwordResetLimiter.limit(email);

    if (!rateLimitPassed) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);

      return NextResponse.json(
        {
          error: 'RATE_LIMIT_EXCEEDED',
          message:
            'Too many password reset requests. Please try again later or contact support if you need immediate assistance.',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '3',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(reset).toISOString(),
            'Retry-After': retryAfter.toString(),
          },
        }
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
      return NextResponse.json(
        {
          error: 'EMAIL_DELIVERY_FAILED',
          message:
            'We were unable to send the password reset email after multiple attempts. Please verify your email address is correct, or try again later. If the problem persists, contact support.',
          supportEmail: 'support@snappd.app',
          canRetry: true,
        },
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
    console.error('Error in POST /api/auth/reset-password:', error);

    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Please try again.',
      },
      { status: 500 }
    );
  }
}
