# Implementation Plan: Comprehensive Authentication System

**Branch**: `005-auth-system` | **Date**: 2025-11-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-auth-system/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a comprehensive authentication system using Next.js 15 App Router with Supabase Auth as the backend. Implement API routes in `/api/auth/` that provide a clean interface layer over Supabase Auth, supporting email/password, OAuth (Google, GitHub), and magic link authentication. Use `@supabase/ssr` for server-side session management with HTTP-only cookies, Zod for input validation, and `@upstash/ratelimit` with Vercel Edge Middleware for rate limiting. The system handles user registration, login, logout, password reset, email verification, and session management across both web dashboard and browser extension, with proper error handling, security, and integration with existing profiles table and Stripe billing.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 15.5.5 (App Router), React 19.1.0
**Primary Dependencies**:
- `@supabase/ssr` - Server-side auth with cookie management
- `@supabase/supabase-js` - Supabase JavaScript client
- `zod` - Schema validation for API routes
- `@upstash/ratelimit` + `@vercel/kv` - Rate limiting
- `stripe` - Payment processing integration

**Storage**: PostgreSQL via Supabase (existing instance: iitxfjhnywekstxagump)
- auth.users table (managed by Supabase Auth)
- profiles table (application-managed, FK to auth.users)
- Authentication events logging (new table for rate limiting)

**Testing**: Jest + React Testing Library for components, Vitest for API routes, Playwright for E2E auth flows
**Target Platform**: Vercel Edge Functions (serverless) + Next.js 15 App Router (SSR/CSR hybrid)

**Project Type**: Web application (Next.js full-stack)

**Performance Goals**:
- Login flow: <10 seconds (95th percentile)
- API route response time: <200ms (95th percentile)
- Session validation: <100ms
- Auth state sync (extension ↔ web): <30 seconds

**Constraints**:
- HTTP-only cookies for security (XSS protection)
- Edge runtime compatibility (no Node.js-specific APIs)
- Dual-scope rate limiting (per-account + per-IP)
- Transactional atomicity (auth.users ↔ profiles creation)
- Browser extension CORS requirements

**Scale/Scope**:
- Support for 10k+ concurrent users
- 8 API endpoints + middleware
- 5 authentication flows (email, OAuth x2, magic link, password reset)
- Integration with 3 external services (Supabase, Stripe, OAuth providers)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Speed as Core Value ✅
- **Requirement**: Every user interaction < 3 seconds, complete capture-to-share workflow <10 seconds
- **Compliance**:
  - API routes target <200ms response time (well under 3s)
  - Login flow <10s (95th percentile) meets requirement
  - Session validation <100ms enables fast interactions
  - Rate limiting at edge prevents backend slowdowns
- **Status**: PASS

### II. Modern Design Excellence ✅
- **Requirement**: Beautiful UI with React 19, Next.js, shadcn/ui
- **Compliance**:
  - Using Next.js 15.5.5 App Router (latest stable)
  - React 19.1.0 for modern component patterns
  - Tailwind CSS 4 for consistent styling
  - shadcn/ui components for auth UI (to be implemented in separate story)
- **Status**: PASS (auth API routes are backend-only; UI components deferred to separate feature)

### III. Viral Mechanics ✅
- **Requirement**: Every share is a marketing opportunity
- **Compliance**:
  - Authentication system enables user accounts for tracking shares
  - Public/private screenshot features depend on auth
  - User profiles link to shared content for attribution
- **Status**: PASS (foundational requirement for viral features)

### IV. Freemium Conversion Focus ✅
- **Requirement**: Features drive 5-10% free-to-paid conversion
- **Compliance**:
  - Integration with Stripe for subscription management
  - Profile creation includes `plan` field (free/pro/team)
  - Auth system foundation for usage tracking and upgrade prompts
- **Status**: PASS

### V. Test-Driven Development (NON-NEGOTIABLE) ✅
- **Requirement**: Tests BEFORE implementation for all API endpoints and core logic
- **Compliance**:
  - Implementation plan delegates to test-writer sub-agent FIRST
  - Test specifications created before nextjs-api-builder implements routes
  - 100% coverage requirement for auth/authorization code paths
  - Red-Green-Refactor cycle enforced
- **Status**: PASS - Test-first approach explicitly mandated in implementation workflow

### Technical Architecture - API-First Design ✅
- **Requirement**: All functionality accessible via REST endpoints before UI
- **Compliance**:
  - All auth functionality exposed via `/api/auth/*` routes
  - API routes independent of UI components
  - Mobile clients can consume same endpoints in future
  - Third-party integrations possible via API
- **Status**: PASS

