/**
 * Rate Limiting Utilities for Authentication System
 *
 * This module provides rate limiters for different authentication operations
 * using Upstash Redis and the @upstash/ratelimit library with sliding window algorithm.
 *
 * Rate Limiters:
 * - ipRateLimiter: 20 failed attempts per 15 minutes (per IP)
 * - accountRateLimiter: 5 failed attempts per 15 minutes (per account/email)
 * - passwordResetLimiter: 3 requests per hour (per email)
 * - magicLinkLimiter: 5 requests per hour (per email)
 * - verificationLimiter: 3 requests per hour (per email)
 *
 * @see {@link https://upstash.com/docs/oss/sdks/ts/ratelimit/overview}
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Initialize Redis client from environment variables
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 */
const redis = Redis.fromEnv();

/**
 * IP-based rate limiter for authentication endpoints
 * Prevents brute force attacks from a single IP address
 *
 * Limit: 20 failed attempts per 15 minutes
 * Algorithm: Sliding window for smoother rate limiting
 *
 * @example
 * ```typescript
 * const ip = request.headers.get('x-forwarded-for') || request.ip || '127.0.0.1';
 * const { success, limit, remaining, reset } = await ipRateLimiter.limit(ip);
 *
 * if (!success) {
 *   return NextResponse.json(
 *     { error: 'Too many requests from this IP' },
 *     {
 *       status: 429,
 *       headers: {
 *         'X-RateLimit-Limit': limit.toString(),
 *         'X-RateLimit-Remaining': remaining.toString(),
 *         'X-RateLimit-Reset': new Date(reset).toISOString(),
 *         'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
 *       }
 *     }
 *   );
 * }
 * ```
 */
export const ipRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '15 m'),
  analytics: true,
  prefix: 'ratelimit:ip',
});

/**
 * Account-based rate limiter for login attempts
 * Prevents brute force attacks on specific accounts
 *
 * Limit: 5 failed attempts per 15 minutes per email/account
 * Algorithm: Sliding window
 *
 * Use this in conjunction with ipRateLimiter for dual-scope protection
 *
 * @example
 * ```typescript
 * const { email } = await request.json();
 * const { success } = await accountRateLimiter.limit(email);
 *
 * if (!success) {
 *   // Log account_locked event
 *   await logAuthEvent({
 *     event_type: 'account_locked',
 *     email,
 *     ip_address: request.ip,
 *     metadata: { reason: 'Too many failed login attempts' }
 *   });
 *
 *   return NextResponse.json(
 *     {
 *       error: 'ACCOUNT_LOCKED',
 *       message: 'Too many failed login attempts. Your account is temporarily locked for 15 minutes.'
 *     },
 *     { status: 429 }
 *   );
 * }
 * ```
 */
export const accountRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  analytics: true,
  prefix: 'ratelimit:account',
});

/**
 * Password reset rate limiter
 * Prevents abuse of password reset functionality
 *
 * Limit: 3 password reset requests per hour per email
 * Algorithm: Sliding window
 *
 * @example
 * ```typescript
 * const { email } = await request.json();
 * const { success, reset } = await passwordResetLimiter.limit(email);
 *
 * if (!success) {
 *   return NextResponse.json(
 *     {
 *       error: 'RATE_LIMIT_EXCEEDED',
 *       message: 'Too many password reset requests. Please try again later.',
 *       retryAfter: Math.ceil((reset - Date.now()) / 1000)
 *     },
 *     { status: 429 }
 *   );
 * }
 * ```
 */
export const passwordResetLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  analytics: true,
  prefix: 'ratelimit:password-reset',
});

/**
 * Magic link rate limiter
 * Prevents abuse of magic link authentication
 *
 * Limit: 5 magic link requests per hour per email
 * Algorithm: Sliding window
 *
 * @example
 * ```typescript
 * const { email } = await request.json();
 * const { success, remaining } = await magicLinkLimiter.limit(email);
 *
 * if (!success) {
 *   return NextResponse.json(
 *     {
 *       error: 'RATE_LIMIT_EXCEEDED',
 *       message: 'Too many magic link requests. Please try again in an hour.'
 *     },
 *     { status: 429 }
 *   );
 * }
 * ```
 */
export const magicLinkLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  analytics: true,
  prefix: 'ratelimit:magic-link',
});

/**
 * Email verification resend rate limiter
 * Prevents spam from verification email resends
 *
 * Limit: 3 verification email resends per hour per email
 * Algorithm: Sliding window
 *
 * @example
 * ```typescript
 * const { email } = await request.json();
 * const { success } = await verificationLimiter.limit(email);
 *
 * if (!success) {
 *   return NextResponse.json(
 *     {
 *       error: 'RATE_LIMIT_EXCEEDED',
 *       message: 'Too many verification emails sent. Please check your inbox or try again later.'
 *     },
 *     { status: 429 }
 *   );
 * }
 * ```
 */
