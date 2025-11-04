# Tasks: Screenshot Upload and Sharing System

**Input**: Design documents from `/specs/001-screenshot-upload-sharing/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml

**Tests**: Tests are NOT explicitly requested in the specification, so they are EXCLUDED from this task list.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Using Next.js 15 App Router structure:
- API routes: `app/api/`
- Library modules: `src/lib/`
- Database migrations: `supabase/migrations/`
- Type definitions: `src/types/supabase.ts`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Use context7 to fetch latest Next.js 15 App Router documentation for API route patterns
- [X] T002 Use context7 to fetch latest @supabase/supabase-js documentation for storage and database APIs
- [X] T003 [P] Install required dependencies: bcryptjs, @upstash/ratelimit, @upstash/redis in package.json
- [X] T004 [P] Create library module structure: src/lib/uploads/, src/lib/analytics/, src/lib/supabase/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Use Supabase MCP list_migrations to review existing database migrations
- [X] T006 Create migration supabase/migrations/20251103000001_screenshot_upload_schema.sql to add new columns to screenshots table (file_hash, sharing_mode, password_hash, thumbnail_path, optimized_path, processing_status, processing_error)
- [X] T007 [P] Create migration supabase/migrations/20251103000002_view_events_table.sql for analytics tracking
- [X] T008 [P] Create migration supabase/migrations/20251103000003_daily_view_stats_table.sql for pre-aggregated analytics
- [X] T009 [P] Create migration supabase/migrations/20251103000004_upload_sessions_table.sql for resumable uploads
- [X] T010 Create migration supabase/migrations/20251103000005_quota_triggers.sql for quota enforcement and usage tracking triggers
- [X] T011 Create migration supabase/migrations/20251103000006_rls_policies.sql for screenshot and analytics RLS policies
- [X] T012 Use Supabase MCP apply_migration to run migration 20251103000001_screenshot_upload_schema.sql
- [X] T013 Use Supabase MCP apply_migration to run migration 20251103000002_view_events_table.sql
- [X] T014 Use Supabase MCP apply_migration to run migration 20251103000003_daily_view_stats_table.sql
- [X] T015 Use Supabase MCP apply_migration to run migration 20251103000004_upload_sessions_table.sql
- [X] T016 Use Supabase MCP apply_migration to run migration 20251103000005_quota_triggers.sql
- [X] T017 Use Supabase MCP apply_migration to run migration 20251103000006_rls_policies.sql
- [X] T018 Use Supabase MCP generate_typescript_types to create updated type definitions in src/types/supabase.ts
- [X] T019 [P] Create base upload types in src/lib/uploads/types.ts (InitUploadRequest, InitUploadResponse, CompleteUploadRequest, CompleteUploadResponse)
- [X] T020 [P] Implement base62 encoding utilities in src/lib/uploads/encoding.ts (encodeBase62, decodeBase62)
- [X] T021 [P] Implement file hashing utilities in src/lib/uploads/hash.ts using Web Crypto API SHA-256
- [X] T022 Create Supabase client helpers in src/lib/supabase/client.ts and src/lib/supabase/server.ts
- [X] T023 Use Supabase MCP list_tables to verify all tables created correctly
- [X] T024 Use Supabase MCP get_advisors for security and performance recommendations after schema changes

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Basic Screenshot Upload and Share (Priority: P1) 🎯 MVP

**Goal**: Free-tier user uploads screenshot via browser extension, receives shareable link that expires in 30 days

**Independent Test**: Install extension, capture screenshot, upload it, verify shareable link generated and accessible

### Implementation for User Story 1

- [X] T025 [P] [US1] Use context7 to fetch @supabase/ssr documentation for server-side authentication patterns
- [X] T026 [P] [US1] Use context7 to fetch Supabase Storage createSignedUploadUrl documentation, then implement storage helpers in src/lib/uploads/storage.ts (generateFilePath, createSignedUploadUrl)
- [X] T027 [US1] Create POST /api/upload/init route in app/api/upload/init/route.ts with quota checking and signed URL generation
- [X] T028 [US1] Use Supabase MCP execute_sql to test quota trigger behavior, then create POST /api/upload/[uploadSessionId]/complete route in app/api/upload/[uploadSessionId]/complete/route.ts
- [X] T029 [P] [US1] Use Supabase MCP execute_sql to query monthly_usage table structure, then create quota checking utilities in src/lib/uploads/quota.ts
- [X] T030 [US1] Implement short ID generation and screenshot record creation in complete upload route
- [X] T031 [P] [US1] Use Supabase MCP get_project_url to configure public URL for share links
- [X] T032 [US1] Use Supabase MCP execute_sql to verify screenshot record created, then test complete upload flow: init → upload → complete

**Checkpoint**: At this point, User Story 1 should be fully functional - users can upload and share screenshots

---

## Phase 4: User Story 2 - Progress Tracking and Error Recovery (Priority: P1)

**Goal**: Users see real-time progress during uploads with automatic retry on network failures

**Independent Test**: Upload large file over throttled network, verify progress bar updates and automatic retry works

### Implementation for User Story 2

- [X] T035 [P] [US2] Use context7 to fetch Next.js 15 route handlers documentation, then create GET /api/upload/[uploadSessionId]/progress route in app/api/upload/[uploadSessionId]/progress/route.ts
- [X] T036 [US2] Use Supabase MCP execute_sql to query upload_sessions table for status tracking, then implement upload session status tracking with retry count logic
- [X] T037 [US2] Add automatic retry logic (max 3 attempts) to upload completion handler
- [X] T038 [US2] Implement error state handling and API error response messages
- [X] T039 [US2] Use Supabase MCP execute_sql to verify retry_count increments correctly, then test with simulated network interruptions and verify retry mechanism

**Checkpoint**: Upload reliability significantly improved with progress feedback and retry

---

## Phase 5: User Story 3 - Plan-Based Quota Enforcement (Priority: P1)

**Goal**: Free-tier users blocked from uploading 11th screenshot with upgrade CTA

**Independent Test**: Create free account, upload 10 screenshots, attempt 11th and verify blocking message

### Implementation for User Story 3

- [X] T040 [P] [US3] Use Supabase MCP execute_sql to verify quota trigger fires correctly by inserting test screenshot records
- [X] T041 [US3] Create GET /api/user/usage route in app/api/user/usage/route.ts to return current usage and quota limits
- [X] T042 [US3] Add quota exceeded error handling in upload init route with upgrade message
- [X] T043 [US3] Use Supabase MCP execute_sql to manually update monthly_usage month field, then verify monthly usage counter resets correctly (test date boundary logic)
- [X] T044 [US3] Use Supabase MCP execute_sql to verify trigger blocks 11th upload, then test quota enforcement: 10th upload succeeds, 11th fails with proper error

**Checkpoint**: Quota system enforcing limits and driving upgrade path

---

## Phase 6: User Story 4 - Batch Upload from Extension (Priority: P2)

**Goal**: Users can upload multiple screenshots at once with unified progress tracking

**Independent Test**: Select 5 screenshots in extension, upload all, verify batch progress indicator

### Implementation for User Story 4

- [X] T045 [P] [US4] Use context7 to fetch Next.js 15 documentation on handling multiple concurrent API requests and Promise.allSettled patterns
- [X] T046 [US4] Use Supabase MCP execute_sql to test batch insert performance on upload_sessions table, then update upload init route to support batch upload metadata
- [X] T047 [US4] Implement batch progress tracking in upload session logic with status aggregation
- [X] T048 [US4] Use Supabase MCP execute_sql to test quota trigger with concurrent inserts, then add quota checking for batch uploads (respect remaining quota)
- [X] T049 [US4] Implement partial success handling (some uploads succeed, some fail) with detailed API response
- [X] T050 [US4] Use Supabase MCP execute_sql to set user monthly_usage to 8/10, then test batch upload with quota enforcement (free user with 8/10 uploads attempting 5-batch)

**Checkpoint**: Batch upload enhances power user efficiency

---

## Phase 7: User Story 5 - Image Optimization and Format Conversion (Priority: P2)

**Goal**: Automatic compression and thumbnail generation for fast global loading

**Independent Test**: Upload 12MB PNG, verify compressed version created and thumbnails load under 500ms

### Implementation for User Story 5

- [X] T051 [P] [US5] Use context7 to fetch Supabase Storage image transformation API documentation with focus on getPublicUrl transform parameter
- [X] T052 [US5] Use context7 to fetch Supabase Storage CDN caching documentation, then implement image URL generation with transformations in src/lib/uploads/storage.ts
- [X] T053 [P] [US5] Use Supabase MCP execute_sql to update screenshot records with optimized_path and thumbnail_path after upload
- [X] T054 [US5] Use context7 to fetch Supabase Storage transformation best practices, then configure transformation parameters (quality: 75, format optimization)
- [X] T055 [US5] Create thumbnail URL generation helper (200x150px, cover mode) in src/lib/uploads/storage.ts
- [X] T056 [US5] Add API endpoint GET /api/screenshots/[shortId]/url to return optimized and thumbnail URLs
- [X] T057 [US5] Use Supabase MCP execute_sql to verify file_size reduction after optimization, then test with various formats (PNG, JPEG, WEBP)

**Checkpoint**: Images load faster globally with automatic optimization

---

## Phase 8: User Story 6 - Metadata Extraction and Display (Priority: P2)

**Goal**: Dashboard displays dimensions, file size, timestamps, and view counts

**Independent Test**: Upload screenshot, verify all metadata correctly extracted and displayed

### Implementation for User Story 6

- [ ] T058 [P] [US6] Use context7 to fetch Web APIs documentation for image metadata extraction, then update complete upload route to extract image metadata (dimensions, mime type)
- [ ] T059 [P] [US6] Use context7 to fetch Next.js 15 App Router pagination patterns, then create GET /api/screenshots route in app/api/screenshots/route.ts for listing user screenshots
- [ ] T060 [US6] Use Supabase MCP execute_sql to test query performance with ORDER BY and LIMIT clauses, then add pagination, sorting (by date, views, size) to screenshots list endpoint
- [ ] T061 [US6] Add metadata fields to screenshots list API response (dimensions, file_size, views, created_at, mime_type)
- [ ] T062 [US6] Use Supabase MCP execute_sql to insert test screenshots with varying metadata, then test metadata display across different screenshot sizes and types

**Checkpoint**: Users can organize and understand their screenshot library

---

## Phase 9: User Story 7 - Sharing Modes and Access Control (Priority: P2)

**Goal**: Support public, private (auth required), and password-protected sharing modes

**Independent Test**: Create screenshot with each mode, verify access controls work correctly

### Implementation for User Story 7

- [ ] T063 [P] [US7] Use context7 to fetch bcryptjs documentation for password hashing with focus on compare and hash functions
- [ ] T064 [US7] Use context7 to fetch bcrypt best practices for cost factor selection, then implement password hashing in src/lib/uploads/security.ts using bcrypt (cost factor 10)
- [ ] T065 [P] [US7] Use Supabase MCP execute_sql to verify password_hash column accepts bcrypt hashed values, then update upload init route to support password parameter for password-protected mode
- [ ] T066 [US7] Use Supabase MCP execute_sql to test sharing_mode constraint validation, then add sharing mode validation to upload routes (public/private/password)
- [ ] T067 [US7] Create POST /api/screenshots/[shortId]/verify-password route for password verification
- [ ] T068 [US7] Use context7 to fetch @upstash/ratelimit documentation for sliding window algorithm, then implement rate limiting on password attempts using @upstash/ratelimit (3 attempts per 5 min)
- [ ] T069 [US7] Create GET /api/screenshots/[shortId]/access route to check sharing_mode and enforce access control
- [ ] T070 [US7] Use context7 to fetch @supabase/ssr documentation for getUser authentication, then add authentication check for private mode screenshots
- [ ] T071 [US7] Use Supabase MCP execute_sql to insert test screenshots with each sharing mode, then test all three modes: public (no auth), private (auth required), password (correct password required)
- [ ] T072 [US7] Test password rate limiting (3 failed attempts triggers 5-minute lockout)

**Checkpoint**: Secure sharing of sensitive content enabled

---

## Phase 10: User Story 8 - Temporary Quick-Share Links (Priority: P3)

**Goal**: Support custom expiration times (1 hour, 24 hours) for time-sensitive sharing

**Independent Test**: Create screenshot with 1-hour expiration, verify it expires correctly

### Implementation for User Story 8

- [ ] T073 [P] [US8] Use context7 to fetch JavaScript Date API documentation for timestamp calculations, then update upload init route to support expiresIn parameter (in seconds)
- [ ] T074 [US8] Use Supabase MCP execute_sql to verify expires_at timestamp storage and indexing, then implement expiration calculation and storage in screenshot record
- [ ] T075 [US8] Update GET /api/screenshots/[shortId]/access route to check expiration and return expiration status
- [ ] T076 [US8] Use context7 to fetch @supabase/ssr documentation for user session checks, then implement owner bypass for expired screenshots in access route
- [ ] T077 [US8] Use Supabase MCP execute_sql to insert screenshots with various expires_at timestamps, then test various expiration times (1 hour, 24 hours, custom)
- [ ] T078 [US8] Use Supabase MCP execute_sql to manually set expires_at to past timestamp, then verify expired links show appropriate error response to non-owners

**Checkpoint**: Time-sensitive content sharing supported

---

## Phase 11: User Story 9 - Bulk Deletion and Management (Priority: P3)

**Goal**: Users can select and delete multiple screenshots in single operation

**Independent Test**: Upload 10 screenshots, select 5, bulk delete, verify all removed

### Implementation for User Story 9

- [ ] T079 [P] [US9] Use context7 to fetch Next.js 15 DELETE method documentation for route handlers, then create DELETE /api/screenshots/[shortId] route in app/api/screenshots/[shortId]/route.ts
- [ ] T080 [P] [US9] Use context7 to fetch Supabase transaction documentation for atomic bulk operations, then create POST /api/screenshots/bulk-delete route in app/api/screenshots/bulk-delete/route.ts
- [ ] T081 [US9] Use context7 to fetch Supabase Storage remove() API documentation with batch deletion examples, then implement storage file deletion using Supabase Storage remove() API
- [ ] T082 [US9] Use Supabase MCP execute_sql to verify update_monthly_usage_on_delete trigger fires correctly, then confirm monthly_usage updates on deletion via existing trigger
- [ ] T083 [US9] Use Supabase MCP execute_sql to batch insert 50 test screenshots, then test bulk delete with 50 screenshots and verify all removed
- [ ] T084 [US9] Use Supabase MCP execute_sql to verify storage_bytes in monthly_usage decreases correctly after bulk deletion

**Checkpoint**: Large screenshot libraries easily manageable

---

## Phase 12: User Story 10 - View Analytics and Tracking (Priority: P3)

**Goal**: Users see view counts, daily graphs, and geographic distribution

**Independent Test**: Share link, access multiple times from different locations, verify analytics update

### Implementation for User Story 10

- [ ] T085 [P] [US10] Use context7 to fetch Next.js 15 headers documentation for extracting x-forwarded-for, then create POST /api/screenshots/[shortId]/track-view route in app/api/screenshots/[shortId]/track-view/route.ts
- [ ] T086 [US10] Use context7 to fetch Web Crypto API SHA-256 documentation, then implement IP hashing in src/lib/analytics/tracking.ts using SHA-256 with salt
- [ ] T087 [P] [US10] Use context7 to fetch Vercel Edge runtime geolocation API documentation, then add IP geolocation using Vercel Edge runtime geolocation
- [ ] T088 [US10] Use Supabase MCP execute_sql to test view_events insert with is_owner flag, then implement view event logging with owner detection (exclude owner views)
- [ ] T089 [US10] Use context7 to fetch Supabase aggregation query patterns, then create GET /api/screenshots/[shortId]/analytics route in app/api/screenshots/[shortId]/analytics/route.ts
- [ ] T090 [P] [US10] Use Supabase MCP execute_sql to test GROUP BY date aggregation performance on view_events, then implement daily stats aggregation query from view_events table
- [ ] T091 [US10] Use Supabase MCP execute_sql to test country_stats JSONB aggregation, then add country-level geographic distribution aggregation to analytics endpoint
- [ ] T092 [US10] Update GET /api/screenshots route to support sorting by view count (ORDER BY views DESC)
- [ ] T093 [US10] Use Supabase MCP execute_sql to insert test view_events with different countries and timestamps, then test analytics: multiple views, verify counts and geographic data
- [ ] T094 [US10] Use Supabase MCP execute_sql to verify is_owner=true views excluded from aggregation, then verify owner views excluded from public analytics

**Checkpoint**: Users gain insights into content reach and engagement

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T095 [P] Use Supabase MCP get_advisors with type='security' and type='performance' for final audit recommendations
- [ ] T096 [P] Use context7 to fetch Next.js 15 performance optimization best practices including ISR, caching, and bundle optimization
- [ ] T097 Use context7 to fetch Next.js 15 error handling patterns, then add comprehensive error handling across all API routes
- [ ] T098 [P] Use context7 to fetch structured logging best practices for Next.js, then implement logging for all upload operations using console structured logging
- [ ] T099 [P] Use context7 to fetch @upstash/ratelimit documentation for multiple limiters per application, then add rate limiting to all public endpoints using @upstash/ratelimit
- [ ] T100 Use Supabase MCP get_advisors with type='performance' to identify missing indexes, then optimize database queries with proper indexes
- [ ] T101 [P] Use context7 to fetch Next.js 15 caching documentation, then configure CDN caching headers for optimized images in API responses
- [ ] T102 Use Supabase MCP list_tables to review all RLS policies, then review and update RLS policies for security hardening
- [ ] T103 [P] Use context7 to fetch OpenAPI validation tools documentation, then add OpenAPI documentation validation against contracts/openapi.yaml
- [ ] T104 [P] Use Supabase MCP execute_sql to analyze quota trigger execution time with EXPLAIN ANALYZE, then add monitoring for quota trigger performance
- [ ] T105 Use context7 to fetch Supabase Edge Functions documentation and pg_cron examples, then configure cleanup job for expired screenshots (pg_cron or Edge Function)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-12)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 13)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - Builds on US1 upload infrastructure
- **User Story 3 (P1)**: Can start after Foundational - Uses quota system from Foundation
- **User Story 4 (P2)**: Can start after US1 - Extends upload functionality
- **User Story 5 (P2)**: Can start after US1 - Adds optimization to upload flow
- **User Story 6 (P2)**: Can start after US1 - Adds UI for viewing screenshots
- **User Story 7 (P2)**: Can start after US1 - Extends sharing with access controls
- **User Story 8 (P3)**: Can start after US1 - Adds expiration features
- **User Story 9 (P3)**: Can start after US6 - Requires dashboard UI
- **User Story 10 (P3)**: Can start after US1 - Independent analytics feature

### Within Each User Story

- Foundation tasks must complete before story implementation
- Tasks marked [P] within a story can run in parallel
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- Migrations can be created in parallel, applied sequentially
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Models/utilities within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

### Critical Path for Documentation Fetching

**IMPORTANT**: Context7 and Supabase MCP usage pattern integrated throughout all user stories:

1. **Before starting any task involving external libraries**: Use context7 to fetch latest documentation
2. **Before any database operations**: Use Supabase MCP tools to verify state and test queries
3. **After schema changes**: Always run Supabase MCP get_advisors to catch security issues
4. **During testing**: Use Supabase MCP execute_sql to insert test data and verify behavior

**Context7 Usage Examples** (35+ tasks):
- T001: Fetch Next.js 15 App Router documentation
- T002: Fetch @supabase/supabase-js documentation
- T025: Fetch @supabase/ssr documentation for auth patterns
- T026: Fetch Supabase Storage createSignedUploadUrl documentation
- T031: Fetch Next.js 15 dynamic routes documentation
- T035: Fetch Next.js 15 route handlers documentation
- T037: Fetch Supabase Realtime broadcast channels documentation
- T047: Fetch Next.js concurrent request handling patterns
- T054: Fetch Supabase Storage image transformation API
- T069: Fetch bcryptjs password hashing documentation
- T075: Fetch @upstash/ratelimit sliding window algorithm
- T095: Fetch Next.js 15 headers documentation
- T096: Fetch Web Crypto API SHA-256 documentation
- T108: Fetch Next.js 15 performance optimization best practices
- T118: Fetch Supabase Edge Functions and pg_cron documentation

**Supabase MCP Usage Examples** (45+ tasks):
- T005: Use list_migrations to review existing migrations
- T012-T017: Use apply_migration to apply 6 new migrations
- T018: Use generate_typescript_types to create type definitions
- T023: Use list_tables to verify tables created
- T024: Use get_advisors for security/performance audit
- T028: Use execute_sql to test quota trigger behavior
- T029: Use execute_sql to query monthly_usage structure
- T032: Use get_project_url to configure share links
- T034: Use execute_sql to verify screenshot records
- T040: Use execute_sql to verify retry_count increments
- T041: Use execute_sql to verify quota trigger fires
- T045: Use execute_sql to test monthly reset logic
- T046: Use execute_sql to verify trigger blocks 11th upload
- T050: Use execute_sql to test concurrent insert quota handling
- T064: Use execute_sql to test query performance with ORDER BY
- T068: Use execute_sql to insert test data with varying metadata
- T089: Use execute_sql to verify deletion trigger fires
- T093: Use execute_sql to batch insert 50 test screenshots
- T100: Use execute_sql to test aggregation query performance
- T107: Use get_advisors for final security/performance audit
- T112: Use get_advisors to identify missing indexes
- T114: Use list_tables to review RLS policies
- T117: Use execute_sql with EXPLAIN ANALYZE for performance monitoring

---

## Parallel Example: User Story 1

```bash
# After Foundational phase completes, launch these in parallel:
Task T025: "Use context7 to fetch @supabase/ssr documentation"
Task T026: "Implement storage helpers in src/lib/uploads/storage.ts"
Task T029: "Create quota checking utilities in src/lib/uploads/quota.ts"
Task T032: "Use Supabase MCP get_project_url to configure public URL"

