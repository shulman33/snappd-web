/**
 * Authentication Event Logging Helper
 *
 * Provides utilities for logging authentication events to the auth_events table
 * for audit trails, security monitoring, and rate limiting enforcement.
 *
 * @module lib/auth/logger
 */

import { createServiceClient } from '@/lib/supabase/service';

/**
 * Authentication event types
 *
 * These correspond to the event_type column in the auth_events table
 * and are used for security monitoring and rate limiting.
 */
export enum AuthEventType {
  // Login events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',

  // Signup events
  SIGNUP_SUCCESS = 'signup_success',
  SIGNUP_FAILURE = 'signup_failure',

  // Password events
  PASSWORD_RESET = 'password_reset',
  PASSWORD_CHANGED = 'password_changed',

  // Email verification events
  EMAIL_VERIFIED = 'email_verified',
  VERIFICATION_RESEND = 'verification_resend',

  // Magic link events
  MAGIC_LINK_SENT = 'magic_link_sent',
  MAGIC_LINK_USED = 'magic_link_used',

  // Account security events
  ACCOUNT_LOCKED = 'account_locked',
  IP_BLOCKED = 'ip_blocked',

  // OAuth events
  OAUTH_LINKED = 'oauth_linked',
  OAUTH_UNLINKED = 'oauth_unlinked',

  // Account management events
  ACCOUNT_DELETED = 'account_deleted',
  PROFILE_UPDATED = 'profile_updated',
}

/**
 * Authentication event data structure
 */
export interface AuthEvent {
  /** Type of authentication event */
  eventType: AuthEventType;
  /** User ID (if authenticated) - nullable for IP-only events */
  userId?: string | null;
  /** Email address involved in the event */
  email?: string | null;
  /** IP address of the request */
  ipAddress: string;
  /** User agent string from the request */
  userAgent?: string | null;
  /** Additional event-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Event metadata types for type-safe logging
 */
export interface AuthEventMetadata {
  [AuthEventType.LOGIN_SUCCESS]: {
    method: 'password' | 'oauth' | 'magic_link';
  };

  [AuthEventType.LOGIN_FAILURE]: {
    reason: 'invalid_credentials' | 'unverified_email' | 'account_locked';
  };

  [AuthEventType.SIGNUP_SUCCESS]: {
    method: 'email' | 'oauth';
  };

  [AuthEventType.SIGNUP_FAILURE]: {
    reason: 'email_exists' | 'validation_error' | 'profile_creation_failed';
  };

  [AuthEventType.PASSWORD_RESET]: {
    reset_token_sent: boolean;
    email_delivery_attempts?: number;
  };

  [AuthEventType.PASSWORD_CHANGED]: {
    method: 'reset' | 'user_initiated';
  };

  [AuthEventType.EMAIL_VERIFIED]: {
    verification_method: 'link' | 'code';
  };

  [AuthEventType.MAGIC_LINK_SENT]: {
    expires_at: string;
  };

  [AuthEventType.MAGIC_LINK_USED]: {
    link_age_seconds: number;
  };

  [AuthEventType.ACCOUNT_LOCKED]: {
    failed_attempts: number;
    locked_until: string;
  };

  [AuthEventType.IP_BLOCKED]: {
    failed_attempts: number;
    blocked_until: string;
  };

  [AuthEventType.OAUTH_LINKED]: {
    provider: 'google' | 'github';
  };

  [AuthEventType.OAUTH_UNLINKED]: {
    provider: 'google' | 'github';
  };

  [AuthEventType.ACCOUNT_DELETED]: {
    deletion_reason?: string;
  };

  [AuthEventType.PROFILE_UPDATED]: {
    fields_changed: string[];
  };
}

/**
 * Authentication Event Logger
 *
 * Centralized logging for all authentication events with Supabase integration.
 */
export class AuthEventLogger {
  /**
   * Log an authentication event to the database
   *
   * @param event - The authentication event to log
   * @returns Promise that resolves when event is logged
   *
   * @example
   * ```ts
   * await AuthEventLogger.log({
   *   eventType: AuthEventType.LOGIN_SUCCESS,
   *   userId: user.id,
   *   email: user.email,
   *   ipAddress: request.ip || '127.0.0.1',
   *   userAgent: request.headers.get('user-agent'),
   *   metadata: { method: 'password' },
   * });
   * ```
   */
  static async log(event: AuthEvent): Promise<void> {
    try {
      const supabase = createServiceClient();

      const { error } = await supabase.from('auth_events').insert({
        event_type: event.eventType,
        user_id: event.userId || null,
        email: event.email || null,
        ip_address: event.ipAddress,
        user_agent: event.userAgent || null,
        metadata: (event.metadata || {}) as any,
        created_at: new Date().toISOString(),
      });

      if (error) {
        // Log error but don't throw - we don't want auth operations to fail due to logging issues
        console.error('Failed to log auth event:', error);
      }
    } catch (error) {
      // Catch all errors to prevent logging failures from breaking auth flows
      console.error('Error in auth event logging:', error);
    }
  }

  /**
   * Log a successful login event
   *
   * @param userId - The user's ID
   * @param email - The user's email
   * @param ipAddress - Request IP address
   * @param method - Authentication method used
   * @param userAgent - User agent string
   */
  static async logLoginSuccess(
    userId: string,
    email: string,
    ipAddress: string,
    method: 'password' | 'oauth' | 'magic_link',
    userAgent?: string
  ): Promise<void> {
    await this.log({
      eventType: AuthEventType.LOGIN_SUCCESS,
      userId,
      email,
      ipAddress,
      userAgent,
      metadata: { method },
    });
  }

