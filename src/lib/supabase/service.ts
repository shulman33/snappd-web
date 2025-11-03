/**
 * Service-role Supabase client utility
 *
 * This module provides a Supabase client with service role permissions for:
 * - Administrative operations that bypass RLS
 * - Logging and auditing (auth_events)
 * - Background jobs and cron tasks
 *
 * IMPORTANT: This client bypasses all Row Level Security policies.
 * Only use for trusted server-side operations. NEVER expose to client.
 *
 * @see https://supabase.com/docs/guides/auth/auth-helpers/nextjs
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

/**
 * Creates a Supabase client with service role permissions
 *
 * This client:
 * - Bypasses ALL Row Level Security policies
 * - Has full read/write access to all tables
 * - Should ONLY be used in server-side contexts
 * - MUST NOT be exposed to client-side code
 *
 * Use cases:
 * - Logging auth events to auth_events table
 * - Administrative user management
 * - Background jobs and scheduled tasks
 * - System-level operations
 *
 * @returns SupabaseClient - Configured Supabase client with service role
 *
 * @example
 * ```typescript
 * // Logging an auth event (bypasses RLS)
 * import { createServiceClient } from '@/lib/supabase/service';
 *
 * const supabase = createServiceClient();
 * await supabase.from('auth_events').insert({
 *   event_type: 'SIGNUP_SUCCESS',
 *   user_id: userId,
 *   // ...
 * });
 * ```
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.'
    );
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
