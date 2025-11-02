/**
 * POST /api/auth/signout
 *
 * Sign out the currently authenticated user.
 *
 * Features:
 * - Terminates the current session via Supabase Auth
 * - Clears session cookies (HTTP-only)
 * - Works across all devices for the same session
 * - Concurrent sessions on other devices remain active
 *
 * @see specs/005-auth-system/contracts/openapi.yaml
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { AuthErrorHandler, AuthErrorCode, createAuthError } from '@/lib/auth/errors';

/**
 * POST /api/auth/signout
 *
 * Sign out the current user and clear their session
 *
 * @param request - Next.js request object
 * @returns NextResponse with success message or error
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Get the current user to verify they're authenticated
    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser();

    // If no user or error getting user, they're not authenticated
    if (getUserError || !user) {
      throw createAuthError(
        AuthErrorCode.UNAUTHORIZED,
        'You must be signed in to sign out.',
        { status: 401 }
      );
    }

    // Sign out the user
    // This invalidates the current session and clears the cookies
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      console.error('Sign out error:', signOutError);

      throw createAuthError(
        AuthErrorCode.INTERNAL_ERROR,
        'An error occurred while signing out. Please try again.',
        { status: 500 }
      );
    }

    // Return success response
    return NextResponse.json(
      {
        message: 'Successfully signed out',
      },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return AuthErrorHandler.handle(error, {
      includeDetails: process.env.NODE_ENV !== 'production',
      logContext: { route: 'POST /api/auth/signout' },
    });
  }
}
