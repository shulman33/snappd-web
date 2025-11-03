/**
 * Server-side Supabase client utility
 *
 * This module provides a server-side Supabase client for use in:
 * - Next.js Route Handlers (API routes)
 * - Server Components
 * - Server Actions
 *
 * IMPORTANT: This client uses HTTP-only cookies for secure session management.
 * Always use `getUser()` to validate the session (validates token with Supabase Auth server).
 * NEVER trust `getSession()` in server-side contexts (doesn't revalidate token).
 *
 * @see https://supabase.com/docs/guides/auth/server-side/creating-a-client
 * @see research.md section 2 for implementation details
 */

import { createServerClient as createClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';

/**
 * Creates a Supabase client configured for server-side rendering
 *
 * Features:
 * - Automatic cookie-based session management
 * - Session refresh via middleware
 * - Type-safe database access
 * - Edge runtime compatible
 *
 * @returns Promise<SupabaseClient> - Configured Supabase client
 *
 * @example
 * ```typescript
 * // In a Route Handler
 * export async function GET(request: NextRequest) {
 *   const supabase = await createServerClient();
 *   const { data: { user }, error } = await supabase.auth.getUser();
 *
 *   if (error || !user) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *
 *   return NextResponse.json({ user });
 * }
 * ```
 *
 * @example
 * ```typescript
 * // In a Server Component
 * export default async function ProfilePage() {
 *   const supabase = await createServerClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *
 *   if (!user) {
 *     redirect('/login');
 *   }
 *
 *   const { data: profile } = await supabase
 *     .from('profiles')
 *     .select('*')
 *     .eq('id', user.id)
 *     .single();
 *
 *   return <div>Welcome, {profile?.full_name}</div>;
 * }
 * ```
 */
export async function createServerClient() {
  const cookieStore = await cookies();

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        /**
         * Retrieves all cookies for the current request
         *
         * This function is called by @supabase/ssr to read session data
         * stored in HTTP-only cookies.
         */
        getAll: () => cookieStore.getAll().map(cookie => ({
          name: cookie.name,
          value: cookie.value
        })),

        /**
         * Sets cookies for the response
         *
         * IMPORTANT: This function may throw an error if called after streaming
         * has started in Server Components. This is expected behavior and is
         * handled by the middleware.
         *
         * Cookie updates only happen during these events:
         * - TOKEN_REFRESHED: Access token expired and refreshed
         * - USER_UPDATED: User data modified
         * - SIGNED_OUT: User logged out or session expired
         */
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // Server Components can't set cookies after streaming starts.
            // This is expected and handled by middleware.
            // Middleware will refresh the session on the next request.
          }
        }
      }
    }
  );
}
