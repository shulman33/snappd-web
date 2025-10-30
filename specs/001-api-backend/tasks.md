---
description: "Task list for Core API Backend implementation"
---

# Tasks: Core API Backend

**Input**: Design documents from `/specs/001-api-backend/`  
**Prerequisites**: plan.md (complete), spec.md (complete), research.md (complete), data-model.md (complete), contracts/ (complete)

**Tests**: Tests are MANDATORY per constitution (TDD for all API endpoints). Tests must be written FIRST, fail, then implementation makes them pass (Red-Green-Refactor cycle).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **API routes**: `src/app/api/` (Next.js 15 App Router)
- **Libraries**: `src/lib/` (shared utilities)
- **Types**: `src/types/` (TypeScript definitions)
- **Tests**: `tests/contract/`, `tests/integration/`, `tests/unit/`
- **Database**: `supabase/migrations/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Install core dependencies (next@15.5.5, @supabase/supabase-js, stripe, zod, nanoid)
- [X] T002 Install dev dependencies (vitest, @playwright/test, @types/node, typescript@5)
- [X] T003 [P] Install rate limiting dependencies (@upstash/ratelimit, @upstash/redis)
- [X] T004 [P] Configure TypeScript (tsconfig.json) for Next.js 15 App Router with strict mode
- [X] T005 [P] Configure Vitest (vitest.config.ts) for unit tests
- [X] T006 [P] Configure Playwright (playwright.config.ts) for contract tests
- [X] T007 Create environment variable template (.env.example) with Supabase, Stripe, Vercel KV vars
- [X] T008 [P] Create directory structure: src/app/api/, src/lib/, src/types/, tests/
- [X] T009 [P] Create .gitignore entries for .env.local, node_modules, .next, coverage

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T010 Create Supabase client singleton in src/lib/supabase.ts (admin + user contexts)
- [X] T011 Create Stripe client in src/lib/stripe.ts with webhook utilities
- [X] T012 [P] Create custom error classes in src/lib/errors.ts (ApiError, ValidationError, etc.)
- [X] T013 [P] Create Zod validation schemas in src/lib/validation.ts (uploadScreenshot, signup, etc.)
- [X] T014 [P] Create rate limiting middleware in src/lib/rate-limit.ts using upstash/ratelimit
- [X] T015 [P] Create short ID generator in src/lib/short-id.ts with nanoid + retry logic (3 attempts)
- [X] T016 [P] Create storage utilities in src/lib/storage.ts (MIME validation, signed URLs)
- [X] T016a [P] Create image optimization utilities in src/lib/storage.ts (WebP conversion at 85% quality, resize if >10MB)
- [X] T017 Run Supabase migration in supabase/migrations/20251017000000_initial_schema.sql
- [X] T018 Create Supabase Storage bucket 'screenshots' with public read, authenticated write policies
- [X] T019 Generate TypeScript database types in src/types/database.ts from Supabase schema
- [X] T020 [P] Create Stripe webhook event types in src/types/stripe.ts
- [X] T021 [P] Create API request/response types in src/types/api.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Screenshot Upload and Sharing (Priority: P1) 🎯 MVP

**Goal**: Users can upload screenshots, receive shareable links, and anonymous viewers can access via public URLs

**Independent Test**: Upload screenshot → receive short URL (snappd.app/s/abc123) → anonymous access works → view count increments

### Tests for User Story 1 (TDD - Write FIRST)

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T022 [P] [US1] Contract test for POST /api/upload/signed-url in tests/contract/upload.test.ts
- [X] T023 [P] [US1] Contract test for POST /api/screenshots in tests/contract/screenshots-upload.test.ts
- [ ] T024 [P] [US1] Contract test for GET /api/s/[shortId] in tests/contract/screenshots-public.test.ts
- [X] T025 [P] [US1] Unit test for generateUniqueShortId with collision retry in tests/unit/short-id.test.ts
- [ ] T026 [P] [US1] Unit test for MIME type validation in tests/unit/storage.test.ts
- [ ] T027 [US1] Integration test for full upload-to-share workflow in tests/integration/upload-workflow.test.ts

### Implementation for User Story 1

- [X] T028 [US1] Implement POST /api/upload/signed-url route in src/app/api/upload/signed-url/route.ts (with image optimization)
- [X] T029 [US1] Implement POST /api/screenshots route in src/app/api/screenshots/route.ts (with monthly limit check)
- [X] T030 [US1] Implement GET /api/s/[shortId]/route.ts route for public screenshot viewer (increment views)
- [X] T031 [US1] Add short ID collision retry logic to POST /api/screenshots (3 retries)
- [X] T032 [US1] Add expiration date calculation in POST /api/screenshots (upload_date + 30 days for free tier)
- [X] T033 [US1] Add 410 Gone handling in GET /api/s/[shortId] for expired screenshots
- [X] T034 [US1] Add SEO metadata generation (Open Graph tags) in GET /api/s/[shortId]

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently (MVP complete!)

---

## Phase 4: User Story 2 - User Authentication and Plan Management (Priority: P2)

**Goal**: Users can sign up, log in via OAuth, view their profile, and upgrade to pro tier via Stripe

**Independent Test**: Signup → get JWT → check plan = 'free' → upgrade via Stripe → webhook processes → plan = 'pro'

### Tests for User Story 2 (TDD - Write FIRST)

- [ ] T035 [P] [US2] Contract test for POST /api/auth/signup in tests/contract/auth-signup.test.ts
- [ ] T036 [P] [US2] Contract test for GET /api/auth/me in tests/contract/auth-profile.test.ts
- [ ] T037 [P] [US2] Contract test for PATCH /api/auth/me in tests/contract/auth-profile.test.ts
- [ ] T038 [P] [US2] Contract test for POST /api/billing/checkout in tests/contract/billing-checkout.test.ts
- [ ] T039 [P] [US2] Contract test for POST /api/billing/webhook in tests/contract/billing-webhook.test.ts
- [ ] T040 [P] [US2] Unit test for Stripe webhook signature verification in tests/unit/stripe.test.ts
- [ ] T041 [P] [US2] Unit test for webhook idempotency check in tests/unit/stripe.test.ts
- [ ] T042 [US2] Integration test for subscription lifecycle in tests/integration/subscription-lifecycle.test.ts

### Implementation for User Story 2

- [X] T043 [US2] Implement POST /api/auth/signup route in src/app/api/auth/signup/route.ts
- [X] T044 [US2] Create profile record on signup (trigger or manual insert) with Stripe customer ID
- [X] T045 [US2] Implement GET /api/auth/me route in src/app/api/auth/me/route.ts
- [X] T046 [US2] Implement PATCH /api/auth/me route in src/app/api/auth/me/route.ts
- [X] T047 [US2] Implement POST /api/billing/checkout route in src/app/api/billing/checkout/route.ts
- [X] T048 [US2] Implement GET /api/billing/portal route in src/app/api/billing/portal/route.ts
- [X] T049 [US2] Implement POST /api/billing/webhook route in src/app/api/billing/webhook/route.ts
- [X] T050 [US2] Add webhook signature verification in POST /api/billing/webhook
- [X] T051 [US2] Add idempotency check (stripe_events table) in POST /api/billing/webhook
- [X] T052 [US2] Handle subscription.created event (upgrade to pro) in webhook handler
- [X] T053 [US2] Handle subscription.updated event (status change) in webhook handler
- [X] T054 [US2] Handle subscription.deleted event (downgrade to free with grandfathering) in webhook handler
- [X] T055 [US2] Handle invoice.payment_failed event (downgrade after retries) in webhook handler
- [X] T056 [US2] Add downgraded_at timestamp update on downgrade for grandfathering logic

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Screenshot History and Management (Priority: P3)

**Goal**: Users can view paginated screenshot history, search by filename, filter by date, and delete screenshots

**Independent Test**: Upload 3 screenshots → GET /api/screenshots returns paginated list → search filters work → delete one → verify deletion

### Tests for User Story 3 (TDD - Write FIRST)

- [ ] T057 [P] [US3] Contract test for GET /api/screenshots (list) in tests/contract/screenshots-list.test.ts
- [ ] T058 [P] [US3] Contract test for GET /api/screenshots/[id] in tests/contract/screenshots-get.test.ts
- [ ] T059 [P] [US3] Contract test for PATCH /api/screenshots/[id] in tests/contract/screenshots-update.test.ts
- [ ] T060 [P] [US3] Contract test for DELETE /api/screenshots/[id] in tests/contract/screenshots-delete.test.ts
- [ ] T061 [P] [US3] Contract test for GET /api/screenshots/[id]/download in tests/contract/screenshots-download.test.ts
- [ ] T062 [P] [US3] Contract test for GET /api/usage in tests/contract/usage-current.test.ts
- [ ] T063 [P] [US3] Contract test for GET /api/usage/history in tests/contract/usage-history.test.ts

### Implementation for User Story 3

- [X] T064 [US3] Implement GET /api/screenshots route in src/app/api/screenshots/route.ts with pagination (50/page)
- [X] T065 [US3] Add filename search (case-insensitive substring) to GET /api/screenshots
- [X] T066 [US3] Add date range filtering (from_date, to_date) to GET /api/screenshots
- [X] T067 [US3] Implement GET /api/screenshots/[id]/route.ts for screenshot metadata
- [X] T068 [US3] Implement PATCH /api/screenshots/[id]/route.ts for metadata updates (filename, is_public)
- [X] T069 [US3] Implement DELETE /api/screenshots/[id]/route.ts for screenshot deletion
- [X] T070 [US3] Add Supabase Storage file deletion in DELETE /api/screenshots/[id]
- [X] T071 [US3] Implement GET /api/screenshots/[id]/download/route.ts for signed download URLs
- [X] T072 [US3] Implement GET /api/usage route in src/app/api/usage/route.ts
- [X] T073 [US3] Add monthly limit calculation with grandfathering logic in GET /api/usage
- [X] T074 [US3] Add upgrade prompt generation based on usage in GET /api/usage
- [X] T075 [US3] Implement GET /api/usage/history route in src/app/api/usage/history/route.ts
- [X] T076 [US3] Add aggregate statistics calculation in GET /api/usage/history

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: User Story 2 (Continued) - Account Deletion (GDPR)

**Goal**: Users can permanently delete their account and all associated data

**Note**: This task relates to US2 but is separated due to its destructive nature

### Tests for Account Deletion (TDD - Write FIRST)

- [ ] T077 [P] [US2] Contract test for POST /api/auth/delete in tests/contract/auth-delete.test.ts
- [ ] T078 [US2] Integration test for GDPR data deletion in tests/integration/gdpr-deletion.test.ts

### Implementation for Account Deletion

- [X] T079 [US2] Implement POST /api/auth/delete route in src/app/api/auth/delete/route.ts
- [X] T080 [US2] Add cascade deletion of screenshots (database + storage files) in POST /api/auth/delete
- [X] T081 [US2] Add cascade deletion of monthly_usage records in POST /api/auth/delete
- [X] T082 [US2] Add Stripe customer deletion in POST /api/auth/delete
- [X] T083 [US2] Add user profile deletion (auth.users cascade) in POST /api/auth/delete

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T084 [P] Add rate limiting to all upload endpoints (10 uploads/min/user)
- [X] T085 [P] Add rate limiting to all API endpoints (100 requests/min/user)
- [X] T086 [P] Add CORS configuration for browser extension origins in next.config.ts
- [X] T087 [P] Add error logging with structured format (JSON) across all API routes
- [X] T088 [P] Add performance monitoring (Vercel Analytics) to critical endpoints
- [X] T089 [P] Add JSDoc comments to all API route handlers with examples
- [X] T090 [P] Add JSDoc comments to all library functions in src/lib/
- [X] T091 [P] Verify all HTTP status codes match spec (200, 201, 400, 401, 403, 404, 410, 413, 429, 500)
- [X] T092 [P] Add user-friendly error messages (no stack traces) in production
- [X] T093 [P] Add environment variable validation on startup (check all required vars present)
- [X] T094 [P] Create Vercel deployment configuration (vercel.json) with edge function settings
- [X] T095 [P] Create Vercel cron job for expired screenshot cleanup (weekly)
- [X] T096 [P] Update quickstart.md with any implementation-specific notes
- [ ] T097 Run full test suite (contract + integration + unit)
- [ ] T098 Verify constitution compliance: <200ms API responses, <10s uploads, TDD complete
- [ ] T099 Deploy to Vercel preview environment and test end-to-end
- [ ] T100 Run security audit: RLS policies, rate limiting, CORS, webhook signatures

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Uses screenshots table from US1 but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Extends US1 with management features but independently testable
- **Account Deletion (US2 continued)**: Depends on US1 and US3 (needs screenshot deletion logic)

### Within Each User Story

- Tests (TDD) MUST be written and FAIL before implementation
- Models/database queries before services
- Services before API routes
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (9 parallelizable tasks)
- All Foundational tasks marked [P] can run in parallel (11 parallelizable tasks)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel (5-7 tests per story)
- All Polish tasks marked [P] can run in parallel (16 parallelizable tasks)

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (TDD - write first):
Task T022: "Contract test for POST /api/upload/signed-url in tests/contract/upload.test.ts"
Task T023: "Contract test for POST /api/screenshots in tests/contract/screenshots-upload.test.ts"
Task T024: "Contract test for GET /api/s/[shortId] in tests/contract/screenshots-public.test.ts"
Task T025: "Unit test for generateUniqueShortId with collision retry in tests/unit/short-id.test.ts"
Task T026: "Unit test for MIME type validation in tests/unit/storage.test.ts"

# After tests are written and failing, implement routes sequentially:
Task T028: "Implement POST /api/upload/signed-url route"
Task T029: "Implement POST /api/screenshots route"
Task T030: "Implement GET /api/s/[shortId] route"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

**Estimated Time**: 2-3 days for experienced developer

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (~1 day)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!) (~1 day)
3. Add User Story 2 → Test independently → Deploy/Demo (~1 day)
4. Add User Story 3 → Test independently → Deploy/Demo (~0.5 days)
5. Add Account Deletion → Test independently → Deploy/Demo (~0.5 days)
6. Polish phase → Final production deployment (~0.5 days)

**Total Estimated Time**: 4-5 days for experienced developer

Each story adds value without breaking previous stories.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (~1 day)
2. Once Foundational is done:
   - Developer A: User Story 1 (P1)
   - Developer B: User Story 2 (P2)
   - Developer C: User Story 3 (P3)
3. Stories complete and integrate independently
4. Team reconvenes for Polish phase

**Total Estimated Time**: 2-3 days with 3 developers

---

## Task Summary

**Total Tasks**: 101

**By Phase**:
- Phase 1 (Setup): 9 tasks
- Phase 2 (Foundational): 13 tasks
- Phase 3 (US1): 13 tasks (6 tests + 7 implementation)
- Phase 4 (US2): 21 tasks (8 tests + 13 implementation)
- Phase 5 (US3): 20 tasks (7 tests + 13 implementation)
- Phase 6 (US2 continued): 7 tasks (2 tests + 5 implementation)
- Phase 7 (Polish): 17 tasks

**By User Story**:
- User Story 1 (P1): 13 tasks
- User Story 2 (P2): 28 tasks (including account deletion)
- User Story 3 (P3): 20 tasks
- Infrastructure: 39 tasks (Setup + Foundational + Polish)

**Parallel Opportunities**: 43 tasks marked [P] can run in parallel

**Tests**: 23 test tasks (TDD mandatory per constitution)
- Contract tests: 14
- Integration tests: 3
- Unit tests: 6

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (Red-Green-Refactor)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Constitution compliance: TDD mandatory, <200ms API, <10s uploads
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

---

## Constitution Compliance Validation

**Required by Constitution**:
- ✅ TDD for all API endpoints (23 test tasks before implementation)
- ✅ API-first design (all endpoints before UI)
- ✅ Library-first approach (6 /lib modules in Foundational phase)
- ✅ Performance targets explicit (<200ms API, <10s uploads in T098)
- ✅ Modular architecture (clear /api, /lib, /types separation)
- ✅ Documentation (JSDoc tasks T089-T090)

**Ready for Implementation**: All tasks have exact file paths, clear acceptance criteria, and follow TDD workflow.

