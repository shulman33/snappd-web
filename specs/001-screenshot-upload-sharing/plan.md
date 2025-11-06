# Implementation Plan: Screenshot Upload and Sharing System

**Branch**: `001-screenshot-upload-sharing` | **Date**: 2025-11-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-screenshot-upload-sharing/spec.md`

## Summary

Build the backend infrastructure for a screenshot upload and sharing system using Supabase Storage for file storage with automatic CDN distribution, Next.js API routes for backend logic, and Supabase's built-in image transformation APIs for optimization. The system supports direct client uploads via signed URLs, plan-based quota enforcement through database triggers, and secure sharing through short URLs with configurable access controls. View tracking and analytics are implemented with privacy-compliant IP anonymization and geographic tracking.

## Technical Context

**Language/Version**: TypeScript 5.x with Next.js 15.5.5 (App Router)
**Primary Dependencies**:
- @supabase/supabase-js (Supabase client SDK)
- @supabase/ssr (Server-side rendering helpers)
- bcryptjs (password hashing)
- @upstash/ratelimit + @upstash/redis (rate limiting)

**Storage**:
- PostgreSQL 17.6.1.021 via Supabase (database)
- Supabase Storage (file storage with CDN)
- Upstash Redis (rate limiting)


**Target Platform**: Web (Next.js App Router), Browser Extension (upload client)

**Project Type**: Web application (existing Next.js project)

**Performance Goals**:
- Upload + share flow: <10 seconds for 5MB files
- Thumbnail load time: <500ms per thumbnail
- Signed URL generation: <100ms
- Dashboard load: < 3 seconds for 100 screenshots
- Upload success rate: 99%+ on stable connections

**Constraints**:
- 10MB file size limit (Supabase Storage bucket configuration)
- 10 screenshots/month for free users, unlimited for pro users
- Quota enforcement must be atomic (no race conditions)
- IP addresses must be hashed before storage (GDPR compliance)
- Password attempts rate-limited (3 attempts per 5 minutes)

**Scale/Scope**:
- Expected: 1000 active users in first 3 months
- 10,000 screenshots stored
- 100,000 views/month
- 100+ concurrent uploads supported

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Gate 1: Speed as Core Value ✅ PASS

**Requirement**: Complete capture-to-share workflow in under 10 seconds

**Evidence**:
- Direct client upload to Supabase Storage (bypasses server): ~2-5 seconds for 5MB
- Signed URL generation: <100ms
- Short URL generation and database insert: <50ms
- **Total**: ~3-6 seconds for complete upload-to-share flow ✅

**Performance Strategy**:
- Use signed URLs for direct client uploads (no server bandwidth)
- Pre-aggregate analytics to avoid slow real-time queries
- Index all lookup columns (short_id, user_id, file_hash)
- Leverage Supabase CDN for global image delivery

### Gate 2: Modern Design Excellence ✅ PASS

**Requirement**: Use React 19, Next.js 15, and modern TypeScript

**Evidence**:
- Next.js 15.5.5 App Router confirmed (from CLAUDE.md)
- React 19.1.0 confirmed (from CLAUDE.md)
- TypeScript strict mode enforced
- Modern API route patterns with App Router

### Gate 3: Viral Mechanics ✅ PASS

**Requirement**: Every shared screenshot is a marketing opportunity

**Evidence**:
- Short, memorable URLs (e.g., snappd.io/aB3xYz) create professional impression
- Share page includes subtle branding without being intrusive
- Fast-loading, beautifully rendered screenshots encourage sharing
- View analytics demonstrate value to users, encouraging upgrades

### Gate 4: Freemium Conversion Focus ✅ PASS

**Requirement**: Features demonstrate clear value driving 5-10% conversion

**Evidence**:
- **Free Tier**: 10 screenshots/month with 30-day expiration
- **Pro Tier**: Unlimited screenshots, permanent links, password protection, advanced analytics
- **Friction Points**: Quota exceeded message prominently displays upgrade CTA
- **Value Demonstration**: Analytics show engagement on shared screenshots, creating desire for more

**Conversion Path**:
1. User hits quota → Clear upgrade message
2. User wants permanent links → Pro-only feature
3. User needs password protection → Pro-only feature
4. User wants detailed analytics → Enhanced in Pro

### Gate 5: Implementation Quality (NON-NEGOTIABLE) ✅ PASS

**Requirement**: Robust implementation with proper error handling

**Quality Strategy**:
- Type-safe API routes with TypeScript strict mode
- Database constraints and triggers for data integrity
- Rate limiting on all public endpoints
- Proper error handling with meaningful status codes

**Focus Areas**:
- Upload logic, quota checking, short ID generation
- API route error handling and validation
- Database triggers and RLS policies
- Storage bucket policies and access control

### Constitution Verdict: ✅ ALL GATES PASS

No violations. Implementation may proceed.

## Project Structure

### Documentation (this feature)

```text
specs/001-screenshot-upload-sharing/
├── spec.md                    # Feature specification (created by /speckit.specify)
├── plan.md                    # This file (/speckit.plan output)
├── research.md                # Technology research and decisions
├── data-model.md              # Database schema and types
├── quickstart.md              # Implementation guide
├── contracts/
│   └── openapi.yaml           # API specification
└── tasks.md                   # Will be created by /speckit.tasks
```

### Source Code (repository root)

```text
# Next.js App Router Structure
app/
└── api/
    ├── upload/
    │   ├── init/
    │   │   └── route.ts                    # POST /api/upload/init (signed URL generation)
    │   └── [uploadSessionId]/
    │       ├── complete/
    │       │   └── route.ts                # POST /api/upload/:id/complete
    │       └── progress/
    │           └── route.ts                # GET /api/upload/:id/progress
    ├── screenshots/
    │   ├── route.ts                        # GET /api/screenshots (list user screenshots)
    │   ├── [shortId]/
    │   │   ├── route.ts                    # GET /api/screenshots/:shortId (details)
    │   │   │                               # DELETE /api/screenshots/:shortId
    │   │   └── analytics/
    │   │       └── route.ts                # GET /api/screenshots/:shortId/analytics
    │   └── bulk-delete/
    │       └── route.ts                    # POST /api/screenshots/bulk-delete
    ├── share/
    │   └── [shortId]/
    │       └── track/
    │           └── route.ts                # POST /api/share/:shortId/track (view tracking)
    └── user/
        └── usage/
            └── route.ts                    # GET /api/user/usage (quota info)

