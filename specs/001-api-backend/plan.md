# Implementation Plan: Core API Backend

**Branch**: `001-api-backend` | **Date**: 2025-10-17 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-api-backend/spec.md`

## Summary

Build the core REST API backend for snappd using Next.js 15 App Router with API routes. The API handles screenshot uploads, user authentication (email/OAuth), freemium plan management, and public screenshot sharing. Key capabilities include file uploads to Supabase Storage with CDN distribution, Stripe subscription management, monthly usage tracking with calendar-based resets, and row-level security for multi-tenant data isolation. The system enforces free tier limits (10 screenshots/month, 30-day expiration per screenshot) with grandfathering for pro downgrades, MIME type validation for security, and 3-retry collision handling for short URL generation.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 15 (React 19)  
**Primary Dependencies**: 
- `@supabase/supabase-js` (database, auth, storage client)
- `stripe` (payment processing and webhooks)
- `zod` (request/response validation schemas)
- `nanoid` (short ID generation for public URLs)
- `next` (15.5.5 - App Router with API routes)

**Storage**: Supabase PostgreSQL (relational database) + Supabase Storage (file/blob storage with CDN)  
**Testing**: Vitest for unit tests, Playwright for API contract tests (TDD mandatory for endpoints)  
**Target Platform**: Vercel Edge Network (Node.js runtime for API routes, automatic scaling)  
**Project Type**: Web (Next.js App Router - API-first backend with future frontend)  
**Performance Goals**: 
- API responses <200ms p95 for metadata operations
- File uploads complete within 10 seconds for 10MB files
- Screenshot-to-share workflow <10 seconds end-to-end
- Support 10,000 concurrent users

**Constraints**: 
- 10MB max file upload size
- Rate limiting: 10 uploads/min/user, 100 API requests/min/user
- CORS enabled for browser extension origins
- MIME type validation only (no full antivirus for MVP speed)
- Row-level security (RLS) enforced for all tenant data

**Scale/Scope**: 
- Initial target: 1,000 active users
- Storage estimate: ~500MB/user/year (avg 50 screenshots @ 10MB each)
- API endpoints: 15 total (auth, screenshots, billing, usage, webhooks)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ Principle I: Speed as Core Value

**Requirement**: Every user interaction <3s, capture-to-share workflow <10s total

**Compliance**:
- ✅ MIME validation only (not full antivirus) maintains upload speed
- ✅ Supabase CDN for instant screenshot delivery
- ✅ API response targets <200ms for metadata operations
- ✅ Edge deployment on Vercel for global low latency
- ✅ Rate limiting prevents abuse without blocking legitimate fast usage

**Evidence**: SC-001 (10s workflow), SC-002 (200ms responses), FR-013 (10s uploads)

---

### ✅ Principle II: Modern Design Excellence

**Requirement**: React 19, Next.js, shadcn/ui for consistent design

**Compliance**:
- ✅ Next.js 15 with App Router (latest stable)
- ✅ TypeScript throughout for type safety
- ✅ Tailwind CSS for admin interfaces
- ⚠️ shadcn/ui deferred to frontend implementation (API-first approach)

**Evidence**: Technical stack matches constitution requirements; UI components follow when frontend built

---

### ✅ Principle III: Viral Mechanics

**Requirement**: Every shared screenshot is marketing

**Compliance**:
- ✅ Public shareable links with SEO metadata (Open Graph tags)
- ✅ View tracking for analytics (FR-011)
- ✅ Short, memorable URLs (snappd.app/s/abc123)
- ✅ Fast page loads <2s for anonymous viewers (SC-009)

**Evidence**: FR-021 (SEO metadata), FR-002 (short IDs), SC-009 (viewer performance)

---

### ✅ Principle IV: Freemium Conversion Focus

**Requirement**: 5-10% free-to-paid conversion target

**Compliance**:
- ✅ Clear tier distinction: 10/month free vs unlimited pro
- ✅ Grandfathering on downgrade encourages re-upgrade (prevents data loss)
- ✅ Usage tracking visible to users (FR-008, API endpoint)
- ✅ Stripe integration for frictionless upgrades ($9/month)
- ✅ Conversion funnel analytics (SC-007)

**Evidence**: FR-005/006 (tier limits), FR-009 (Stripe), Clarification #3 (grandfathering)

---

### ✅ Principle V: Test-Driven Development (NON-NEGOTIABLE)

**Requirement**: Tests BEFORE implementation for all API endpoints

**Compliance**:
- ✅ TDD mandatory: Vitest unit tests + Playwright contract tests
- ✅ Test-first workflow enforced in Phase 2 task breakdown
- ✅ API contracts defined in Phase 1 (testable specifications)
- ✅ Red-Green-Refactor cycle for all 15 endpoints

**Evidence**: Constitution V, Testing context (Vitest/Playwright), Phase 1 contracts/

---

### ✅ Technical Architecture: Stack Requirements

**Requirement**: Next.js App Router, Supabase, Vercel, TypeScript, API-first

**Compliance**:
- ✅ Next.js 15 App Router for API routes (`/app/api/*`)
- ✅ Supabase for auth, database, storage (constitution-mandated)
- ✅ Vercel deployment with edge optimization
- ✅ TypeScript throughout (no plain JS)
- ✅ API-first: All endpoints defined before UI (15 REST endpoints)

**Evidence**: Technical Context, API Endpoints Structure (user input), FR-007/003

---

### ✅ Technical Architecture: Library-First Approach

**Requirement**: Extract reusable functionality into libraries

**Compliance**:
- ✅ `/lib/supabase.ts` - Supabase client singleton
- ✅ `/lib/stripe.ts` - Stripe client and webhook utilities
- ✅ `/lib/validation.ts` - Zod schemas for request/response validation
- ✅ `/lib/short-id.ts` - nanoid wrapper with collision retry logic
- ✅ `/lib/rate-limit.ts` - Rate limiting middleware
- ✅ `/lib/storage.ts` - File upload and MIME validation helpers

**Evidence**: Project structure with `/lib` utilities, no duplicated business logic

---

### ✅ Code Quality: Modular Architecture

**Requirement**: Clear separation - API in `/api`, utilities in `/lib`

**Compliance**:
- ✅ API routes: `/app/api/*` (15 endpoints organized by domain)
- ✅ Shared utilities: `/lib/*` (6 library modules)
- ✅ Type definitions: `/types/*` (database, API, Stripe types)
- ✅ No business logic in components (API-only for this phase)

**Evidence**: Project Structure section, clear boundaries enforced

---

### ✅ Code Quality: Documentation Requirements

**Requirement**: JSDoc for all API endpoints with examples and error codes

**Compliance**:
- ✅ OpenAPI contracts generated in Phase 1 (`/contracts/*.yaml`)
- ✅ JSDoc comments required for all route handlers
- ✅ Error scenarios documented per endpoint
- ✅ Quickstart guide generated in Phase 1

**Evidence**: Phase 1 outputs (contracts/, quickstart.md), FR-025 (HTTP status codes)

---

### ✅ Code Quality: Performance Monitoring

**Requirement**: Measurements and targets for critical paths

**Compliance**:
- ✅ Performance targets explicit: <200ms metadata, <10s uploads
- ✅ Vercel Analytics for API route monitoring
- ✅ Error boundaries with user-friendly messages
- ✅ No stack traces exposed (FR-025 status codes only)

**Evidence**: SC-002/004 (performance criteria), Performance Goals section

---

**Constitution Compliance Summary**: ✅ **PASSED** - All 5 core principles + 4 technical architecture requirements met. No violations requiring justification.

## Project Structure

### Documentation (this feature)

```
specs/001-api-backend/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification (already created)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── auth.yaml        # Authentication endpoints OpenAPI spec
│   ├── screenshots.yaml # Screenshot management endpoints
│   ├── billing.yaml     # Stripe integration endpoints
│   └── usage.yaml       # Usage tracking endpoints
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
src/
├── app/
│   └── api/
│       ├── auth/
│       │   ├── signup/route.ts           # POST /api/auth/signup
│       │   ├── me/route.ts                # GET/PATCH /api/auth/me
│       │   └── delete/route.ts            # POST /api/auth/delete
│       ├── screenshots/
│       │   ├── route.ts                   # POST/GET /api/screenshots
│       │   └── [id]/
│       │       ├── route.ts               # GET/PATCH/DELETE /api/screenshots/[id]
│       │       └── download/route.ts      # GET /api/screenshots/[id]/download
│       ├── s/
│       │   └── [shortId]/route.ts         # GET /api/s/[shortId] - public viewer
│       ├── usage/
│       │   ├── route.ts                   # GET /api/usage
│       │   └── history/route.ts           # GET /api/usage/history
│       ├── billing/
│       │   ├── checkout/route.ts          # POST /api/billing/checkout
│       │   ├── portal/route.ts            # GET /api/billing/portal
│       │   └── webhook/route.ts           # POST /api/billing/webhook
│       └── upload/
│           └── signed-url/route.ts        # POST /api/upload/signed-url
├── lib/
│   ├── supabase.ts                        # Supabase client (admin + user contexts)
│   ├── stripe.ts                          # Stripe client and webhook utilities
│   ├── validation.ts                      # Zod schemas (request/response validation)
│   ├── short-id.ts                        # nanoid + collision retry logic
│   ├── rate-limit.ts                      # Rate limiting middleware
│   ├── storage.ts                         # File upload + MIME validation
│   └── errors.ts                          # Custom error classes and handlers
└── types/
    ├── database.ts                        # Supabase table types (auto-generated)
    ├── api.ts                             # API request/response types
    └── stripe.ts                          # Stripe webhook event types

tests/
├── contract/
│   ├── auth.test.ts                       # Contract tests for auth endpoints
│   ├── screenshots.test.ts                # Contract tests for screenshot endpoints
│   ├── billing.test.ts                    # Contract tests for billing endpoints
│   └── usage.test.ts                      # Contract tests for usage endpoints
├── integration/
│   ├── upload-workflow.test.ts            # End-to-end upload → share → view
│   ├── subscription-lifecycle.test.ts     # Free → upgrade → downgrade → cancel
│   └── expiration-handling.test.ts        # Screenshot expiration logic
└── unit/
    ├── short-id.test.ts                   # Short ID generation + collision retry
    ├── rate-limit.test.ts                 # Rate limiting logic
    └── validation.test.ts                 # Zod schema validation

supabase/
├── migrations/
│   └── 20251017000000_initial_schema.sql  # Database schema from user input
└── seed.sql                               # Test data for development
```

**Structure Decision**: Next.js App Router architecture (Option 1 variant). All API routes live in `src/app/api/` following Next.js 15 conventions. Shared business logic extracted to `/lib` per constitution's library-first principle. Tests organized by type (contract/integration/unit) per TDD requirements. Supabase migrations in dedicated folder for version control.

## Complexity Tracking

*No violations - Constitution Check passed all gates*

