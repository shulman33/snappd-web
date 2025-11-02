# Research: Authentication System Technologies

**Feature**: Comprehensive Authentication System
**Date**: 2025-11-02
**Phase**: 0 (Research & Discovery)

## Purpose

This document consolidates research findings for implementing the authentication system using Next.js 15 App Router, Supabase Auth, and related technologies. All "NEEDS CLARIFICATION" items from the Technical Context section have been resolved through this research.

---

## 1. Next.js 15 App Router & Route Handlers

### Decision
Use **Next.js 15.5.5 App Router with Route Handlers** for all authentication API endpoints.

### Rationale
- **Modern Standard**: Next.js 15 App Router is the recommended approach for new applications
- **Route Handlers**: Replace Pages Router API Routes with better TypeScript support and Web standards
- **Edge Runtime Compatible**: Supports deployment to Vercel Edge Functions for global low-latency
- **Server-Side Rendering**: Built-in SSR support critical for secure auth cookie management
- **Middleware Support**: Native middleware for auth checks and rate limiting at the edge

### Key Patterns from Research

#### Route Handler Structure
```typescript
// src/app/api/auth/signin/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Request body parsing
  const body = await request.json();

  // Validation
  const validatedData = schema.parse(body);

  // Business logic
  const result = await performAuth(validatedData);

  // Response
  return NextResponse.json(result, { status: 200 });
}
```

#### Middleware for Auth Protection
```typescript
// src/app/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/auth/session';
import { cookies } from 'next/headers';

const protectedRoutes = ['/dashboard', '/api/screenshots'];
const publicRoutes = ['/login', '/signup', '/'];

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));
  const isPublicRoute = publicRoutes.includes(path);

  // Decrypt session from cookie
  const cookie = (await cookies()).get('session')?.value;
  const session = await decrypt(cookie);

  // Redirect logic
  if (isProtectedRoute && !session?.userId) {
    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }

  if (isPublicRoute && session?.userId && !path.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)']
};
```

### Alternatives Considered
1. **Pages Router API Routes**: Older pattern, not recommended for new apps
2. **Server Actions**: Not suitable for REST API endpoints that need to be consumed by browser extension
3. **External API (Express/Fastify)**: Adds infrastructure complexity, violates constitution's simplicity requirement

### Implementation Notes
- Use `NextRequest` and `NextResponse` for type safety
- Leverage `cookies()` helper from `next/headers` for cookie management
- Edge runtime compatible (no Node.js-specific APIs like `fs`)
- Middleware runs before requests reach Route Handlers

---

## 2. Supabase Auth with Server-Side Rendering

### Decision
Use **@supabase/ssr package with HTTP-only cookies** for session management.

### Rationale
- **Official SSR Support**: `@supabase/ssr` is the official package for Next.js SSR auth
- **Security**: HTTP-only cookies immune to XSS attacks (cannot be accessed by JavaScript)
- **Browser Extension Compatible**: Cookies work across web and extension with proper CORS setup
- **Session Refresh**: Built-in automatic token refresh in middleware
- **Framework-Agnostic Core**: Can be used in other SSR frameworks if needed

### Key Patterns from Research

#### Server Client (for Route Handlers, Server Components)
```typescript
// src/lib/supabase/server.ts
import { createServerClient as createClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerClient() {
  const cookieStore = await cookies();

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll().map(cookie => ({
          name: cookie.name,
          value: cookie.value
        })),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // Server Components can't set cookies after streaming starts
            // This is expected and handled by middleware
          }
        }
      }
    }
  );
}
```

#### Browser Client (for Client Components)
```typescript
// src/lib/supabase/client.ts
import { createBrowserClient as createClient } from '@supabase/ssr';

export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  // Automatically uses document.cookie
}
```

#### Middleware for Token Refresh
```typescript
// src/lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => {
          return request.cookies.getAll().map(cookie => ({
            name: cookie.name,
            value: cookie.value
          }));
        },
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // IMPORTANT: Refresh the auth token
  // This triggers TOKEN_REFRESHED event if token is expired
  const { data: { user } } = await supabase.auth.getUser();

  return supabaseResponse;
}
```