### Technical Architecture - Library-First Approach ✅
- **Requirement**: Reusable functionality extracted into standalone libraries
- **Compliance**:
  - Supabase client utilities (`/lib/supabase/server.ts`, `/lib/supabase/client.ts`)
  - Validation schemas (`/lib/schemas/auth.ts`)
  - Rate limiting helpers (`/lib/rate-limit.ts`)
  - Session management utilities (`/lib/auth/session.ts`)
- **Status**: PASS

### Code Quality - Component & Styling Standards ✅
- **Requirement**: shadcn/ui components, Tailwind CSS, accessibility
- **Compliance**:
  - API routes don't render UI (styling N/A)
  - When UI added: will use shadcn/ui Auth components
  - Error responses include accessible messages
  - TypeScript for type safety
- **Status**: PASS (backend-focused feature)

### Code Quality - Performance Monitoring ✅
- **Requirement**: Performance measurements, error boundaries, user-friendly errors
- **Compliance**:
  - Performance targets defined (200ms API, 100ms session validation)
  - Error boundaries in Next.js error.tsx files
  - User-friendly error messages (no stack traces exposed)
  - Logging for auth events (audit trail)
- **Status**: PASS

### Code Quality - Modular Architecture ✅
- **Requirement**: Clear separation (API, components, lib)
- **Compliance**:
  - `/api/auth/*` - API routes (backend logic)
  - `/lib/*` - Shared utilities, types, schemas
  - `/components/*` - UI components (future auth forms)
  - No business logic in components
  - No UI rendering in API routes
- **Status**: PASS

### Code Quality - Documentation Requirements ✅
- **Requirement**: JSDoc for APIs, Props interfaces for components
- **Compliance**:
  - JSDoc comments required for all API endpoints
  - OpenAPI schema generated in contracts/
  - Usage examples in quickstart.md
  - Error scenarios documented
- **Status**: PASS

**Overall Assessment**: ALL GATES PASSED ✅

No violations identified. This feature fully aligns with the snappd constitution. Proceed to Phase 0 research.

## Project Structure

### Documentation (this feature)

```text
specs/005-auth-system/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── openapi.yaml     # OpenAPI 3.1 spec for all auth endpoints
│   └── schemas/         # Zod schema exports for TypeScript
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

**Structure Decision**: Next.js 15 App Router (full-stack web application)

```text
src/
├── app/
│   ├── api/
│   │   └── auth/
│   │       ├── signup/route.ts           # POST /api/auth/signup
│   │       ├── signin/route.ts           # POST /api/auth/signin
│   │       ├── signout/route.ts          # POST /api/auth/signout
│   │       ├── reset-password/route.ts   # POST /api/auth/reset-password
│   │       ├── verify-email/route.ts     # POST /api/auth/verify-email
│   │       ├── user/route.ts             # GET /api/auth/user
│   │       ├── update-profile/route.ts   # PATCH /api/auth/update-profile
│   │       └── callback/
│   │           ├── google/route.ts       # GET /api/auth/callback/google
│   │           └── github/route.ts       # GET /api/auth/callback/github
│   ├── middleware.ts                     # Edge middleware for auth & rate limiting
│   └── (auth)/                           # Route group for auth pages (future)
│       ├── login/page.tsx
│       ├── signup/page.tsx
│       └── reset-password/page.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── server.ts                     # createServerClient utility
│   │   ├── client.ts                     # createBrowserClient utility
│   │   └── middleware.ts                 # Supabase middleware helper
│   ├── auth/
│   │   ├── session.ts                    # Session management utilities
│   │   ├── rate-limit.ts                 # Rate limiting logic
│   │   └── errors.ts                     # Auth error types & handlers
│   ├── schemas/
│   │   └── auth.ts                       # Zod schemas for auth validation
│   ├── stripe/
│   │   └── customer.ts                   # Stripe customer creation
│   └── utils.ts                          # Shared utilities
│
└── components/
    └── auth/                             # Auth UI components (future)
        ├── login-form.tsx
        ├── signup-form.tsx
        └── password-reset-form.tsx

__tests__/
├── unit/
│   ├── lib/
│   │   ├── auth/                         # Unit tests for auth utilities
│   │   └── schemas/                      # Schema validation tests
│   └── api/                              # API route unit tests
│       └── auth/
├── integration/
│   └── api/
│       └── auth/                         # Integration tests with Supabase
└── e2e/
    └── auth/                             # Playwright E2E tests
        ├── signup.spec.ts
        ├── login.spec.ts
        ├── password-reset.spec.ts
        └── oauth.spec.ts
```

**Next.js App Router Structure Notes:**
- API routes use Route Handlers (`route.ts`) in `/app/api/`
- Middleware runs at edge for auth checks and rate limiting
- Server Components use `createServerClient` from `@supabase/ssr`
- Client Components use `createBrowserClient` from `@supabase/ssr`
- Shared logic extracted to `/lib/` for reusability
- Tests colocated by type (unit/integration/e2e)

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations - this section is not applicable. All constitution requirements are met.
