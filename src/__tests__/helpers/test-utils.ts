/**
 * Integration Test Utilities
 *
 * Provides reusable helpers and factories for integration tests:
 * - Test user creation with unique identifiers
 * - Database cleanup utilities
 * - Session management for authenticated requests
 * - Test data factories
 *
 * @module test-utils
 */

import { createServiceClient } from '@/lib/supabase/service';

/**
 * Interface for created test user
 */
export interface TestUser {
  id: string;
  email: string;
  password: string;
  fullName?: string;
}

/**
 * Interface for test user with session
 */
export interface TestUserWithSession extends TestUser {
  accessToken: string;
  refreshToken: string;
}

/**
 * Creates a test user with unique email address
 *
 * Uses timestamp and random value to ensure uniqueness across test runs.
 *
 * @param overrides - Optional overrides for user data
 * @returns Promise<TestUser> - Created user data
 *
 * @example
 * ```typescript
 * const user = await createTestUser({
 *   fullName: 'Test User',
 * });
 * ```
 */
export async function createTestUser(overrides: {
  email?: string;
  password?: string;
  fullName?: string;
} = {}): Promise<TestUser> {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);

  const user: TestUser = {
    id: '', // Will be set after creation
    email: overrides.email || `test-${timestamp}-${random}@example.com`,
    password: overrides.password || 'TestPass123!',
    fullName: overrides.fullName,
  };

  return user;
}

/**
 * Creates a test user and signs them up via the API
 *
 * This creates a user through the normal signup flow, not directly in the database.
 * The user will need email verification before signing in.
 *
 * @param baseUrl - Base URL of the application (e.g., 'http://localhost:3000')
 * @param overrides - Optional overrides for user data
 * @returns Promise<TestUser & { id: string }> - Created user data with ID
 */
export async function signupTestUser(
  baseUrl: string,
  overrides: Parameters<typeof createTestUser>[0] = {}
): Promise<TestUser & { id: string }> {
  const userData = await createTestUser(overrides);

  const response = await fetch(`${baseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: userData.email,
      password: userData.password,
      fullName: userData.fullName,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to signup test user: ${JSON.stringify(error)}`);
  }

  const data = await response.json();

  return {
    ...userData,
    id: data.user.id,
  };
}

/**
 * Verifies a test user's email directly in the database (bypass email flow)
 *
 * This is useful for tests that don't focus on the email verification flow itself.
 * It directly updates the email_confirmed_at field in auth.users.
 *
 * @param userId - User ID to verify
 * @returns Promise<void>
 */
export async function verifyTestUserEmail(userId: string): Promise<void> {
  const supabase = createServiceClient();

  // Update the email_confirmed_at field directly using service role
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to verify test user email: ${error.message}`);
  }
}

/**
 * Creates a test user and signs them in, returning a valid session
 *
 * This is a convenience method that:
 * 1. Creates a test user via signup API
 * 2. Verifies their email
 * 3. Signs them in via signin API
 * 4. Returns user data with access token
 *
 * @param baseUrl - Base URL of the application
 * @param overrides - Optional overrides for user data
 * @returns Promise<TestUserWithSession> - User data with session tokens
 */
export async function createAuthenticatedTestUser(
  baseUrl: string,
  overrides: Parameters<typeof createTestUser>[0] = {}
): Promise<TestUserWithSession> {
  // 1. Signup user
  const user = await signupTestUser(baseUrl, overrides);

  // 2. Verify email (bypass email verification flow)
  await verifyTestUserEmail(user.id);

  // 3. Sign in to get session
  const signinResponse = await fetch(`${baseUrl}/api/auth/signin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
    }),
  });

  if (!signinResponse.ok) {
    const error = await signinResponse.json();
    throw new Error(`Failed to signin test user: ${JSON.stringify(error)}`);
  }

  // Extract session cookies from response
  const cookies = signinResponse.headers.get('set-cookie') || '';
  const accessTokenMatch = cookies.match(/sb-[^-]+-auth-token=([^;]+)/);
  const refreshTokenMatch = cookies.match(/sb-[^-]+-auth-token-refresh=([^;]+)/);

  return {
    ...user,
    accessToken: accessTokenMatch?.[1] || '',
    refreshToken: refreshTokenMatch?.[1] || '',
  };
}

/**
 * Cleans up a test user and all associated data
 *
 * Removes:
 * - User from auth.users
 * - Profile from profiles table
 * - All auth_events for the user
 * - Any screenshots and monthly_usage records
 *
 * This is critical for test isolation and preventing test data pollution.
 *
 * @param userId - User ID to clean up
 * @returns Promise<void>
 */
export async function cleanupTestUser(userId: string): Promise<void> {
  const supabase = createServiceClient();

  try {
    // Delete user-related data in order (to respect foreign key constraints)
    // Note: Some deletions may cascade automatically based on database schema

    // 1. Delete screenshots (if any exist)
    await supabase.from('screenshots').delete().eq('user_id', userId);

    // 2. Delete monthly usage records
    await supabase.from('monthly_usage').delete().eq('user_id', userId);

    // 3. Delete auth events
    await supabase.from('auth_events').delete().eq('user_id', userId);

    // 4. Delete profile (should cascade to user in some setups)
    await supabase.from('profiles').delete().eq('id', userId);

    // 5. Delete user from auth.users (using admin API)
    await supabase.auth.admin.deleteUser(userId);
  } catch (error) {
    // Log error but don't throw - cleanup should be best-effort
    console.error(`Error cleaning up test user ${userId}:`, error);
  }
}