### Critical Security Notes
- **ALWAYS use `getUser()`** for auth checks (validates token with Supabase Auth server)
- **NEVER trust `getSession()`** in Server Components (doesn't revalidate token)
- **Middleware MUST refresh tokens** using `getUser()` to keep sessions alive
- Cookie security flags: `HttpOnly`, `Secure`, `SameSite=Lax`

### Alternatives Considered
1. **Local Storage**: Vulnerable to XSS attacks, not suitable for secure auth
2. **Session Storage**: Doesn't persist across tabs, poor UX
3. **Manual Cookie Management**: Error-prone, `@supabase/ssr` handles edge cases

---

## 3. Zod Schema Validation

### Decision
Use **Zod v3.24+ for request validation** on all API endpoints.

### Rationale
- **TypeScript-First**: Automatically infers TypeScript types from schemas
- **Runtime Safety**: Validates incoming data at runtime, prevents type coercion bugs
- **Developer Experience**: Excellent error messages, composable schemas
- **Next.js Integration**: Works seamlessly with Route Handlers and Server Actions
- **Constitution Alignment**: Type safety requirement satisfied

### Key Patterns from Research

#### Basic Schema Patterns
```typescript
// src/lib/schemas/auth.ts
import { z } from 'zod';

// Email/Password Sign Up
export const signupSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  fullName: z.string().min(1, "Full name is required").optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;

// Sign In
export const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export type SigninInput = z.infer<typeof signinSchema>;

// Password Reset Request
export const resetPasswordRequestSchema = z.object({
  email: z.string().email(),
});

// Password Reset Confirm
export const resetPasswordConfirmSchema = z.object({
  token: z.string().min(1),
  password: z.string()
    .min(8)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/)
    .regex(/[^A-Za-z0-9]/),
});

// Update Profile
export const updateProfileSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
}).refine(data => data.fullName || data.email, {
  message: "At least one field must be provided",
});
```

#### Advanced Validation Patterns
```typescript
// Email verification with custom regex
const emailSchema = z.string().email({
  pattern: z.regexes.email // Zod's default
});

// Or use stricter validation
const strictEmailSchema = z.string().email({
  pattern: z.regexes.rfc5322Email // RFC 5322 compliant
});

// Template literal types
const tokenSchema = z.template_literal`${z.string().uuid()}_${z.string()}`;

// Custom refinements for complex validation
const passwordMatchSchema = z.object({
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});
```

#### Usage in Route Handlers
```typescript
// src/app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { signupSchema } from '@/lib/schemas/auth';
import { ZodError } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate with Zod
    const validatedData = signupSchema.parse(body);

    // If we get here, data is valid and typed
    const { email, password, fullName } = validatedData;

    // Proceed with signup logic...

  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({
        error: "Validation failed",
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      }, { status: 400 });
    }

    // Other error handling...
  }
}
```

### Alternatives Considered
1. **Yup**: Less TypeScript integration, slower performance
2. **Joi**: Node.js-specific, not ideal for edge runtime
3. **Manual Validation**: Error-prone, no type inference

---

## 4. Rate Limiting Strategy

### Decision
Use **@upstash/ratelimit with Vercel Edge Middleware and @vercel/kv** for dual-scope rate limiting.

### Rationale
- **Edge Performance**: Runs at edge locations, blocks traffic before hitting backend
- **Low Latency**: In-memory caching reduces Redis calls when function is "hot"
- **Dual-Scope**: Supports both per-IP and per-account rate limiting
- **Serverless Compatible**: Designed for serverless/edge environments
- **Vercel Integration**: Seamless integration with Vercel KV (Redis)
- **Cost Effective**: Minimal overhead, efficient caching

### Key Patterns from Research

#### Rate Limiter Setup
```typescript
// src/lib/auth/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { kv } from '@vercel/kv';

// Per-IP rate limiter (20 failed attempts per 15 minutes)
export const ipRateLimiter = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(20, '15 m'),
  analytics: true,
  prefix: 'ratelimit:ip',
});

// Per-account rate limiter (5 failed attempts per 15 minutes)
export const accountRateLimiter = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  analytics: true,
  prefix: 'ratelimit:account',
});

// Password reset rate limiter (3 per hour per email)
export const passwordResetLimiter = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  analytics: true,
  prefix: 'ratelimit:reset',
});

// Magic link rate limiter (5 per hour per email)
export const magicLinkLimiter = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  analytics: true,
  prefix: 'ratelimit:magic',
});

// Email verification resend limiter (3 per hour)
export const verificationLimiter = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  analytics: true,
  prefix: 'ratelimit:verify',
});
```

#### Middleware Integration (Global)
```typescript
// src/app/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { ipRateLimiter } from '@/lib/auth/rate-limit';

export default async function middleware(request: NextRequest) {
  // Apply rate limiting to auth endpoints
  if (request.nextUrl.pathname.startsWith('/api/auth/')) {
    const ip = request.ip || request.headers.get('x-forwarded-for') || '127.0.0.1';
    const { success, limit, remaining, reset } = await ipRateLimiter.limit(ip);

    if (!success) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: 'Your IP has been temporarily blocked due to too many failed login attempts. Please try again later.',
          retryAfter: Math.ceil((reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': new Date(reset).toISOString(),
            'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }
  }

  // Continue with other middleware logic...
  return NextResponse.next();
}
```

#### Per-Account Rate Limiting in Route Handlers
```typescript
// src/app/api/auth/signin/route.ts
import { accountRateLimiter } from '@/lib/auth/rate-limit';

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  // Check account-specific rate limit
  const { success } = await accountRateLimiter.limit(email);

  if (!success) {
    return NextResponse.json({
      error: 'Account temporarily locked',
      message: 'Too many failed login attempts. Your account is temporarily locked for 15 minutes.',
    }, { status: 429 });
  }

  // Proceed with authentication...
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Log failed attempt (for account lockout tracking)
    await logAuthEvent({
      type: 'login_failure',
      email,
      ip: request.ip,
      timestamp: new Date(),
    });

    return NextResponse.json({
      error: 'Invalid credentials',
      message: 'Invalid email or password', // Generic message to prevent enumeration
    }, { status: 401 });
  }

  // Success - reset rate limit counter?
  // No - let it expire naturally to prevent abuse

  return NextResponse.json({ user: data.user }, { status: 200 });
}
```

### Available Algorithms
- **Fixed Window**: `Ratelimit.fixedWindow(10, '60 s')` - Simple, predictable
- **Sliding Window**: `Ratelimit.slidingWindow(10, '60 s')` - Smoother, recommended
- **Token Bucket**: `Ratelimit.tokenBucket(5, '10 s', 10)` - Tolerates bursts

### Best Practices from Research
1. **Declare rate limiters outside handlers** - Enables in-memory caching
2. **Use different prefixes** - Prevents key collisions
3. **Enable analytics** - View stats in Upstash Console
4. **Return proper headers** - `X-RateLimit-*` and `Retry-After` for clients
5. **Generic error messages** - Prevent account enumeration attacks

### Alternatives Considered
1. **express-rate-limit**: Requires Express.js, not compatible with Next.js Edge
2. **Database-based**: Too slow for high-traffic auth endpoints
3. **In-memory only**: Doesn't work in serverless (each invocation is stateless)
4. **Vercel's built-in**: Limited customization, no per-account limiting

---

## 5. Authentication Flows

### Decision Summary

| Flow | Method | Token Type | Expiration | Rate Limit |
|------|--------|------------|------------|------------|
| **Email/Password Signup** | `supabase.auth.signUp()` | Email verification | 24 hours | N/A (one-time) |
| **Email/Password Login** | `supabase.auth.signInWithPassword()` | Session cookie | 7 days (sliding) | 5 per account, 20 per IP |
| **OAuth (Google/GitHub)** | `supabase.auth.signInWithOAuth()` | Session cookie | 7 days (sliding) | 20 per IP |
| **Magic Link** | `supabase.auth.signInWithOtp()` | Magic link | 15 minutes | 5 per hour per email |
| **Password Reset** | `supabase.auth.resetPasswordForEmail()` | Reset token | 1 hour | 3 per hour per email |
| **Email Verification Resend** | `supabase.auth.resend()` | Verification token | 24 hours | 3 per hour per email |

### OAuth Configuration
```typescript
// OAuth providers config
const oauthProviders = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`,
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/github`,
  },
};

// OAuth sign-in
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google', // or 'github'
  options: {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`,
    scopes: 'email profile',
  },
});
```

---

## 6. Session Management & Browser Extension Sync

### Decision
Use **HTTP-only cookies with polling (10-30s exponential backoff)** for extension ↔ web sync.

### Rationale
- **Security**: HTTP-only cookies prevent XSS attacks
- **Simplicity**: Polling is simpler than WebSocket/SSE for auth state
- **Acceptable Latency**: 10-30 second delay acceptable for auth state changes
- **No Infrastructure**: No real-time server required
- **Extension Compatible**: Cookies work with proper CORS configuration

### Polling Implementation
```typescript
// Browser extension: src/extension/background/auth-sync.ts
class AuthSync {
  private interval: number = 10000; // Start at 10 seconds
  private maxInterval: number = 30000; // Max 30 seconds
  private timerId: number | null = null;

