/**
 * Next.js Edge Middleware
 *
 * This middleware runs at the edge for every request and handles:
 * 1. IP-based rate limiting for /api/auth/* routes
 * 2. Proper error responses with retry headers
 * 3. CORS headers for browser extension support
 *
 * @see {@link https://nextjs.org/docs/app/building-your-application/routing/middleware}
 */

import { NextRequest, NextResponse } from 'next/server';
import { ipRateLimiter } from '@/lib/auth/rate-limit';

/**
 * Middleware function that runs on every request
 *
 * Applies IP-based rate limiting to all /api/auth/* endpoints to prevent
 * brute force attacks and abuse. Returns 429 Too Many Requests if limit exceeded.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Apply rate limiting to all /api/auth/* routes
  if (pathname.startsWith('/api/auth/')) {
    // Extract IP address (prioritize X-Forwarded-For header for proxied requests)
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    // Check IP rate limit
    const { success, limit, remaining, reset, pending } = await ipRateLimiter.limit(ip);

    // Handle pending analytics (required when analytics: true)
    // In edge runtime, we don't have access to context.waitUntil,
    // but the promise will be handled automatically
    if (pending) {
      // Pending promise for analytics submission
      // This is fire-and-forget in edge runtime
      pending.catch((err) => {
        console.error('Failed to submit rate limit analytics:', err);
      });
    }

    // If rate limit exceeded, return 429 with appropriate headers
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);

      return NextResponse.json(
        {
          error: 'RATE_LIMIT_EXCEEDED',
          message:
            'Your IP has been temporarily blocked due to too many requests. Please try again later.',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': new Date(reset).toISOString(),
            'Retry-After': retryAfter.toString(),
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // If rate limit passed, add rate limit headers to the response
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', limit.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', new Date(reset).toISOString());

    // Add CORS headers for browser extension support
    const origin = request.headers.get('origin');

    if (origin) {
      // Allow requests from web app and browser extensions
      const allowedOrigins = [
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        // Chrome extension protocol
        /^chrome-extension:\/\/.+$/,
        // Firefox extension protocol
        /^moz-extension:\/\/.+$/,
      ];

      const isAllowed = allowedOrigins.some((allowed) => {
        if (typeof allowed === 'string') {
          return origin === allowed;
        }
        return allowed.test(origin);
      });

      if (isAllowed) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Access-Control-Allow-Credentials', 'true');
        response.headers.set(
          'Access-Control-Allow-Methods',
          'GET, POST, PUT, PATCH, DELETE, OPTIONS'
        );
        response.headers.set(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, X-Requested-With'
        );
        response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
      }
    }

    // Handle preflight OPTIONS requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: response.headers,
      });
    }

    return response;
  }

  // For non-auth routes, just pass through
  return NextResponse.next();
}

/**
 * Middleware configuration
 *
 * Matcher specifies which routes this middleware should run on.
 * We apply it to all /api/auth/* routes for rate limiting.
 *
 * Note: We exclude static files, images, and Next.js internal routes
 * for performance optimization.
 */
export const config = {
  matcher: [
    /*
     * Match all /api/auth/* routes
     * Exclude:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (static files)
     */
    '/api/auth/:path*',
  ],
};
