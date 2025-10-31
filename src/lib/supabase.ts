/**
 * Supabase client singleton for server-side operations
 * Provides both admin (service role) and user (auth-aware) contexts
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Environment validation
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

/**
 * Admin client with service role permissions
 * Use for: database admin operations, RLS bypass, Stripe webhook processing
 * WARNING: Never expose service role key to client
 */
export const supabaseAdmin = createSupabaseClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Create user-context Supabase client for API routes
 * Respects RLS policies based on JWT token
 * 
 * @param accessToken - User's JWT access token from Authorization header
 * @returns Supabase client with user context
 * 
 * @example
 * const token = request.headers.get('authorization')?.replace('Bearer ', '');
 * const supabase = createUserClient(token);
 * const { data } = await supabase.from('screenshots').select('*');
 */
export const createUserClient = (accessToken?: string) => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
  }

  const client = createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: accessToken
          ? {
              Authorization: `Bearer ${accessToken}`,
            }
          : {},
      },
    }
  );

  return client;
};

/**
 * Extract user ID from Supabase JWT token
 * Used for user-specific operations
 * 
 * @param accessToken - User's JWT access token
 * @returns User ID (UUID) or null if invalid
 */
export const getUserIdFromToken = async (accessToken: string): Promise<string | null> => {
  try {
    const { data: { user } } = await createUserClient(accessToken).auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
};