# Library Modules (reusable logic)
lib/
├── uploads/
│   ├── index.ts                            # Main exports
│   ├── types.ts                            # TypeScript types/interfaces
│   ├── storage.ts                          # Supabase Storage helpers
│   ├── encoding.ts                         # Base62 encoding for short IDs
│   ├── quota.ts                            # Quota checking logic
│   └── hash.ts                             # File hashing utilities
├── analytics/
│   ├── tracking.ts                         # View tracking logic
│   └── aggregation.ts                      # Daily stats aggregation
└── supabase/
    ├── client.ts                           # Supabase client instances
    ├── server.ts                           # Server-side Supabase helpers
    └── types.ts                            # Generated database types

# Database Migrations
supabase/
├── migrations/
│   ├── 20251020205404_initial_schema.sql   # Existing
│   ├── 20251103000001_screenshot_upload_schema.sql
│   ├── 20251103000002_view_events_table.sql
│   ├── 20251103000003_upload_sessions_table.sql
│   ├── 20251103000004_quota_triggers.sql
│   └── 20251103000005_rls_policies.sql
└── functions/
    └── cleanup-expired/
        └── index.ts                        # Edge Function for cleanup
```

**Structure Decision**: Backend-focused structure with Next.js API routes following RESTful conventions. Library modules extracted for reusability. Database migrations organized sequentially.

## Complexity Tracking

> No constitutional violations to justify. All requirements align with project principles.

---

## Phase 0: Research (COMPLETED ✅)

**Artifacts Generated**:
- `research.md` - Comprehensive technology research covering:
  - Supabase Storage architecture with signed URLs
  - Image optimization using built-in transformations
  - File organization strategy (user_id/year/month/hash-timestamp)
  - Quota enforcement via database triggers
  - Short URL generation with base62 encoding
  - View tracking with IP anonymization
  - Real-time progress via Supabase Realtime
  - Access control via RLS policies
  - Cleanup jobs using Edge Functions and pg_cron
  - Password protection with bcrypt and rate limiting

**Key Decisions**:
1. **Signed Upload URLs**: Direct client uploads to Supabase Storage
2. **Image Transformations**: Use Supabase built-in APIs (no server-side processing)
3. **Quota Enforcement**: Database triggers with row-level locking
4. **Short URLs**: Base62-encoded sequential IDs
5. **View Tracking**: Separate analytics table with hashed IPs
6. **Realtime Progress**: Supabase Realtime broadcast channels
7. **Cleanup**: pg_cron for scheduled jobs + Edge Functions

All technical unknowns resolved. Ready for Phase 1.

---

## Phase 1: Design & Contracts (COMPLETED ✅)

**Artifacts Generated**:
1. `data-model.md` - Complete database schema with:
   - Extended `screenshots` table (9 new columns)
   - New `view_events` table (privacy-compliant analytics)
   - New `daily_view_stats` table (pre-aggregated data)
   - New `upload_sessions` table (resumable uploads)
   - Database triggers (quota enforcement, view tracking, usage updates)
   - RLS policies (user isolation, public sharing)
   - Storage bucket structure and policies
   - TypeScript type definitions

2. `contracts/openapi.yaml` - REST API specification:
   - POST `/api/upload/init` - Initialize upload
   - POST `/api/upload/{id}/complete` - Complete upload
   - GET `/api/upload/{id}/progress` - Get progress
   - GET `/api/screenshots` - List screenshots
   - GET `/api/screenshots/{shortId}` - Get screenshot
   - DELETE `/api/screenshots/{shortId}` - Delete screenshot
   - POST `/api/screenshots/bulk-delete` - Bulk delete
   - GET `/api/screenshots/{shortId}/analytics` - Get analytics
   - POST `/api/share/{shortId}/track` - Track view
   - GET `/api/user/usage` - Get quota usage

3. `quickstart.md` - Implementation guide with:
   - 6-phase implementation plan (Day 1-7)
   - Step-by-step code examples
   - Deployment checklist
   - Troubleshooting guide

**Data Model Summary**:
- **4 new tables**: view_events, daily_view_stats, upload_sessions (+ extended screenshots)
- **6 database triggers**: Quota check, usage tracking, view counting, timestamps
- **12 RLS policies**: User isolation, public sharing, admin access
- **3 storage policies**: User upload, user read, public signed URL access

**API Design**:
- **11 endpoints** following RESTful conventions
- Standard HTTP status codes (200, 400, 401, 403, 404, 413, 429)
- Consistent error response format
- Authentication via Supabase JWT bearer tokens

---

## Phase 2: Implementation Plan

**Not included in `/speckit.plan` command**

Implementation details will be generated by `/speckit.tasks` command, which creates:
- `tasks.md` - Ordered list of implementation tasks
- Task dependencies and priorities
- Estimated effort per task
- Acceptance criteria for each task

---

## Next Steps

1. **Run `/speckit.tasks`** to generate implementation tasks
2. **Review tasks.md** for detailed work breakdown
3. **Begin implementation** following the task order
4. **Track progress** by updating task status in tasks.md

---

## Summary

This implementation plan provides a complete technical foundation for the screenshot upload and sharing system:

- ✅ **Research Complete**: All technology decisions documented with rationale
- ✅ **Data Model Defined**: PostgreSQL schema, triggers, RLS policies, and storage structure
- ✅ **API Contracts Ready**: OpenAPI specification with 11 endpoints
- ✅ **Implementation Guide**: 6-phase quickstart with code examples
- ✅ **Constitution Compliance**: All gates pass, backend-focused approach

**Ready for**: `/speckit.tasks` to generate actionable implementation tasks
