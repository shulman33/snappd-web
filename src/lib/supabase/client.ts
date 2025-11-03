/**
 * Browser-side Supabase client utility
 *
 * This module provides a browser-side Supabase client for use in:
 * - Client Components
 * - Browser-side JavaScript
 * - Browser extension content scripts
 *
 * IMPORTANT: This client uses the same cookie-based session management as the
 * server client, automatically reading from and writing to `document.cookie`.
 *
 * Security features:
 * - HTTP-only cookies (immune to XSS attacks)
 * - Automatic session refresh
 * - CSRF protection via SameSite cookies
 *
 * @see https://supabase.com/docs/guides/auth/server-side/creating-a-client
 * @see research.md section 2 for implementation details
 */

import { createBrowserClient as createClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

/**
 * Creates a Supabase client configured for browser-side rendering
 *
 * Features:
 * - Automatic cookie-based session management via document.cookie
 * - Real-time subscriptions
 * - Type-safe database access
 * - Seamless session sync with server-side client
 *
 * @returns SupabaseClient - Configured Supabase client
 *
 * @example
 * ```typescript
 * // In a Client Component
 * 'use client';
 *
 * import { createBrowserClient } from '@/lib/supabase/client';
 * import { useEffect, useState } from 'react';
 *
 * export function UserProfile() {
 *   const [user, setUser] = useState(null);
 *   const supabase = createBrowserClient();
 *
 *   useEffect(() => {
 *     const getUser = async () => {
 *       const { data: { user } } = await supabase.auth.getUser();
 *       setUser(user);
 *     };
 *
 *     getUser();
 *   }, []);
 *
 *   return <div>Welcome, {user?.email}</div>;
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Real-time subscription in Client Component
 * 'use client';
 *
 * import { createBrowserClient } from '@/lib/supabase/client';
 * import { useEffect, useState } from 'react';
 *
 * export function Screenshots() {
 *   const [screenshots, setScreenshots] = useState([]);
 *   const supabase = createBrowserClient();
 *
 *   useEffect(() => {
 *     // Initial fetch
 *     const fetchScreenshots = async () => {
 *       const { data } = await supabase
 *         .from('screenshots')
 *         .select('*')
 *         .order('created_at', { ascending: false });
 *       setScreenshots(data || []);
 *     };
 *
 *     fetchScreenshots();
 *
 *     // Subscribe to real-time changes
 *     const subscription = supabase
 *       .channel('screenshots-changes')
 *       .on('postgres_changes', {
 *         event: '*',
 *         schema: 'public',
 *         table: 'screenshots'
 *       }, (payload) => {
 *         if (payload.eventType === 'INSERT') {
 *           setScreenshots(prev => [payload.new, ...prev]);
 *         }
 *         // Handle UPDATE and DELETE events...
 *       })
 *       .subscribe();
 *
 *     return () => {
 *       subscription.unsubscribe();
 *     };
 *   }, []);
 *
 *   return <ul>{screenshots.map(s => <li key={s.id}>{s.original_filename}</li>)}</ul>;
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Authentication state listener
 * 'use client';
 *
 * import { createBrowserClient } from '@/lib/supabase/client';
 * import { useEffect } from 'react';
 * import { useRouter } from 'next/navigation';
 *
 * export function AuthListener() {
 *   const supabase = createBrowserClient();
 *   const router = useRouter();
 *
 *   useEffect(() => {
 *     const {
 *       data: { subscription },
 *     } = supabase.auth.onAuthStateChange((event, session) => {
 *       if (event === 'SIGNED_OUT') {
 *         router.push('/login');
 *       } else if (event === 'SIGNED_IN') {
 *         router.push('/dashboard');
 *       }
 *       // Refresh server-side data
 *       router.refresh();
 *     });
 *
 *     return () => {
 *       subscription.unsubscribe();
 *     };
 *   }, [router]);
 *
 *   return null;
 * }
 * ```
 */
export function createBrowserClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    // No cookie configuration needed - automatically uses document.cookie
  );
}
