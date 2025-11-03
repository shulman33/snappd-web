/**
 * GET /api/auth/user
 *
 * Get the currently authenticated user's data.
 *
 * Features:
 * - Returns user profile data for authenticated users
 * - Used by browser extension for auth state polling
 * - Validates session token with Supabase Auth
 * - Returns 401 if not authenticated
 *
 * @see specs/005-auth-system/contracts/openapi.yaml
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { AuthErrorHandler, AuthErrorCode, createAuthError } from '@/lib/auth/errors';

/**
 * GET /api/auth/user
 *
 * Retrieve the current user's profile data
 *
 * @param request - Next.js request object
 * @returns NextResponse with user data or error
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Get the current user
    // This validates the session token with Supabase Auth server
    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser();

    // If no user or error, return 401 Unauthorized
    if (getUserError || !user) {
      throw createAuthError(
        AuthErrorCode.UNAUTHORIZED,
        'You must be signed in to access this resource.',
        { status: 401 }
      );
    }

    // Fetch user profile from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, plan, created_at, updated_at')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Failed to fetch user profile:', profileError);

      throw createAuthError(
        AuthErrorCode.INTERNAL_ERROR,
        'An error occurred while fetching user data.',
        { status: 500 }
      );
    }

    // Return user data
    return NextResponse.json(
      {
        user: {
          id: profile.id,
          email: profile.email,
          emailVerified: !!user.email_confirmed_at,
          fullName: profile.full_name,
          plan: profile.plan,
          createdAt: profile.created_at,
        },
      },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // Allow browser extension to access this endpoint
          'Access-Control-Allow-Credentials': 'true',
        },
      }
    );
  } catch (error) {
    return AuthErrorHandler.handle(error, {
      includeDetails: process.env.NODE_ENV !== 'production',
      logContext: { route: 'GET /api/auth/user' },
    });
  }
}
