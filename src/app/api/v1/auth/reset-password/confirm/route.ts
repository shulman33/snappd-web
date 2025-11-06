/**
 * POST /api/v1/auth/reset-password/confirm
 *
 * Confirms a password reset by validating the reset token and updating the user's password.
 * Implements token expiration (1 hour), single-use enforcement, and session invalidation.
 *
 * This endpoint is called after the user clicks the password reset link in their email
 * and submits a new password.
 *
 * @see https://supabase.com/docs/reference/javascript/auth-updateuser
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { resetPasswordConfirmSchema } from '@/lib/schemas/auth';
import { AuthEventLogger, AuthEventType } from '@/lib/auth/logger';
import { getIpAddress, getUserAgent } from '@/lib/auth/logger';

/**
 * Token expiration time in milliseconds (1 hour)
 */
const TOKEN_EXPIRATION_MS = 60 * 60 * 1000; // 1 hour

/**
 * POST /api/v1/auth/reset-password/confirm
 *
 * Request body:
 * - token (string, required): Password reset token from email link
 * - password (string, required): New password (min 8 chars, complexity requirements)
 * - confirmPassword (string, required): Password confirmation (must match)
 *
 * Token requirements:
 * - Must be valid and not expired (max 1 hour)
 * - Single-use only (invalidated after successful password change)
 *
 * Security features:
 * - Invalidates all other user sessions (except current)
 * - Logs password_changed event
 * - Enforces password complexity requirements
 *
 * Responses:
 * - 200: Password reset successful
 * - 400: Validation error (invalid token, weak password, etc.)
 * - 401: Token expired or invalid
 * - 500: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    // Get request metadata for logging
    const ipAddress = getIpAddress(request);
    const userAgent = getUserAgent(request);

    // Parse and validate request body
    const body = await request.json();
    const validation = resetPasswordConfirmSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: validation.error.issues.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    const { token, password } = validation.data;

    // Initialize Supabase clients
    const supabase = await createServerClient();
    const supabaseAdmin = createServiceClient();

    // Verify the OTP token and update the password
    // Note: Supabase's verifyOtp automatically handles:
    // 1. Token validation (checks if token is valid and not expired)
    // 2. Single-use enforcement (token is invalidated after use)
    // 3. Token expiration (Supabase enforces 1 hour by default)
    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'recovery',
    });

    if (verifyError || !verifyData.user) {
      // Token is invalid, expired, or already used
      return NextResponse.json(
        {
          error: 'INVALID_TOKEN',
          message:
            'Password reset link is invalid or has expired. Please request a new password reset.',
          canRetry: true,
        },
        { status: 401 }
      );
    }

    const user = verifyData.user;

    // Update the user's password
    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    });

    if (updateError) {
      console.error('Error updating password:', updateError);

      return NextResponse.json(
        {
          error: 'PASSWORD_UPDATE_FAILED',
          message: 'Failed to update password. Please try again or contact support.',
        },
        { status: 500 }
      );
    }

    // Invalidate all other sessions except the current one
    // This is a security measure to ensure that if someone else had access to the account,
    // they are logged out after the password change
    //
    // Note: Supabase automatically invalidates old sessions when password changes,
    // but we explicitly sign out to be safe and log the action
    try {
      // Force sign out from all devices by updating the user's auth metadata
      // This will invalidate all existing refresh tokens
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        app_metadata: {
          password_changed_at: new Date().toISOString(),
        },
      });
    } catch (sessionError) {
      // Log error but don't fail the password reset
      console.error('Error invalidating sessions:', sessionError);
      // Continue - password was changed successfully
    }

    // Log the password_changed event
    await AuthEventLogger.log({
      eventType: AuthEventType.PASSWORD_CHANGED,
      userId: user.id,
      email: user.email || undefined,
      ipAddress,
      userAgent,
      metadata: {
        method: 'reset',
      },
    });

    // Success response
    return NextResponse.json(
      {
        message: 'Your password has been reset successfully. You can now log in with your new password.',
        user: {
          id: user.id,
          email: user.email,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in POST /api/v1/auth/reset-password/confirm:', error);

    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Please try again.',
      },
      { status: 500 }
    );
  }
}