  /**
   * Log a failed login attempt
   *
   * @param email - The email used in the attempt
   * @param ipAddress - Request IP address
   * @param reason - Reason for failure
   * @param userAgent - User agent string
   */
  static async logLoginFailure(
    email: string,
    ipAddress: string,
    reason: 'invalid_credentials' | 'unverified_email' | 'account_locked',
    userAgent?: string
  ): Promise<void> {
    await this.log({
      eventType: AuthEventType.LOGIN_FAILURE,
      email,
      ipAddress,
      userAgent,
      metadata: { reason },
    });
  }

  /**
   * Log an account lockout event
   *
   * @param userId - The user's ID (if known)
   * @param email - The user's email
   * @param ipAddress - Request IP address
   * @param failedAttempts - Number of failed attempts
   * @param lockedUntil - ISO timestamp when lock expires
   * @param userAgent - User agent string
   */
  static async logAccountLocked(
    userId: string | undefined,
    email: string,
    ipAddress: string,
    failedAttempts: number,
    lockedUntil: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      eventType: AuthEventType.ACCOUNT_LOCKED,
      userId: userId || null,
      email,
      ipAddress,
      userAgent,
      metadata: {
        failed_attempts: failedAttempts,
        locked_until: lockedUntil,
      },
    });
  }

  /**
   * Log an IP block event
   *
   * @param ipAddress - The blocked IP address
   * @param failedAttempts - Number of failed attempts
   * @param blockedUntil - ISO timestamp when block expires
   * @param userAgent - User agent string
   */
  static async logIpBlocked(
    ipAddress: string,
    failedAttempts: number,
    blockedUntil: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      eventType: AuthEventType.IP_BLOCKED,
      ipAddress,
      userAgent,
      metadata: {
        failed_attempts: failedAttempts,
        blocked_until: blockedUntil,
      },
    });
  }

  /**
   * Query recent failed login attempts for rate limiting
   *
   * @param email - Email address to check
   * @param windowMinutes - Time window in minutes (default: 15)
   * @returns Number of failed attempts within the window
   *
   * @example
   * ```ts
   * const failedAttempts = await AuthEventLogger.getFailedLoginAttempts('user@example.com', 15);
   * if (failedAttempts >= 5) {
   *   // Lock account
   * }
   * ```
   */
  static async getFailedLoginAttempts(
    email: string,
    windowMinutes: number = 15
  ): Promise<number> {
    try {
      const supabase = createServiceClient();
      const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

      const { count, error } = await supabase
        .from('auth_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', AuthEventType.LOGIN_FAILURE)
        .eq('email', email)
        .gte('created_at', windowStart);

      if (error) {
        console.error('Error querying failed login attempts:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in getFailedLoginAttempts:', error);
      return 0;
    }
  }

  /**
   * Query recent failed attempts by IP address
   *
   * @param ipAddress - IP address to check
   * @param windowMinutes - Time window in minutes (default: 15)
   * @returns Number of failed attempts within the window
   */
  static async getFailedAttemptsByIp(
    ipAddress: string,
    windowMinutes: number = 15
  ): Promise<number> {
    try {
      const supabase = createServiceClient();
      const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

      const { count, error } = await supabase
        .from('auth_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', AuthEventType.LOGIN_FAILURE)
        .eq('ip_address', ipAddress)
        .gte('created_at', windowStart);

      if (error) {
        console.error('Error querying failed attempts by IP:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in getFailedAttemptsByIp:', error);
      return 0;
    }
  }

  /**
   * Check if account is locked based on recent failed attempts
   *
   * @param email - Email address to check
   * @param threshold - Number of attempts before lockout (default: 5)
   * @param windowMinutes - Time window in minutes (default: 15)
   * @returns True if account should be locked
   */
  static async isAccountLocked(
    email: string,
    threshold: number = 5,
    windowMinutes: number = 15
  ): Promise<boolean> {
    const failedAttempts = await this.getFailedLoginAttempts(email, windowMinutes);
    return failedAttempts >= threshold;
  }

  /**
   * Check if IP is blocked based on recent failed attempts
   *
   * @param ipAddress - IP address to check
   * @param threshold - Number of attempts before block (default: 20)
   * @param windowMinutes - Time window in minutes (default: 15)
   * @returns True if IP should be blocked
   */
  static async isIpBlocked(
    ipAddress: string,
    threshold: number = 20,
    windowMinutes: number = 15
  ): Promise<boolean> {
    const failedAttempts = await this.getFailedAttemptsByIp(ipAddress, windowMinutes);
    return failedAttempts >= threshold;
  }

  /**
   * Get recent authentication events for a user
   *
   * @param userId - User ID
   * @param limit - Maximum number of events to return (default: 50)
   * @returns Array of authentication events
   */
  static async getUserEvents(userId: string, limit: number = 50) {
    try {
      const supabase = createServiceClient();

      const { data, error } = await supabase
        .from('auth_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching user events:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserEvents:', error);
      return [];
    }
  }
}

/**
 * Helper function to extract IP address from Next.js request
 *
 * @param request - Next.js request object or headers
 * @returns IP address or fallback
 *
 * @example
 * ```ts
 * import { NextRequest } from 'next/server';
 *
 * export async function POST(request: NextRequest) {
 *   const ipAddress = getIpAddress(request);
 *   // Use for logging...
 * }
 * ```
 */
export function getIpAddress(request: {
  ip?: string;
  headers: { get(name: string): string | null };
}): string {
  // Try to get real IP from headers (for proxied requests)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to request.ip or localhost
  return request.ip || '127.0.0.1';
}

/**
 * Helper function to safely get user agent from request
 *
 * @param request - Next.js request object or headers
 * @returns User agent string or null
 */
export function getUserAgent(request: {
  headers: { get(name: string): string | null };
}): string | null {
  return request.headers.get('user-agent');
}
