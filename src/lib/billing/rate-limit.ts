/**
 * Rate Limiting for Billing Endpoints
 *
 * Implements rate limiting using @upstash/ratelimit to protect billing
 * endpoints from abuse. Configured with different limits for different
 * operation types.
 *
 * Rate Limits:
 * - Payment attempts: 10 per hour per user
 * - Portal access: 30 per hour per user
 * - General billing: 60 per hour per user
 *
 * @see https://upstash.com/docs/redis/sdks/ratelimit-ts/overview
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'

// Initialize Redis client from environment variables
const redis = Redis.fromEnv()

/**
 * Rate limiter for payment-related operations (checkout, subscription changes)
 * Limit: 10 requests per hour
 */
export const paymentRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: '@snappd/billing:payment',
  analytics: true,
})

/**
 * Rate limiter for portal access operations
 * Limit: 30 requests per hour
 */
export const portalRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 h'),
  prefix: '@snappd/billing:portal',
  analytics: true,
})

/**
 * Rate limiter for general billing operations (subscription queries, usage checks)
 * Limit: 60 requests per hour
 */
export const billingRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 h'),
  prefix: '@snappd/billing:general',
  analytics: true,
})

/**
 * Rate limiter for analytics queries (resource-intensive)
 * Limit: 30 requests per hour
 */
export const analyticsRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 h'),
  prefix: '@snappd/billing:analytics',
  analytics: true,
})

/**
 * Rate limiter for webhook endpoint
 * Limit: 100 requests per minute (higher for Stripe retries)
 */
export const webhookRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  prefix: '@snappd/billing:webhook',
  analytics: true,
})

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

/**
 * Check rate limit for a user on a specific limiter
 *
 * @param rateLimiter - The rate limiter to use
 * @param identifier - User ID or IP address
 * @param request - Next.js request for logging
 * @returns Rate limit result
 */
export async function checkRateLimit(
  rateLimiter: Ratelimit,
  identifier: string,
  request?: NextRequest
): Promise<RateLimitResult> {
  try {
    const result = await rateLimiter.limit(identifier)

    if (!result.success) {
      logger.warn('Rate limit exceeded', request, {
        identifier,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
      })
    } else {
      logger.debug('Rate limit check passed', request, {
        identifier,
        remaining: result.remaining,
      })
    }

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch (error) {
    // If rate limiting fails (e.g., Redis unavailable), allow the request
    // but log the error for monitoring
    logger.error('Rate limit check failed', request, {
      identifier,
      error,
    })

    // Fail open - allow request if rate limiting is unavailable
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
    }
  }
}

/**
 * Check rate limit for payment operations
 */
export async function checkPaymentRateLimit(
  userId: string,
  request?: NextRequest
): Promise<RateLimitResult> {
  return checkRateLimit(paymentRateLimiter, userId, request)
}

/**
 * Check rate limit for portal operations
 */
export async function checkPortalRateLimit(
  userId: string,
  request?: NextRequest
): Promise<RateLimitResult> {
  return checkRateLimit(portalRateLimiter, userId, request)
}

/**
 * Check rate limit for general billing operations
 */
export async function checkBillingRateLimit(
  userId: string,
  request?: NextRequest
): Promise<RateLimitResult> {
  return checkRateLimit(billingRateLimiter, userId, request)
}

/**
 * Check rate limit for analytics operations
 */
export async function checkAnalyticsRateLimit(
  userId: string,
  request?: NextRequest
): Promise<RateLimitResult> {
  return checkRateLimit(analyticsRateLimiter, userId, request)
}

/**
 * Check rate limit for webhook endpoint
 * Uses IP address as identifier since webhooks are unauthenticated
 */
export async function checkWebhookRateLimit(
  request: NextRequest
): Promise<RateLimitResult> {
  // Get IP from various headers (Vercel, Cloudflare, etc.)
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    '127.0.0.1'

  return checkRateLimit(webhookRateLimiter, ip, request)
}

/**
 * Generate rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  }
}

/**
 * Calculate retry-after in seconds
 */
export function getRetryAfterSeconds(result: RateLimitResult): number {
  const now = Date.now()
  const resetTime = result.reset
  return Math.max(0, Math.ceil((resetTime - now) / 1000))
}
