/**
 * Rate limiting middleware using Vercel KV (Redis)
 * Protects API endpoints from abuse
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Skip rate limiting in development if KV is not configured
const isRateLimitEnabled = 
  process.env.KV_REST_API_URL && 
  process.env.KV_REST_API_TOKEN &&
  process.env.NODE_ENV !== 'development';

/**
 * Redis client for rate limiting
 * Skips initialization if KV is not configured
 */
const redis = isRateLimitEnabled
  ? new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
  : null;

/**
 * Rate limiter for upload endpoints
 * Limit: 10 uploads per minute per user
 */
export const uploadRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
      prefix: 'ratelimit:upload',
    })
  : null;

/**
 * Rate limiter for general API endpoints
 * Limit: 100 requests per minute per user
 */
export const apiRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      analytics: true,
      prefix: 'ratelimit:api',
    })
  : null;

/**
 * Check rate limit for a user
 * 
 * @param limiter - Rate limiter instance (uploadRateLimit or apiRateLimit)
 * @param identifier - Unique user identifier (user ID or IP address)
 * @returns { success: boolean, limit: number, remaining: number, reset: number }
 * 
 * @example
 * const { success, remaining } = await checkRateLimit(uploadRateLimit, userId);
 * if (!success) {
 *   throw new RateLimitError();
 * }
 */
export const checkRateLimit = async (
  limiter: Ratelimit | null,
  identifier: string
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> => {
  // Skip rate limiting if disabled (development or KV not configured)
  if (!limiter) {
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
    };
  }

  const result = await limiter.limit(identifier);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
};

/**
 * Add rate limit headers to response
 * 
 * @param headers - Response headers object
 * @param result - Rate limit check result
 */
export const addRateLimitHeaders = (
  headers: Headers,
  result: {
    limit: number;
    remaining: number;
    reset: number;
  }
): void => {
  headers.set('X-RateLimit-Limit', result.limit.toString());
  headers.set('X-RateLimit-Remaining', result.remaining.toString());
  headers.set('X-RateLimit-Reset', result.reset.toString());
};