export const verificationLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  analytics: true,
  prefix: 'ratelimit:verification',
});

/**
 * Screenshot upload rate limiter
 * Prevents abuse of upload functionality
 *
 * Limit: 30 upload initializations per hour per user/IP
 * Algorithm: Sliding window
 *
 * @example
 * ```typescript
 * const identifier = userId || ip;
 * const { success } = await uploadLimiter.limit(identifier);
 *
 * if (!success) {
 *   return NextResponse.json(
 *     {
 *       error: 'RATE_LIMIT_EXCEEDED',
 *       message: 'Too many upload attempts. Please try again later.'
 *     },
 *     { status: 429 }
 *   );
 * }
 * ```
 */
export const uploadLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 h'),
  analytics: true,
  prefix: 'ratelimit:upload',
});

/**
 * Screenshot access rate limiter (public endpoints)
 * Prevents abuse of public screenshot access/viewing
 *
 * Limit: 100 requests per minute per IP
 * Algorithm: Sliding window
 *
 * @example
 * ```typescript
 * const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
 * const { success } = await screenshotAccessLimiter.limit(ip);
 *
 * if (!success) {
 *   return NextResponse.json(
 *     { error: 'Too many requests. Please slow down.' },
 *     { status: 429 }
 *   );
 * }
 * ```
 */
export const screenshotAccessLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  analytics: true,
  prefix: 'ratelimit:screenshot-access',
});

/**
 * Analytics tracking rate limiter
 * Prevents spam on view tracking endpoints
 *
 * Limit: 30 view tracking requests per minute per IP
 * Algorithm: Sliding window
 *
 * @example
 * ```typescript
 * const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
 * const { success } = await analyticsLimiter.limit(ip);
 *
 * if (!success) {
 *   // Still return success but don't track the view
 *   return NextResponse.json({ success: true });
 * }
 * ```
 */
export const analyticsLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  analytics: true,
  prefix: 'ratelimit:analytics',
});

/**
 * Bulk operations rate limiter
 * Prevents abuse of bulk delete/management operations
 *
 * Limit: 10 bulk operations per hour per user
 * Algorithm: Sliding window
 *
 * @example
 * ```typescript
 * const { success } = await bulkOperationLimiter.limit(userId);
 *
 * if (!success) {
 *   return NextResponse.json(
 *     {
 *       error: 'RATE_LIMIT_EXCEEDED',
 *       message: 'Too many bulk operations. Please try again later.'
 *     },
 *     { status: 429 }
 *   );
 * }
 * ```
 */
export const bulkOperationLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  analytics: true,
  prefix: 'ratelimit:bulk-operation',
});

/**
 * Helper type for rate limit result
 */
export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  pending: Promise<unknown>;
};

/**
 * Helper function to format rate limit headers for HTTP responses
 *
 * @param result - Rate limit result from any rate limiter
 * @returns Headers object with standard rate limit headers
 *
 * @example
 * ```typescript
 * const result = await ipRateLimiter.limit(ip);
 * const headers = getRateLimitHeaders(result);
 *
 * return NextResponse.json(data, { headers });
 * ```
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.reset).toISOString(),
    'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString(),
  };
}

/**
 * Helper function to check if rate limit is exceeded and return standardized error response
 *
 * @param identifier - The identifier to check (IP, email, etc.)
 * @param limiter - The rate limiter to use
 * @param errorMessage - Custom error message to return if rate limit exceeded
 * @returns Object with success flag and optional error response
 *
 * @example
 * ```typescript
 * const check = await checkRateLimit(
 *   email,
 *   accountRateLimiter,
 *   'Too many login attempts. Account temporarily locked.'
 * );
 *
 * if (!check.success && check.response) {
 *   return check.response;
 * }
 * ```
 */
export async function checkRateLimit(
  identifier: string,
  limiter: Ratelimit,
  errorMessage: string
): Promise<{ success: boolean; response?: Response; result?: RateLimitResult }> {
  const result = await limiter.limit(identifier) as RateLimitResult;

  if (!result.success) {
    const headers = getRateLimitHeaders(result);

    return {
      success: false,
      response: new Response(
        JSON.stringify({
          error: 'RATE_LIMIT_EXCEEDED',
          message: errorMessage,
          retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
        }
      ),
      result,
    };
  }

  return { success: true, result };
}