/**
 * Cleans up test user by email address
 *
 * Useful when you know the email but not the user ID.
 * Finds the user by email and deletes all associated data.
 *
 * @param email - Email address of user to clean up
 * @returns Promise<void>
 */
export async function cleanupTestUserByEmail(email: string): Promise<void> {
  const supabase = createServiceClient();

  try {
    // Find user by email
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (profile) {
      await cleanupTestUser(profile.id);
    }

    // Also try to find and delete auth events by email (for failed signups)
    await supabase.from('auth_events').delete().eq('email', email);
  } catch (error) {
    console.error(`Error cleaning up test user by email ${email}:`, error);
  }
}

/**
 * Cleans up all test users created during test runs
 *
 * Finds all users with emails matching the test pattern (test-*@example.com)
 * and removes them. Useful for test suite teardown.
 *
 * WARNING: This is a destructive operation. Only use in test environments.
 *
 * @returns Promise<number> - Number of users cleaned up
 */
export async function cleanupAllTestUsers(): Promise<number> {
  const supabase = createServiceClient();

  try {
    // Find all test users
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email')
      .like('email', 'test-%@example.com');

    if (error || !profiles) {
      console.error('Error finding test users:', error);
      return 0;
    }

    // Clean up each test user
    await Promise.all(profiles.map((profile) => cleanupTestUser(profile.id)));

    return profiles.length;
  } catch (error) {
    console.error('Error in cleanupAllTestUsers:', error);
    return 0;
  }
}

/**
 * Waits for a specified duration (for testing async operations)
 *
 * @param ms - Milliseconds to wait
 * @returns Promise<void>
 */
export async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extracts session cookies from response headers
 *
 * @param response - Fetch response object
 * @returns Object with access and refresh tokens
 */
export function extractSessionCookies(response: Response): {
  accessToken: string;
  refreshToken: string;
} {
  const cookies = response.headers.get('set-cookie') || '';
  const accessTokenMatch = cookies.match(/sb-[^-]+-auth-token=([^;]+)/);
  const refreshTokenMatch = cookies.match(/sb-[^-]+-auth-token-refresh=([^;]+)/);

  return {
    accessToken: accessTokenMatch?.[1] || '',
    refreshToken: refreshTokenMatch?.[1] || '',
  };
}

/**
 * Makes an authenticated request with session cookies
 *
 * @param url - URL to request
 * @param options - Fetch options
 * @param sessionCookies - Session cookies from login
 * @returns Promise<Response>
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit,
  sessionCookies: { accessToken: string; refreshToken: string }
): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Cookie: `sb-iitxfjhnywekstxagump-auth-token=${sessionCookies.accessToken}; sb-iitxfjhnywekstxagump-auth-token-refresh=${sessionCookies.refreshToken}`,
    },
  });
}

/**
 * Verifies that auth event was logged
 *
 * @param userId - User ID to check (optional)
 * @param email - Email to check (optional)
 * @param eventType - Type of auth event
 * @returns Promise<boolean> - True if event was logged
 */
export async function verifyAuthEventLogged(
  eventType: string,
  filters: { userId?: string; email?: string }
): Promise<boolean> {
  const supabase = createServiceClient();

  let query = supabase
    .from('auth_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', eventType);

  if (filters.userId) {
    query = query.eq('user_id', filters.userId);
  }

  if (filters.email) {
    query = query.eq('email', filters.email);
  }

  const { count, error } = await query;

  if (error) {
    console.error('Error verifying auth event:', error);
    return false;
  }

  return (count || 0) > 0;
}

/**
 * Gets the count of auth events for a user
 *
 * @param userId - User ID
 * @param eventType - Optional event type to filter by
 * @returns Promise<number> - Count of events
 */
export async function getAuthEventCount(
  userId: string,
  eventType?: string
): Promise<number> {
  const supabase = createServiceClient();

  let query = supabase
    .from('auth_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (eventType) {
    query = query.eq('event_type', eventType);
  }

  const { count, error } = await query;

  if (error) {
    console.error('Error getting auth event count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Gets rate limit failures for an email
 *
 * @param email - Email address
 * @param windowMinutes - Time window in minutes
 * @returns Promise<number> - Count of failures
 */
export async function getRateLimitFailures(
  email: string,
  windowMinutes: number = 15
): Promise<number> {
  const supabase = createServiceClient();
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from('auth_events')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'login_failure')
    .eq('email', email)
    .gte('created_at', windowStart);

  if (error) {
    console.error('Error getting rate limit failures:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Clears rate limit counters for an email (for testing)
 *
 * @param email - Email address
 * @returns Promise<void>
 */
export async function clearRateLimitCounters(email: string): Promise<void> {
  const supabase = createServiceClient();

  // Delete recent login_failure events
  await supabase
    .from('auth_events')
    .delete()
    .eq('event_type', 'login_failure')
    .eq('email', email);
}