  start() {
    this.poll();
  }

  stop() {
    if (this.timerId) clearTimeout(this.timerId);
  }

  private async poll() {
    try {
      // Check auth state via API
      const response = await fetch(`${API_URL}/api/auth/user`, {
        credentials: 'include', // Include cookies
      });

      if (response.ok) {
        const { user } = await response.json();
        // Update extension state
        await chrome.storage.local.set({ user });

        // Reset interval on user activity
        this.interval = 10000;
      } else if (response.status === 401) {
        // User logged out
        await chrome.storage.local.remove('user');
      }
    } catch (error) {
      console.error('Auth sync failed:', error);
      // Increase interval on error (exponential backoff)
      this.interval = Math.min(this.interval * 1.5, this.maxInterval);
    }

    // Schedule next poll
    this.timerId = setTimeout(() => this.poll(), this.interval);
  }

  // Reset interval to 10s on user activity
  onUserActivity() {
    this.interval = 10000;
  }
}
```

### CORS Configuration
```typescript
// src/app/middleware.ts
export default async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Allow browser extension to access API
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    'chrome-extension://*', // Chrome extension
    'moz-extension://*',    // Firefox extension
  ];

  if (origin && allowedOrigins.some(allowed => origin.match(allowed))) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  return response;
}
```

---

## 7. Database Schema & Atomicity

### Decision
Use **Supabase database triggers** to ensure atomic profile creation when user signs up.

### Rationale
- **Atomicity**: Trigger executes in same transaction as auth.users insert
- **Reliability**: If profile creation fails, entire signup rolls back
- **Consistency**: auth.users and profiles always in sync
- **Performance**: No additional API calls, happens automatically

### Database Trigger (SQL)
```sql
-- Create trigger function to automatically create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, plan, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'free',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

