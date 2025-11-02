/**
 * Session Management Utilities
 *
 * Provides helper functions for managing user sessions, including session
 * validation, cookie configuration, and session-related operations for
 * authentication flows.
 *
 * @module lib/auth/session
 */

import { cookies } from 'next/headers';
import type { CookieOptions } from 'next/dist/compiled/@edge-runtime/cookies';

/**
 * Session cookie configuration
 *
 * Security features:
 * - HttpOnly: Prevents XSS attacks by making cookie inaccessible to JavaScript
 * - Secure: Only sent over HTTPS in production
 * - SameSite=Lax: CSRF protection while allowing navigation from external sites
 * - Max-Age: 7 days (604800 seconds) - matches Supabase default
 */
export const SESSION_COOKIE_CONFIG: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 604800, // 7 days in seconds
  path: '/',
};

/**
 * Cookie names used by the authentication system
 */
export const COOKIE_NAMES = {
  /** Supabase access token (managed by @supabase/ssr) */
  ACCESS_TOKEN: 'sb-access-token',
  /** Supabase refresh token (managed by @supabase/ssr) */
  REFRESH_TOKEN: 'sb-refresh-token',
  /** User ID for quick session checks */
  USER_ID: 'user-id',
  /** Remember me preference */
  REMEMBER_ME: 'remember-me',
} as const;

/**
 * Session data structure
 */
export interface Session {
  userId: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  expiresAt: string;
}

/**
 * Validate if a session exists and is still valid
 *
 * This is a lightweight check that doesn't require a database call.
 * For full validation, use Supabase's getUser() method.
 *
 * @returns true if session cookies exist, false otherwise
 *
 * @example
 * ```ts
 * import { hasActiveSession } from '@/lib/auth/session';
 *
 * export default async function middleware(request: NextRequest) {
 *   if (!await hasActiveSession()) {
 *     return NextResponse.redirect('/login');
 *   }
 *   return NextResponse.next();
 * }
 * ```
 */
export async function hasActiveSession(): Promise<boolean> {
  const cookieStore = await cookies();

  // Check if Supabase session cookies exist
  const accessToken = cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN);
  const refreshToken = cookieStore.get(COOKIE_NAMES.REFRESH_TOKEN);

  return !!(accessToken && refreshToken);
}

/**
 * Get the current user's ID from session cookie
 *
 * This is a quick check that doesn't validate the session with Supabase.
 * Use this for performance-critical paths where you trust the cookie.
 *
 * @returns User ID if found, null otherwise
 *
 * @example
 * ```ts
 * const userId = await getUserIdFromSession();
 * if (!userId) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 * ```
 */
export async function getUserIdFromSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const userIdCookie = cookieStore.get(COOKIE_NAMES.USER_ID);

  return userIdCookie?.value || null;
}

/**
 * Set the user ID cookie for quick session checks
 *
 * This should be called after successful authentication.
 *
 * @param userId - The user's ID to store
 *
 * @example
 * ```ts
 * // After successful login
 * await setUserIdCookie(user.id);
 * ```
 */
export async function setUserIdCookie(userId: string): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAMES.USER_ID, userId, {
    ...SESSION_COOKIE_CONFIG,
    // User ID cookie doesn't need to be as secure since it's just for quick checks
    httpOnly: true,
  });
}

/**
 * Clear all session-related cookies
 *
 * This should be called during logout to ensure clean session termination.
 * Note: Supabase cookies are managed by @supabase/ssr, this clears app-specific cookies.
 *
 * @example
 * ```ts
 * // During logout
 * await supabase.auth.signOut();
 * await clearSessionCookies();
 * ```
 */
export async function clearSessionCookies(): Promise<void> {
  const cookieStore = await cookies();

  // Clear app-specific cookies
  cookieStore.delete(COOKIE_NAMES.USER_ID);
  cookieStore.delete(COOKIE_NAMES.REMEMBER_ME);

  // Note: Supabase cookies (ACCESS_TOKEN, REFRESH_TOKEN) are managed by @supabase/ssr
  // and are cleared automatically by supabase.auth.signOut()
}

/**
 * Set the "Remember Me" cookie preference
 *
 * When enabled, extends session duration. When disabled, session expires on browser close.
 *
 * @param remember - Whether to remember the user
 *
 * @example
 * ```ts
 * // User checked "Remember Me" checkbox
 * await setRememberMe(true);
 * ```
 */
