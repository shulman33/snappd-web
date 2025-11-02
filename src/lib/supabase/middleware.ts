/**
 * Supabase middleware helper for session token refresh
 *
 * This module provides middleware functionality for automatic token refresh.
 * It MUST be used in Next.js middleware to ensure sessions remain active.
 *
 * CRITICAL: Without this middleware, sessions will expire and users will be
 * logged out unexpectedly. This middleware:
 * - Refreshes expired access tokens automatically
 * - Updates session cookies with new tokens
 * - Validates the session on every request
 *
 * @see https://supabase.com/docs/guides/auth/server-side/creating-a-client
 * @see research.md section 2 for implementation details
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/supabase';

/**
 * Updates the user's session by refreshing the token if needed
 *
 * This function:
 * 1. Creates a Supabase client with cookie access
 * 2. Calls `getUser()` which triggers token refresh if expired
 * 3. Updates cookies with new tokens via Set-Cookie headers
 * 4. Returns a response with updated cookies
 *
 * Cookie updates occur during these auth state changes:
 * - TOKEN_REFRESHED: Access token expired and was refreshed
 * - USER_UPDATED: User data was modified
 * - SIGNED_OUT: User logged out or session expired
 *
 * @param request - The incoming Next.js request
 * @returns NextResponse with updated session cookies
 *
 * @example
 * ```typescript
 * // src/app/middleware.ts
 * import { updateSession } from '@/lib/supabase/middleware';
 * import { NextRequest } from 'next/server';
 *
 * export async function middleware(request: NextRequest) {
 *   // Update session (refreshes token if needed)
 *   const response = await updateSession(request);
 *
 *   // Add additional middleware logic here if needed
 *   // (e.g., rate limiting, auth checks, redirects)
 *
 *   return response;
 * }
 *
 * export const config = {
 *   matcher: [
 *     // Apply to all routes except static files
 *     '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
 *   ],
 * };
 * ```
 *
 * @example
 * ```typescript
 * // src/app/middleware.ts with protected routes
 * import { updateSession } from '@/lib/supabase/middleware';
 * import { NextRequest, NextResponse } from 'next/server';
 *
 * const protectedRoutes = ['/dashboard', '/settings', '/api/screenshots'];
 * const publicRoutes = ['/login', '/signup', '/'];
 *
 * export async function middleware(request: NextRequest) {
 *   // Update session first
 *   const response = await updateSession(request);
 *
 *   // Check if route is protected
 *   const path = request.nextUrl.pathname;
 *   const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));
 *   const isPublicRoute = publicRoutes.includes(path);
 *
 *   // Get user from the response
 *   const supabase = createServerClient<Database>(
 *     process.env.NEXT_PUBLIC_SUPABASE_URL!,
 *     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
 *     {
 *       cookies: {
 *         getAll: () => request.cookies.getAll().map(cookie => ({
 *           name: cookie.name,
 *           value: cookie.value
 *         })),
 *         setAll: () => {}, // No-op, cookies already set by updateSession
 *       },
 *     }
 *   );
 *
 *   const { data: { user } } = await supabase.auth.getUser();
 *
 *   // Redirect unauthenticated users from protected routes
 *   if (isProtectedRoute && !user) {
 *     return NextResponse.redirect(new URL('/login', request.url));
 *   }
 *
 *   // Redirect authenticated users from public routes to dashboard
 *   if (isPublicRoute && user && path !== '/') {
 *     return NextResponse.redirect(new URL('/dashboard', request.url));
 *   }
 *
 *   return response;
 * }
 * ```
 */
export async function updateSession(request: NextRequest) {
  // Create a response that will include updated cookies
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Create Supabase client with cookie access
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        /**
         * Read all cookies from the incoming request
         */
        getAll: () => {
          return request.cookies.getAll().map(cookie => ({
            name: cookie.name,
            value: cookie.value
          }));
        },

        /**
         * Set cookies on both the request and response
         *
         * This ensures:
         * 1. Request cookies are updated for subsequent middleware/route handlers
         * 2. Response Set-Cookie headers are sent to the browser
         */
        setAll: (cookiesToSet) => {
          // Update request cookies (for server-side access in this request)
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          // Create new response with updated cookies
          supabaseResponse = NextResponse.next({
            request,
          });

          // Set cookies on response (for browser)
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  /**
   * CRITICAL: This call to getUser() is what triggers token refresh
   *
   * When the access token is expired, this will:
   * 1. Call POST /token?grant_type=refresh_token to Supabase Auth
   * 2. Receive new access_token and refresh_token
   * 3. Trigger onAuthStateChange with TOKEN_REFRESHED event
   * 4. Call setAll() to update cookies with new tokens
   *
   * Without this call, expired sessions would not be refreshed automatically.
   */
  await supabase.auth.getUser();

  return supabaseResponse;
}
