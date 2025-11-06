/**
 * Next.js Edge Middleware
 *
 * This middleware runs at the edge for every request and handles:
 * 1. Request ID generation and injection (for log correlation)
 * 2. Session token refresh (automatic token renewal)
 * 3. Protected route authentication checks
 * 4. IP-based rate limiting for /api/auth/* routes (with graceful degradation)
 * 5. Proper error responses with retry headers
 * 6. CORS headers for browser extension support
 *
 * Rate Limiting Strategy:
 * - Fails open if Redis is unavailable (maintains service availability)
 * - Logs Redis connection failures for monitoring/alerting
 * - Rate limiting is defense-in-depth; authentication still enforced
 *
 * @see {@link https://nextjs.org/docs/app/building-your-application/routing/middleware}
 */

import { NextRequest, NextResponse, NextFetchEvent } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { ipRateLimiter } from '@/lib/auth/rate-limit';
import { updateSession } from '@/lib/supabase/middleware';
import type { Database } from '@/types/supabase';

/**
 * Protected routes that require authentication
 */
const protectedRoutes = ['/dashboard', '/settings'];

/**
 * Protected API routes that require authentication
 * Note: Some /api/screenshots routes are public (like /access and /verify-password)
 */
const protectedApiRoutes = [
  '/api/screenshots', // Base route for listing user screenshots
  '/api/user/usage'
];

/**
 * Public API routes that should NOT require authentication
 */
const publicApiRoutes = [
  '/api/screenshots/[shortId]/access',
  '/api/screenshots/[shortId]/verify-password'
];

/**
 * Public routes that authenticated users should be redirected away from
 */
const authRoutes = ['/login', '/signup'];

/**
 * Generate a unique request ID for log correlation
 * Reuses existing ID from load balancer/proxy if present
 */
function generateRequestId(): string {
  return `req-${crypto.randomUUID()}`;
}

/**
 * Middleware function that runs on every request
 *
 * Order of operations:
 * 1. Generate or reuse request ID (for log correlation)
 * 2. Update session (refresh token if needed)
 * 3. Check protected routes and redirect if unauthenticated
 * 4. Apply IP-based rate limiting to auth endpoints
 * 5. Add CORS headers for browser extension support
 * 6. Inject request ID into response headers
 *
 * @param request - The incoming Next.js request object
 * @param event - The Next.js fetch event for handling background operations
 */
export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  // =========================================================================
  // Step 0: Generate or reuse request ID for log correlation
  // =========================================================================
  // Check if request already has an ID (from load balancer/proxy)
  let requestId = request.headers.get('x-request-id');
  if (!requestId) {
    requestId = generateRequestId();
  }

  // Clone request headers and add request ID
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  // =========================================================================
  // Step 1: Update session (refresh token if expired)
  // =========================================================================
  // This MUST happen first to ensure the session is current
  // Skip session update for static files and _next routes
  if (
    !pathname.startsWith('/_next/') &&
    !pathname.startsWith('/api/_next') &&
    !pathname.match(/\.(ico|png|jpg|jpeg|gif|svg|webp)$/)
  ) {
    // Create a new request with the updated headers (including request ID)
    const requestWithHeaders = new NextRequest(request, {
      headers: requestHeaders,
    });

    const supabaseResponse = await updateSession(requestWithHeaders);

    // Inject request ID into response headers for client correlation
    supabaseResponse.headers.set('x-request-id', requestId);

    // =========================================================================
    // Step 2: Protected route checks
    // =========================================================================

    // Check if this is a public API route that should bypass auth
    const isPublicApiRoute = publicApiRoutes.some((route) => {
      // Convert Next.js dynamic route pattern to regex
      const pattern = route.replace(/\[([^\]]+)\]/g, '[^/]+')
      const regex = new RegExp(`^${pattern}$`)
      return regex.test(pathname)
    })

    // Check protected routes
    const isProtectedRoute = protectedRoutes.some((route) =>
      pathname.startsWith(route)
    )

    // Check protected API routes (but exclude public API routes)
    const isProtectedApiRoute = !isPublicApiRoute && protectedApiRoutes.some((route) =>
      pathname.startsWith(route)
    )

    const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route))

    // Check if user is authenticated using Supabase's getUser() API
    // This is the recommended approach per Supabase documentation
    // Avoids fragile cookie name parsing and handles all edge cases
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll().map(cookie => ({
            name: cookie.name,
            value: cookie.value
          })),
          setAll: () => {}, // No-op, cookies already set by updateSession
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    const hasSession = !!user;

    // Redirect unauthenticated users from protected routes to login
    if ((isProtectedRoute || isProtectedApiRoute) && !hasSession) {
      const redirectUrl = new URL('/login', request.url);
      // Preserve the original URL for redirect after login
      redirectUrl.searchParams.set('redirect', pathname);
      const redirectResponse = NextResponse.redirect(redirectUrl);
      redirectResponse.headers.set('x-request-id', requestId);
      return redirectResponse;
    }

    // Redirect authenticated users from auth routes to dashboard
    if (isAuthRoute && hasSession) {
      const redirectResponse = NextResponse.redirect(new URL('/dashboard', request.url));
      redirectResponse.headers.set('x-request-id', requestId);
      return redirectResponse;
    }

    // If not an auth route, continue with the supabase response
    if (!pathname.startsWith('/api/auth/')) {
      return supabaseResponse;
    }
  }

  // Apply rate limiting to all /api/auth/* routes
  if (pathname.startsWith('/api/auth/')) {
    // Extract IP address (prioritize X-Forwarded-For header for proxied requests)
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    // Check IP rate limit with graceful degradation
    // If Redis is unavailable, fail open (allow requests through) rather than
    // blocking all authentication attempts. Rate limiting is defense-in-depth;
    // the actual authentication layer still provides security.
    let rateLimitResult;
    try {
      rateLimitResult = await ipRateLimiter.limit(ip);
    } catch (error) {
      // Log the Redis connection failure for monitoring/alerting
      console.error('[Rate Limiter] Redis connection failed - failing open:', {
        error: error instanceof Error ? error.message : String(error),
        ip,
        timestamp: new Date().toISOString(),
      });

      // Fail open: allow the request through with default values
      // This maintains service availability during Redis outages
      rateLimitResult = {
        success: true,
        limit: 20, // Match the configured limit for consistency
        remaining: 20,
        reset: Date.now() + 15 * 60 * 1000, // 15 minutes from now
        pending: Promise.resolve(),
      };
    }

    const { success, limit, remaining, reset, pending } = rateLimitResult;

    // Handle pending analytics (required when analytics: true)
    // Use NextFetchEvent.waitUntil() to properly manage the promise lifecycle
    // This ensures analytics are submitted without blocking the response
    // and prevents memory leaks from unhandled promises
    event.waitUntil(pending);

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
            'x-request-id': requestId,
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
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    response.headers.set('x-request-id', requestId);
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

  // For non-auth routes, pass through with request ID
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set('x-request-id', requestId);
  return response;
}

/**
 * Middleware configuration
 *
 * Matcher specifies which routes this middleware should run on.
 * We apply it to:
 * 1. All routes for session management and protected route checks
 * 2. /api/auth/* routes for rate limiting
 *
 * Note: We exclude static files, images, and Next.js internal routes
 * for performance optimization.
 */
export const config = {
  matcher: [
    /*
     * Match all routes except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (static files)
     * - Image files (.png, .jpg, .jpeg, .gif, .svg, .webp, .ico)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