export async function setRememberMe(remember: boolean): Promise<void> {
  const cookieStore = await cookies();

  if (remember) {
    cookieStore.set(COOKIE_NAMES.REMEMBER_ME, 'true', {
      ...SESSION_COOKIE_CONFIG,
      maxAge: 2592000, // 30 days
    });
  } else {
    cookieStore.set(COOKIE_NAMES.REMEMBER_ME, 'false', {
      ...SESSION_COOKIE_CONFIG,
      maxAge: undefined, // Session cookie (expires on browser close)
    });
  }
}

/**
 * Check if user has "Remember Me" enabled
 *
 * @returns true if remember me is enabled, false otherwise
 */
export async function isRememberMeEnabled(): Promise<boolean> {
  const cookieStore = await cookies();
  const rememberMe = cookieStore.get(COOKIE_NAMES.REMEMBER_ME);

  return rememberMe?.value === 'true';
}

/**
 * Calculate session expiration time
 *
 * @param rememberMe - Whether user selected "Remember Me"
 * @returns ISO 8601 timestamp for session expiration
 *
 * @example
 * ```ts
 * const expiresAt = getSessionExpiration(true);
 * console.log(expiresAt); // "2025-11-09T12:00:00.000Z"
 * ```
 */
export function getSessionExpiration(rememberMe: boolean): string {
  const now = new Date();

  if (rememberMe) {
    // 30 days for "Remember Me"
    now.setDate(now.getDate() + 30);
  } else {
    // 7 days for standard session
    now.setDate(now.getDate() + 7);
  }

  return now.toISOString();
}

/**
 * Check if a session has expired based on its expiration timestamp
 *
 * @param expiresAt - ISO 8601 timestamp
 * @returns true if session has expired, false otherwise
 *
 * @example
 * ```ts
 * const session = await getSession();
 * if (isSessionExpired(session.expiresAt)) {
 *   await refreshSession();
 * }
 * ```
 */
export function isSessionExpired(expiresAt: string): boolean {
  const expirationDate = new Date(expiresAt);
  const now = new Date();

  return now > expirationDate;
}

/**
 * Get cookie options for session management
 *
 * Dynamically adjusts cookie configuration based on environment and user preferences.
 *
 * @param options - Custom options to override defaults
 * @returns Cookie options object
 *
 * @example
 * ```ts
 * const cookieOptions = getCookieOptions({ maxAge: 3600 });
 * cookies().set('my-cookie', 'value', cookieOptions);
 * ```
 */
export function getCookieOptions(options: Partial<CookieOptions> = {}): CookieOptions {
  return {
    ...SESSION_COOKIE_CONFIG,
    ...options,
  };
}

/**
 * Session duration constants (in seconds)
 */
export const SESSION_DURATIONS = {
  /** Standard session: 7 days */
  STANDARD: 604800,
  /** Remember me session: 30 days */
  EXTENDED: 2592000,
  /** Short-lived session for sensitive operations: 1 hour */
  SHORT: 3600,
  /** Browser session (expires on close) */
  BROWSER: undefined,
} as const;

/**
 * Validate session timestamp format
 *
 * @param timestamp - ISO 8601 timestamp string
 * @returns true if valid, false otherwise
 */
export function isValidSessionTimestamp(timestamp: string): boolean {
  const date = new Date(timestamp);
  return !isNaN(date.getTime()) && date.toISOString() === timestamp;
}

/**
 * Format session expiration time for display
 *
 * @param expiresAt - ISO 8601 timestamp
 * @returns Human-readable expiration time
 *
 * @example
 * ```ts
 * const formatted = formatSessionExpiration("2025-11-09T12:00:00.000Z");
 * console.log(formatted); // "Expires in 7 days"
 * ```
 */
export function formatSessionExpiration(expiresAt: string): string {
  const expirationDate = new Date(expiresAt);
  const now = new Date();
  const diffMs = expirationDate.getTime() - now.getTime();

  if (diffMs < 0) {
    return 'Expired';
  }

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffDays > 0) {
    return `Expires in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  }

  if (diffHours > 0) {
    return `Expires in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  }

  return `Expires in ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
}
