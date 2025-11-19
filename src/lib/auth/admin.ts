/**
 * Admin authorization utilities
 *
 * Provides helper functions for checking admin role-based access control.
 * Admin role is stored in user.app_metadata.role and can only be set
 * via Supabase admin APIs (cannot be modified by users).
 *
 * To grant admin access:
 * - Supabase Dashboard: Authentication -> Users -> Edit user -> Update app_metadata
 * - Or via service client: supabase.auth.admin.updateUserById(userId, { app_metadata: { role: 'admin' } })
 */

import { User } from '@supabase/supabase-js'

/**
 * Check if a user has admin role
 *
 * @param user - Supabase User object
 * @returns true if user has admin role in app_metadata
 *
 * @example
 * ```typescript
 * import { isAdmin } from '@/lib/auth/admin'
 *
 * const { data: { user } } = await supabase.auth.getUser()
 * if (!isAdmin(user)) {
 *   return ApiErrorHandler.forbidden(...)
 * }
 * ```
 */
export function isAdmin(user: User | null): boolean {
  if (!user) {
    return false
  }

  return user.app_metadata?.role === 'admin'
}

/**
 * Get user role from app_metadata
 *
 * @param user - Supabase User object
 * @returns User role string or undefined if not set
 */
export function getUserRole(user: User | null): string | undefined {
  if (!user) {
    return undefined
  }

  return user.app_metadata?.role as string | undefined
}