### Fallback: API-Level Transaction
If triggers aren't feasible:
```typescript
// Wrapped in Supabase transaction
const { data, error } = await supabase.rpc('signup_with_profile', {
  email,
  password,
  full_name,
});

// Stored procedure:
CREATE OR REPLACE FUNCTION signup_with_profile(
  email TEXT,
  password TEXT,
  full_name TEXT
) RETURNS JSON AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Create auth user
  INSERT INTO auth.users (email, encrypted_password, ...)
  VALUES (email, crypt(password, gen_salt('bf')), ...)
  RETURNING id INTO new_user_id;

  -- Create profile (same transaction)
  INSERT INTO public.profiles (id, email, full_name, plan)
  VALUES (new_user_id, email, full_name, 'free');

  RETURN json_build_object('user_id', new_user_id);
EXCEPTION WHEN OTHERS THEN
  -- Rollback both inserts
  RAISE EXCEPTION 'Signup failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
```

---

## 8. Error Handling & Logging

### Decision
Implement **structured error handling with audit logging** for all auth events.

### Error Response Format
```typescript
// src/lib/auth/errors.ts
export type AuthError = {
  error: string;        // Error code (INVALID_CREDENTIALS, ACCOUNT_LOCKED, etc.)
  message: string;      // User-friendly message
  details?: unknown;    // Additional context (dev only)
  retryAfter?: number;  // For rate-limited requests
};

export class AuthErrorHandler {
  static handle(error: unknown): NextResponse {
    // Supabase Auth errors
    if (error instanceof AuthApiError) {
      return this.handleSupabaseError(error);
    }

    // Validation errors
    if (error instanceof ZodError) {
      return this.handleValidationError(error);
    }

    // Rate limit errors
    if (error instanceof RateLimitError) {
      return this.handleRateLimitError(error);
    }

    // Generic errors
    return NextResponse.json({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
    }, { status: 500 });
  }
}
```

### Audit Logging
```typescript
// New table: auth_events
CREATE TABLE auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'login_success', 'login_failure', 'password_reset', etc.
  user_id UUID REFERENCES auth.users(id), -- Nullable for IP-based events
  email TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auth_events_type ON auth_events(event_type);
CREATE INDEX idx_auth_events_user ON auth_events(user_id);
CREATE INDEX idx_auth_events_ip ON auth_events(ip_address);
CREATE INDEX idx_auth_events_created ON auth_events(created_at DESC);
```

---

## Summary of Resolved Clarifications

| Original Question | Resolution |
|-------------------|------------|
| Session storage mechanism? | HTTP-only cookies via @supabase/ssr |
| Extension ↔ web sync? | Polling with exponential backoff (10-30s) |
| Rate limiting scope? | Dual: per-account (5) + per-IP (20), both 15min |
| Email delivery failures? | Retry with exponential backoff + notify user |
| Profile creation atomicity? | Database trigger (or stored procedure fallback) |
| OAuth provider setup? | Google + GitHub, configured in Supabase dashboard |
| Testing framework? | Jest (unit), Vitest (API), Playwright (E2E) |
| Deployment platform? | Vercel Edge Functions (serverless) |

---

## Next Steps (Phase 1)

1. **Generate data-model.md**: Document all database entities (auth.users, profiles, auth_events)
2. **Generate contracts/**: Create OpenAPI 3.1 specification for all 8 API endpoints
3. **Generate quickstart.md**: Developer onboarding guide with setup instructions
4. **Update agent context**: Run `.specify/scripts/bash/update-agent-context.sh claude`

All research complete. Ready to proceed to Phase 1: Design & Contracts.