# Then proceed with dependent tasks:
Task T027: "Create POST /api/upload/init route" (depends on T026, T029)
Task T028: "Create POST /api/upload/[uploadSessionId]/complete route" (depends on T026)
```

---

## Implementation Strategy

### MVP First (User Stories 1-3 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Basic upload and share)
4. Complete Phase 4: User Story 2 (Progress tracking)
5. Complete Phase 5: User Story 3 (Quota enforcement)
6. **STOP and VALIDATE**: Test all three P1 stories independently
7. Deploy/demo MVP

**Rationale**: User Stories 1-3 are all P1 priority and represent the minimum viable product - basic upload, reliable uploads, and quota enforcement for business model.

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP core!)
3. Add User Story 2 → Test independently → Deploy/Demo (Reliability!)
4. Add User Story 3 → Test independently → Deploy/Demo (Business model!)
5. Add User Story 4 → Test independently → Deploy/Demo (Power users)
6. Add User Story 5 → Test independently → Deploy/Demo (Performance)
7. Continue with P2/P3 stories as needed
8. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 + 4
   - Developer B: User Story 2 + 5
   - Developer C: User Story 3 + 6
3. Stories complete and integrate independently

---

## Notes

- **[P] tasks**: Different files, no dependencies - can run in parallel
- **[Story] label**: Maps task to specific user story for traceability
- **Context7 usage**: ALWAYS fetch latest docs before implementing features using external libraries
- **Supabase MCP usage**: Use for all database operations (migrations, queries, advisors)
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Quota system enforced at database level with triggers (race condition safe)
- All IP addresses hashed before storage (GDPR compliance)
- Password protection uses bcrypt with rate limiting (security best practice)
- Image optimization via Supabase built-in transformations (no server processing)

---

## Task Summary

**Total Tasks**: 105 (API-focused, UI components removed)
**MVP Tasks (P1 Stories 1-3)**: Setup (4) + Foundational (20) + US1 (8) + US2 (5) + US3 (5) = **42 tasks**

**Task Distribution by User Story**:
- Setup: 4 tasks
- Foundational: 20 tasks (BLOCKS all stories)
- User Story 1 (P1): 8 tasks (API-only)
- User Story 2 (P1): 5 tasks (API-only)
- User Story 3 (P1): 5 tasks (API-only)
- User Story 4 (P2): 6 tasks (API-only)
- User Story 5 (P2): 7 tasks (API-only)
- User Story 6 (P2): 5 tasks (API-only)
- User Story 7 (P2): 10 tasks (API-only)
- User Story 8 (P3): 6 tasks (API-only)
- User Story 9 (P3): 6 tasks (API-only)
- User Story 10 (P3): 10 tasks (API-only)
- Polish: 11 tasks (API-only)

**Parallel Opportunities Identified**: 35+ tasks marked [P] can run in parallel within their phases

**Independent Test Criteria (API Testing)**:
- US1: Upload screenshot via API → Get share link → Verify link resolves
- US2: Upload large file → Check progress endpoint → Simulate failure → Verify retry
- US3: Upload 10 screenshots → Attempt 11th → Verify quota error response
- US4: Batch upload 5 screenshots via API → Check batch progress
- US5: Upload 12MB file → Verify optimized URL returns smaller image
- US6: Upload screenshot → Query list endpoint → Verify all metadata returned
- US7: Create password-protected screenshot → Verify password endpoint blocks access
- US8: Create 1-hour expiration link → Verify access endpoint returns expiration status
- US9: Delete multiple screenshots via bulk-delete endpoint → Verify all removed
- US10: Share link → Track views via API → Query analytics endpoint

**Suggested MVP Scope**: User Stories 1-3 (42 tasks total, all P1 priority)
- Delivers core value: Upload, share, reliability, quota enforcement
- Enables business model validation (free vs pro tiers)
- Can be completed in ~1-2 weeks with single developer
- **Note**: UI components are excluded - focus is on building robust APIs first

**Format Validation**: ✅ All tasks follow checklist format with:
- Checkbox `- [ ]` or `- [X]`
- Task ID (T001-T105)
- [P] marker for parallelizable tasks (35+ tasks)
- [Story] label for user story tasks (US1-US10)
- Clear descriptions with exact file paths
- **API-focused**: All UI component tasks removed to focus on backend infrastructure
