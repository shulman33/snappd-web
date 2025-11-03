# Tasks: Comprehensive Authentication System

**Feature Branch**: `005-auth-system`
**Input**: Design documents from `/specs/005-auth-system/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Tests**: NOT requested in specification - test tasks are excluded per requirements.

## Format: `- [ ] [ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Install authentication dependencies: `npm install @supabase/supabase-js @supabase/ssr zod @upstash/ratelimit @upstash/redis stripe`
- [X] T002 Create directory structure: `src/app/api/auth/`, `src/lib/supabase/`, `src/lib/auth/`, `src/lib/schemas/`
- [X] T003 [P] **USE CONTEXT7**: Fetch Zod documentation using `mcp__context7__get-library-docs` for "/colinhacks/zod" focused on "schema validation patterns"
- [X] T003a [P] Copy Zod schemas from `specs/005-auth-system/contracts/schemas/zod-schemas.ts` to `src/lib/schemas/auth.ts`
- [X] T004 [P] Configure environment variables in `.env.local` per quickstart.md (Supabase URL, keys, OAuth credentials, Upstash Redis)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database Setup

- [X] T005 **USE SUPABASE MCP**: Create auth_events table migration using `mcp__supabase__apply_migration` with name `add_auth_events_table` and SQL from data-model.md section 4
- [X] T006 **USE SUPABASE MCP**: Create profile trigger migration using `mcp__supabase__apply_migration` with name `add_profile_trigger` and SQL from data-model.md section 2 (handle_new_user function + on_auth_user_created trigger)
- [X] T007 **USE SUPABASE MCP**: Verify migrations applied successfully using `mcp__supabase__list_migrations` for project iitxfjhnywekstxagump
- [X] T008 **USE SUPABASE MCP**: Add foreign key constraint to profiles table using `mcp__supabase__apply_migration` with name `add_profiles_foreign_key` to link profiles.id → auth.users.id with CASCADE DELETE
- [X] T009 **USE SUPABASE MCP**: Generate TypeScript types using `mcp__supabase__generate_typescript_types` for project iitxfjhnywekstxagump and save to `src/types/supabase.ts`

### Supabase Client Setup

- [X] T010 [P] **USE CONTEXT7**: Fetch @supabase/ssr documentation using `mcp__context7__resolve-library-id` for "@supabase/ssr" then `mcp__context7__get-library-docs` focused on "createServerClient" and "createBrowserClient" patterns
- [X] T011 Create server Supabase client utility in `src/lib/supabase/server.ts` implementing createServerClient with cookie management per research.md section 2
- [X] T012 Create browser Supabase client utility in `src/lib/supabase/client.ts` implementing createBrowserClient per research.md section 2
- [X] T013 Create Supabase middleware helper in `src/lib/supabase/middleware.ts` for token refresh using updateSession pattern from research.md section 2

### Rate Limiting Infrastructure

- [X] T014 [P] **USE CONTEXT7**: Fetch @upstash/ratelimit documentation using `mcp__context7__get-library-docs` for "/upstash/ratelimit" focused on "slidingWindow" algorithm
- [X] T015 Create rate limiting utilities in `src/lib/auth/rate-limit.ts` with ipRateLimiter (20/15min), accountRateLimiter (5/15min), passwordResetLimiter (3/1hr), magicLinkLimiter (5/1hr), verificationLimiter (3/1hr) per research.md section 4
- [X] T015a [P] **USE CONTEXT7**: Fetch @upstash/redis documentation using `mcp__context7__get-library-docs` for "/upstash/redis" focused on "Redis client usage and configuration"
- [X] T016 [P] **USE CONTEXT7**: Fetch Next.js 15 middleware documentation using `mcp__context7__get-library-docs` for "/vercel/next.js" focused on "middleware and request handling"
- [X] T016a Implement rate limiting middleware in `src/middleware.ts` for IP-based rate limiting on /api/auth/* routes with proper error responses and retry headers per research.md section 4

### Auth Utilities & Error Handling

- [x] T017 [P] Create auth error types and handlers in `src/lib/auth/errors.ts` defining AuthError interface and AuthErrorHandler class per research.md section 8
- [x] T018 [P] **USE CONTEXT7**: Fetch Next.js 15 cookies documentation using `mcp__context7__get-library-docs` for "/vercel/next.js" focused on "cookies API and server actions"
- [x] T018a [P] Create session management utilities in `src/lib/auth/session.ts` for session validation and cookie configuration per research.md section 6
- [x] T019 [P] **USE SUPABASE MCP**: Create auth event logging helper in `src/lib/auth/logger.ts` that uses `mcp__supabase__execute_sql` to insert into auth_events table for audit trail

### Stripe Integration Setup

- [X] T020 **USE CONTEXT7**: Fetch Stripe Node.js documentation using `mcp__context7__get-library-docs` for "/stripe/stripe-node" focused on "customer creation"
- [X] T021 [P] **USE CONTEXT7**: Fetch Stripe webhook documentation using `mcp__context7__get-library-docs` for "/stripe/stripe-node" focused on "webhook handling and signature verification"
- [X] T021a Create Stripe customer utilities in `src/lib/stripe/customer.ts` for creating and linking Stripe customers to user profiles

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Email/Password Account Creation (Priority: P1) 🎯 MVP

**Goal**: Enable new users to create accounts using email and password with email verification

**Independent Test**: Submit registration form with valid credentials, receive verification email, click link, successfully log in

### Implementation for User Story 1

- [X] T022 [P] [US1] **USE CONTEXT7**: Fetch Next.js 15 Route Handlers documentation using `mcp__context7__get-library-docs` for "/vercel/next.js" focused on "route handlers" and "POST requests"
- [X] T023 [P] [US1] **USE SUPABASE MCP**: Review Supabase docs for signup using `mcp__supabase__search_docs` with GraphQL query for "signUp email password verification"
- [X] T023a [P] [US1] **USE CONTEXT7**: Fetch @supabase/supabase-js documentation using `mcp__context7__get-library-docs` for "/supabase/supabase-js" focused on "auth methods and error handling"
- [X] T024 [US1] Implement POST /api/auth/signup route handler in `src/app/api/auth/signup/route.ts` with signupSchema validation, supabase.auth.signUp(), profile creation via trigger, email verification sending, and auth event logging
- [X] T025 [US1] Add account lockout check in signup route using accountRateLimiter to prevent rapid signup abuse
- [X] T026 [US1] Implement error handling in signup route for EMAIL_EXISTS (409), VALIDATION_ERROR (400), and generic errors per contracts/openapi.yaml
- [X] T027 [US1] **USE SUPABASE MCP**: Verify signup creates both auth.users and profiles records atomically using `mcp__supabase__execute_sql` to query both tables
- [X] T028 [P] [US1] **USE SUPABASE MCP**: Review Supabase docs for email verification using `mcp__supabase__search_docs` with GraphQL query for "email verification confirm"
- [X] T029 [US1] Implement POST /api/auth/verify-email route handler in `src/app/api/auth/verify-email/route.ts` for email verification with token validation, single-use enforcement, and redirect to dashboard
- [X] T030 [US1] Add verification email resend endpoint in `src/app/api/auth/verify-email/resend/route.ts` with verificationLimiter rate limiting (3/hr)
- [X] T031 [US1] Add auth event logging for signup_success, signup_failure, email_verified events using auth event logger from T019
- [X] T032 [US1] **USE SUPABASE MCP**: Test signup flow end-to-end using `mcp__supabase__execute_sql` to verify profile creation and RLS policies

**Checkpoint**: At this point, User Story 1 should be fully functional - users can register and verify email

---

## Phase 4: User Story 2 - Secure Login and Session Management (Priority: P1)

**Goal**: Enable registered users to log in securely with persistent sessions across browser sessions

**Independent Test**: Log in with valid credentials, verify session persists across page refreshes, confirm user remains logged in until logout

### Implementation for User Story 2

- [X] T033 [P] [US2] **USE SUPABASE MCP**: Review Supabase docs for signin using `mcp__supabase__search_docs` with GraphQL query for "signInWithPassword session cookies"
- [X] T033a [P] [US2] **USE CONTEXT7**: Fetch @supabase/supabase-js documentation using `mcp__context7__get-library-docs` for "/supabase/supabase-js" focused on "signInWithPassword and session management"
- [X] T034 [US2] Implement POST /api/auth/signin route handler in `src/app/api/auth/signin/route.ts` with signinSchema validation, dual-scope rate limiting (accountRateLimiter + ipRateLimiter), supabase.auth.signInWithPassword(), and session cookie setting per research.md section 2
- [X] T035 [US2] Add failed login attempt tracking in signin route by logging login_failure events to auth_events table using T019 logger
- [X] T036 [US2] Implement account lockout logic in signin route checking auth_events for 5 failures in 15min per account, returning 429 with account_locked event
- [X] T037 [US2] Implement IP blocking logic in signin route checking auth_events for 20 failures in 15min per IP, returning 429 with ip_blocked event
- [X] T038 [US2] Add generic error messages in signin route to prevent account enumeration (always "Invalid email or password" for failed credentials)
- [X] T039 [US2] Add email verification check in signin route returning 403 EMAIL_NOT_VERIFIED if email_confirmed_at is NULL
- [X] T040 [P] [US2] Implement POST /api/auth/signout route handler in `src/app/api/auth/signout/route.ts` with supabase.auth.signOut() and session cookie clearing
- [X] T041 [P] [US2] Implement GET /api/auth/user route handler in `src/app/api/auth/user/route.ts` returning current user data from session (for extension polling)
- [X] T042 [US2] Update middleware in `src/app/middleware.ts` to call updateSession from T013 for automatic token refresh on all requests
- [X] T043 [US2] Add protected route logic in middleware redirecting unauthenticated users from /dashboard/* to /login
- [X] T044 [US2] Configure session cookie security in Supabase client: HttpOnly, Secure (HTTPS-only), SameSite=Lax, Max-Age=604800 (7 days) per research.md section 6
- [X] T045 [US2] Add session expiration handling in middleware with graceful re-authentication prompts when sessions expire
- [X] T046 [US2] Add auth event logging for login_success, login_failure, account_locked, ip_blocked events
- [X] T047 [US2] **USE SUPABASE MCP**: Test concurrent session support using `mcp__supabase__execute_sql` to verify multiple sessions allowed per user

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - users can register, verify, and log in securely

---

## Phase 5: User Story 3 - Password Reset and Recovery (Priority: P1)

**Goal**: Enable users who forgot passwords to securely regain account access via email

**Independent Test**: Request password reset, receive email with time-limited token, set new password, log in with new credentials

### Implementation for User Story 3

- [X] T048 [P] [US3] **USE SUPABASE MCP**: Review Supabase docs for password reset using `mcp__supabase__search_docs` with GraphQL query for "resetPasswordForEmail password recovery"
- [X] T048a [P] [US3] **USE CONTEXT7**: Fetch @supabase/supabase-js documentation using `mcp__context7__get-library-docs` for "/supabase/supabase-js" focused on "password reset and recovery flows"
- [X] T049 [US3] Implement POST /api/auth/reset-password route handler in `src/app/api/auth/reset-password/route.ts` with resetPasswordRequestSchema validation, passwordResetLimiter rate limiting (3/hr), and supabase.auth.resetPasswordForEmail()
- [X] T050 [US3] Add exponential backoff retry logic for email delivery failures in reset-password route (3 attempts: immediate, 2min, 5min) per FR-012
- [X] T051 [US3] Add user-friendly error handling in reset-password route for email delivery failures with update email or contact support options per FR-013
- [X] T052 [US3] Add auth event logging for password_reset events with metadata tracking email delivery status
- [X] T053 [P] [US3] Implement POST /api/auth/reset-password/confirm route handler in `src/app/api/auth/reset-password/confirm/route.ts` for password reset confirmation with token validation and new password setting
- [X] T054 [US3] Add token expiration check in reset-password/confirm route ensuring tokens valid for max 1 hour per FR-025
- [X] T055 [US3] Add single-use token enforcement in reset-password/confirm route per FR-036
- [X] T056 [US3] Implement session invalidation in reset-password/confirm route to invalidate all other sessions except current one per FR-026
- [X] T057 [US3] Add auth event logging for password_changed events with method=reset metadata
- [X] T058 [US3] **USE SUPABASE MCP**: Test password reset token expiration and single-use enforcement using `mcp__supabase__execute_sql` to query token state

**Checkpoint**: All P1 user stories complete - users can register, login, and recover passwords

---

## Phase 6: User Story 4 - Social OAuth Authentication (Priority: P2)

**Goal**: Enable users to register/log in using Google accounts for passwordless convenience

**Independent Test**: Click "Continue with Google", authorize permissions, return to Snappd with authenticated session and auto-created profile

### Implementation for User Story 4

- [X] T059 [P] [US4] **USE SUPABASE MCP**: Review Supabase docs for OAuth using `mcp__supabase__search_docs` with GraphQL query for "signInWithOAuth Google provider"
- [X] T060 [US4] Configure Google OAuth credentials in Supabase dashboard per quickstart.md OAuth Provider Setup section
- [X] T059a [P] [US4] **USE CONTEXT7**: Fetch @supabase/supabase-js documentation using `mcp__context7__get-library-docs` for "/supabase/supabase-js" focused on "OAuth providers and signInWithOAuth"
- [X] T062 [US4] Implement GET /api/auth/callback/google route handler in `src/app/api/auth/callback/google/route.ts` for OAuth callback with authorization code exchange and session creation
- [X] T063 [US4] Add account linking logic in Google callback route to link OAuth provider to existing account when emails match per FR-041
- [X] T064 [US4] Add automatic account creation in Google callback route for new OAuth users per FR-042
- [X] T065 [US4] Extract user email and name from Google OAuth provider response and store in profiles.full_name per FR-040
- [X] T066 [US4] Add auth event logging for oauth_linked events with provider=google metadata
- [X] T067 [US4] Add OAuth error handling for malformed provider responses per edge case "Malformed OAuth Responses"
- [X] T068 [US4] Validate all OAuth responses and reject invalid data with security event logging per FR-043
- [X] T069 [US4] **USE SUPABASE MCP**: Verify OAuth identities stored in auth.identities table using `mcp__supabase__execute_sql` to query provider links

**Checkpoint**: OAuth authentication functional - users can authenticate via Google

---

## Phase 7: User Story 5 - Magic Link Passwordless Authentication (Priority: P2)

**Goal**: Enable users to log in via secure email link without typing passwords

**Independent Test**: Enter email, receive magic link email, click link within 15 minutes, automatically logged in

### Implementation for User Story 5

- [X] T075 [P] [US5] **USE SUPABASE MCP**: Review Supabase docs for magic links using `mcp__supabase__search_docs` with GraphQL query for "signInWithOtp magic link email"
- [X] T075a [P] [US5] **USE CONTEXT7**: Fetch @supabase/supabase-js documentation using `mcp__context7__get-library-docs` for "/supabase/supabase-js" focused on "signInWithOtp and magic links"
- [X] T076 [US5] Implement POST /api/auth/magic-link route handler in `src/app/api/auth/magic-link/route.ts` with magicLinkSchema validation, magicLinkLimiter rate limiting (5/hr), and supabase.auth.signInWithOtp()
- [X] T077 [US5] Add automatic account creation in magic-link route for new users per acceptance scenario 2
- [X] T078 [US5] Add exponential backoff retry logic for magic link email delivery failures (3 attempts: immediate, 2min, 5min)
- [X] T079 [US5] Add auth event logging for magic_link_sent events with expires_at metadata
- [X] T080 [P] [US5] Implement GET /api/auth/magic-link/callback route handler in `src/app/api/auth/magic-link/callback/route.ts` for magic link verification
- [X] T081 [US5] Add token expiration check in magic-link/callback ensuring tokens valid for max 15 minutes per acceptance scenario 4
- [X] T082 [US5] Add single-use token enforcement in magic-link/callback per FR-036
- [X] T083 [US5] Handle existing active sessions gracefully in magic-link/callback allowing login without disrupting other sessions per acceptance scenario 5
- [X] T084 [US5] Add auth event logging for magic_link_used events with link_age_seconds metadata
- [X] T085 [US5] **USE SUPABASE MCP**: Test magic link expiration and single-use enforcement using `mcp__supabase__execute_sql`

**Checkpoint**: Magic link authentication functional - passwordless login available

---

## Phase 8: User Story 6 - Email Address Management (Priority: P3)

**Goal**: Enable users to update email addresses with proper verification of both old and new emails

**Independent Test**: Initiate email change, receive verification emails to both addresses, confirm change, log in with new email

### Implementation for User Story 6

- [ ] T086 [P] [US6] **USE SUPABASE MCP**: Review Supabase docs for email updates using `mcp__supabase__search_docs` with GraphQL query for "updateUser email verification"
- [ ] T086a [P] [US6] **USE CONTEXT7**: Fetch @supabase/supabase-js documentation using `mcp__context7__get-library-docs` for "/supabase/supabase-js" focused on "updateUser and email updates"
- [ ] T087 [US6] Implement PATCH /api/auth/update-email route handler in `src/app/api/auth/update-email/route.ts` with updateEmailSchema validation and email change request
- [ ] T088 [US6] Add dual verification email sending in update-email route to both old and new addresses per FR-046
- [ ] T089 [US6] Add email availability check in update-email route preventing change to already-registered email per acceptance scenario 3
- [ ] T090 [US6] Store pending email change with 24-hour expiration in metadata per FR-047
- [ ] T091 [P] [US6] Implement GET /api/auth/update-email/verify route handler in `src/app/api/auth/update-email/verify/route.ts` for email change verification
- [ ] T092 [US6] Add dual verification check in update-email/verify ensuring both old and new emails verified within 24 hours
- [ ] T093 [US6] Update profiles.email and auth.users.email atomically in update-email/verify using transaction
- [ ] T094 [US6] Preserve OAuth provider connections when email changes per acceptance scenario 5
- [ ] T095 [US6] Add auth event logging for profile_updated events with fields_changed=['email'] metadata
- [ ] T096 [US6] **USE SUPABASE MCP**: Verify email update maintains referential integrity using `mcp__supabase__execute_sql` to check profiles and auth.users sync

**Checkpoint**: Email management functional - users can safely update email addresses

---

## Phase 9: User Story 7 - Connected Account Management (Priority: P3)

**Goal**: Enable users to view and manage OAuth provider connections with link/unlink capabilities

**Independent Test**: View connected accounts in settings, link new OAuth provider, unlink provider (with safeguards), confirm changes persist

### Implementation for User Story 7

- [ ] T097 [P] [US7] **USE CONTEXT7**: Fetch @supabase/supabase-js documentation using `mcp__context7__get-library-docs` for "/supabase/supabase-js" focused on "user identities and linked accounts"
- [ ] T097a [P] [US7] Implement GET /api/auth/connections route handler in `src/app/api/auth/connections/route.ts` returning all linked OAuth providers from auth.identities with connection dates
- [ ] T098 [P] [US7] Implement POST /api/auth/connections/link route handler in `src/app/api/auth/connections/link/route.ts` for linking new OAuth providers
- [ ] T099 [US7] Add OAuth authorization flow in connections/link route redirecting to provider authorization page
- [ ] T100 [US7] Handle OAuth callback in connections/link route to complete provider linking
- [ ] T101 [US7] Add auth event logging for oauth_linked events when new providers connected
- [ ] T102 [P] [US7] Implement DELETE /api/auth/connections/:provider route handler in `src/app/api/auth/connections/[provider]/route.ts` for unlinking OAuth providers
- [ ] T103 [US7] Add authentication method count check in connections/[provider] DELETE preventing removal of last auth method per FR-051
- [ ] T104 [US7] Add clear warning in connections/[provider] DELETE requiring user to add another method first per acceptance scenario 4
- [ ] T105 [US7] Remove identity record from auth.identities when unlinking provider
- [ ] T106 [US7] Add auth event logging for oauth_unlinked events with provider metadata
- [ ] T107 [US7] **USE SUPABASE MCP**: Verify auth method count check logic using `mcp__supabase__execute_sql` to query auth.identities and encrypted_password

**Checkpoint**: Connected account management functional - users control authentication methods

---

## Phase 10: User Story 8 - Account Deletion (Priority: P3)

**Goal**: Enable users to permanently delete accounts and all associated data for privacy compliance

**Independent Test**: Initiate account deletion, verify with password, confirm account, profile, screenshots, and data completely removed

### Implementation for User Story 8

- [ ] T108 [P] [US8] **USE SUPABASE MCP**: Review Supabase docs for user deletion using `mcp__supabase__search_docs` with GraphQL query for "admin deleteUser account removal"
- [ ] T108a [P] [US8] **USE CONTEXT7**: Fetch @supabase/supabase-js documentation using `mcp__context7__get-library-docs` for "/supabase/supabase-js" focused on "admin deleteUser and account deletion"
- [ ] T109 [US8] Implement DELETE /api/auth/account route handler in `src/app/api/auth/account/route.ts` with password verification requirement per FR-053
- [ ] T110 [US8] Add password confirmation check in account DELETE route before allowing deletion
- [ ] T111 [US8] Add OAuth re-authentication check in account DELETE route for OAuth-only users
- [ ] T112 [P] [US8] **USE CONTEXT7**: Fetch Stripe subscription documentation using `mcp__context7__get-library-docs` for "/stripe/stripe-node" focused on "subscription cancellation"
- [ ] T112a [US8] **USE STRIPE INTEGRATION**: Cancel active Stripe subscription in account DELETE route using Stripe API before account deletion per FR-055
- [ ] T113 [US8] Mark Stripe customer record as deleted in account DELETE route updating stripe metadata
- [ ] T114 [P] [US8] **USE CONTEXT7**: Fetch @supabase/storage-js documentation using `mcp__context7__get-library-docs` for "/supabase/storage-js" focused on "file deletion and bucket operations"
- [ ] T114a [US8] Delete all user screenshots from storage bucket in account DELETE route using Supabase Storage API per FR-054
- [ ] T115 [US8] Delete profile record from profiles table in account DELETE route (cascades from auth.users deletion)
- [ ] T116 [US8] Delete monthly_usage records in account DELETE route
- [ ] T117 [US8] Delete authentication events in account DELETE route (user_id will be SET NULL due to ON DELETE SET NULL)
- [ ] T118 [US8] Delete user from auth.users using supabase.auth.admin.deleteUser() in account DELETE route
- [ ] T119 [US8] Send confirmation email after successful account deletion per FR-056
- [ ] T120 [US8] Add auth event logging for account_deleted events with deletion_reason metadata
- [ ] T121 [US8] Verify email address becomes available for re-registration after deletion per FR-057
- [ ] T122 [US8] **USE SUPABASE MCP**: Test complete data deletion using `mcp__supabase__execute_sql` to verify no orphaned records remain

**Checkpoint**: All user stories complete - full authentication system functional

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### CORS & Browser Extension Integration

- [ ] T123 [P] **USE CONTEXT7**: Fetch Next.js CORS documentation using `mcp__context7__get-library-docs` for "/vercel/next.js" focused on "CORS headers and middleware"
- [ ] T123a [P] Add CORS configuration in `src/app/middleware.ts` allowing browser extension origins (chrome-extension:/*, moz-extension:/*) with credentials per research.md section 6
- [ ] T124 [P] Add CORS preflight handling in middleware for OPTIONS requests
- [ ] T125 [P] Test browser extension authentication state polling with exponential backoff (10-30s intervals)

### Security Hardening

- [ ] T126 [P] **USE SUPABASE MCP**: Run security advisors using `mcp__supabase__get_advisors` with type=security for project iitxfjhnywekstxagump
- [ ] T127 Add RLS policies to stripe_events table or disable RLS to resolve security advisory from T126
- [ ] T128 Enable HaveIBeenPwned password protection in Supabase dashboard per security advisory
- [ ] T129 Enable additional MFA methods in Supabase dashboard per security advisory
- [ ] T130 Review and remove unused indexes (idx_screenshots_expires, idx_profiles_stripe_customer) if confirmed unused per performance advisory

### Monitoring & Logging

- [ ] T131 [P] **USE SUPABASE MCP**: Set up auth event monitoring dashboard using `mcp__supabase__get_logs` with service=auth
- [ ] T132 [P] Add structured logging for all authentication operations with appropriate log levels
- [ ] T133 [P] Configure auth_events table cleanup schedule (delete events >90 days old) using pg_cron per data-model.md retention policy

### Documentation & Developer Experience

- [ ] T134 [P] **USE CONTEXT7**: Fetch Redoc or Swagger UI documentation using `mcp__context7__get-library-docs` for "/redocly/redoc" focused on "OpenAPI documentation generation"
- [ ] T134a [P] Generate OpenAPI documentation from contracts/openapi.yaml using Redoc or Swagger UI
- [ ] T135 [P] Add JSDoc comments to all API route handlers documenting parameters, returns, and errors
- [ ] T136 [P] Create Postman collection from OpenAPI spec for API testing
- [ ] T137 Validate quickstart.md instructions work end-to-end on clean environment
- [ ] T138 Update CLAUDE.md with authentication system architecture notes

### Performance Optimization

- [ ] T139 [P] **USE CONTEXT7**: Fetch PostgreSQL indexing documentation using `mcp__context7__get-library-docs` for "/postgres/postgres" focused on "B-tree indexes and query optimization"
- [ ] T139a [P] Add database indexes for frequent queries (auth_events by email+timestamp, profiles by email)
- [ ] T140 [P] Implement caching for rate limit checks using Upstash Redis in-memory caching
- [ ] T141 Test API route response times meet <200ms target (95th percentile)
- [ ] T142 Test session validation meets <100ms target
- [ ] T143 Load test authentication endpoints for 1000 concurrent users

### Edge Cases & Error Scenarios

- [ ] T144 Test concurrent login attempts from multiple devices/browsers
- [ ] T145 Test session expiration during active use with graceful degradation
- [ ] T146 Test email verification link expiration with resend option
- [ ] T147 Test OAuth provider service outage handling with appropriate fallbacks
- [ ] T148 Test race condition prevention on account creation (duplicate submissions)
- [ ] T149 Test password reset during active session
- [ ] T150 Test cross-platform session synchronization lag (web ↔ extension)
- [ ] T151 Test token replay attack prevention (password reset, magic links, verification)
- [ ] T152 Test profile creation failure rollback (atomicity of auth.users + profiles)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-10)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1: US1, US2, US3 → P2: US4, US5 → P3: US6, US7, US8)
- **Polish (Phase 11)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational - No dependencies on other stories
- **US2 (P1)**: Can start after Foundational - No dependencies on other stories
- **US3 (P1)**: Can start after Foundational - No dependencies on other stories
- **US4 (P2)**: Can start after Foundational - No dependencies on other stories
- **US5 (P2)**: Can start after Foundational - No dependencies on other stories
- **US6 (P3)**: Can start after Foundational - No dependencies on other stories
- **US7 (P3)**: Depends on US4 (OAuth) being implemented first for provider linking
- **US8 (P3)**: Can start after Foundational - No dependencies on other stories

### Within Each User Story

- Context7/Supabase MCP research tasks FIRST before implementation
- Models/migrations before services
- Services before route handlers
- Core implementation before edge cases
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T001-T004)
- All Foundational tasks marked [P] can run in parallel within their subsection
- Once Foundational phase completes:
  - US1, US2, US3 can be implemented in parallel (all P1)
  - US4, US5 can be implemented in parallel after P1 stories (both P2)
  - US6, US8 can be implemented in parallel after P2 stories (both P3)
  - US7 must wait for US4 to complete (needs OAuth infrastructure)
- All Polish tasks marked [P] can run in parallel

---

## Implementation Strategy

### MVP First (User Stories 1-3 Only - All P1)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T021) - **CRITICAL BLOCKER**
3. Complete Phase 3: User Story 1 - Email/Password Signup (T022-T032)
4. Complete Phase 4: User Story 2 - Login & Sessions (T033-T047)
5. Complete Phase 5: User Story 3 - Password Reset (T048-T058)
6. **STOP and VALIDATE**: Test all P1 stories independently
7. Deploy/demo MVP - core authentication functional

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add US1 (Signup) → Test independently → Deploy/Demo (First increment!)
3. Add US2 (Login) → Test independently → Deploy/Demo (Sessions working!)
4. Add US3 (Reset) → Test independently → Deploy/Demo (MVP complete - all P1!)
5. Add US4 (Google OAuth) → Test independently → Deploy/Demo (P2 feature 1)
6. Add US5 (Magic Links) → Test independently → Deploy/Demo (P2 complete!)
7. Add US6 (Email Management) → Test independently → Deploy/Demo (P3 feature 1)
8. Add US7 (Account Connections) → Test independently → Deploy/Demo (P3 feature 2)
9. Add US8 (Account Deletion) → Test independently → Deploy/Demo (P3 complete - GDPR compliant!)
10. Polish (Phase 11) → Production hardening

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T021)
2. Once Foundational is done:
   - **Developer A**: US1 (Signup) - T022-T032
   - **Developer B**: US2 (Login) - T033-T047
   - **Developer C**: US3 (Password Reset) - T048-T058
3. After P1 stories integrate:
   - **Developer A**: US4 (OAuth) - T059-T074
   - **Developer B**: US5 (Magic Links) - T075-T085
4. After P2 stories:
   - **Developer A**: US6 (Email Management) - T086-T096
   - **Developer B**: US8 (Account Deletion) - T108-T122
   - **Developer C**: US7 (Connections) - T097-T107 (waits for US4)
5. All developers: Polish tasks in parallel (T123-T152)

---

## Parallel Example: Foundational Phase

```bash
# After T001-T004 complete, launch database migrations in sequence:
Task: T005 - Create auth_events table (USE SUPABASE MCP)
Task: T006 - Create profile trigger (USE SUPABASE MCP)
Task: T007 - Verify migrations (USE SUPABASE MCP)
Task: T008 - Add foreign key (USE SUPABASE MCP)
Task: T009 - Generate TypeScript types (USE SUPABASE MCP)

# Then launch in parallel:
Task: T010 - Fetch @supabase/ssr docs (USE CONTEXT7)
Task: T014 - Fetch @upstash/ratelimit docs (USE CONTEXT7)
Task: T020 - Fetch Stripe docs (USE CONTEXT7)
```

---

## Parallel Example: User Story 1 (Signup)

```bash
# Launch documentation research in parallel:
Task: T022 - Fetch Next.js Route Handlers docs (USE CONTEXT7)
Task: T023 - Review Supabase signup docs (USE SUPABASE MCP)
Task: T028 - Review Supabase email verification docs (USE SUPABASE MCP)

# Then implement routes:
Task: T024 - Implement signup route handler
Task: T025 - Add rate limiting to signup
Task: T026 - Add error handling to signup
Task: T029 - Implement verify-email route handler
Task: T030 - Implement resend endpoint
```

---

## Key Tool Usage Patterns

### When to use Context7 (`mcp__context7__*`)

**Use Context7 to fetch library documentation BEFORE implementing features that use:**

**Validation & Schemas:**
- **Zod**: Task T003 (schema validation patterns)

**Supabase Libraries:**
- **@supabase/ssr**: Task T010 (server client patterns)
- **@supabase/supabase-js**: Tasks T023a, T033a, T048a, T059a, T075a, T086a, T097, T108a (auth methods, OAuth, magic links, user management)
- **@supabase/storage-js**: Task T114 (file deletion and bucket operations)

**Rate Limiting & Caching:**
- **@upstash/ratelimit**: Task T014 (slidingWindow algorithm)
- **@upstash/redis**: Task T015a (Redis client usage and configuration)

**Next.js Framework:**
- **Next.js 15 Route Handlers**: Task T022 (API route patterns)
- **Next.js 15 Middleware**: Task T016 (middleware and request handling)
- **Next.js 15 Cookies API**: Task T018 (cookies API and server actions)
- **Next.js 15 CORS**: Task T123 (CORS headers and middleware)

**Payment Processing:**
- **Stripe Node.js**: Tasks T020, T021, T112 (customer creation, webhooks, subscription cancellation)

**Documentation & Database:**
- **Redoc/Swagger**: Task T134 (OpenAPI documentation generation)
- **PostgreSQL**: Task T139 (B-tree indexes and query optimization)

**Pattern:**
1. Call `mcp__context7__resolve-library-id` with package name
2. Call `mcp__context7__get-library-docs` with returned library ID and topic focus
3. Review documentation before implementing
4. Use up-to-date API patterns and best practices from the docs

### When to use Supabase MCP (`mcp__supabase__*`)

**Use Supabase MCP for ALL database operations:**

- **Migrations**: Tasks T005-T008 (use `mcp__supabase__apply_migration`)
- **Type Generation**: Task T009 (use `mcp__supabase__generate_typescript_types`)
- **Documentation**: Tasks T023, T028, T048, T059, T075, T086, T108 (use `mcp__supabase__search_docs`)
- **Verification Queries**: Tasks T027, T032, T047, T058, T074, T085, T096, T107, T122 (use `mcp__supabase__execute_sql`)
- **Security Checks**: Task T126 (use `mcp__supabase__get_advisors`)
- **Monitoring**: Task T131 (use `mcp__supabase__get_logs`)

**Pattern:**
1. For migrations: `mcp__supabase__apply_migration` with SQL from data-model.md
2. For queries: `mcp__supabase__execute_sql` with SELECT/INSERT/UPDATE
3. For docs: `mcp__supabase__search_docs` with GraphQL query
4. Always use project ID: `iitxfjhnywekstxagump`

---

## Notes

- **[P] tasks** = different files, no dependencies, safe to run in parallel
- **[Story] label** maps task to specific user story for traceability
- **Context7 usage**: Explicitly marked with "USE CONTEXT7" for library documentation lookups
- **Supabase MCP usage**: Explicitly marked with "USE SUPABASE MCP" for database operations
- Each user story is independently completable and testable
- Tests are NOT included per specification requirements
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

---

## Total Task Count: 162 tasks (16 new Context7 documentation tasks added)

- **Phase 1 (Setup)**: 5 tasks (added T003 for Zod docs)
- **Phase 2 (Foundational)**: 24 tasks (added 7 Context7 tasks) ⚠️ BLOCKS ALL USER STORIES
- **Phase 3 (US1 - Signup)**: 12 tasks (added T023a for @supabase/supabase-js docs)
- **Phase 4 (US2 - Login)**: 16 tasks (added T033a for auth docs)
- **Phase 5 (US3 - Password Reset)**: 12 tasks (added T048a for password reset docs)
- **Phase 6 (US4 - OAuth)**: 11 tasks (Google only - GitHub removed)
- **Phase 7 (US5 - Magic Links)**: 12 tasks (added T075a for magic link docs)
- **Phase 8 (US6 - Email Management)**: 12 tasks (added T086a for email update docs)
- **Phase 9 (US7 - Account Connections)**: 12 tasks (added T097 for identities docs)
- **Phase 10 (US8 - Account Deletion)**: 18 tasks (added 3 Context7 tasks)
- **Phase 11 (Polish)**: 34 tasks (added 4 Context7 tasks)

### Tasks by Priority

- **P1 (MVP)**: US1, US2, US3 = 40 implementation tasks (+ 29 foundational = 69 total for MVP)
- **P2**: US4, US5 = 23 tasks (Google OAuth only)
- **P3**: US6, US7, US8 = 42 tasks

### Parallel Opportunities Identified

- Setup: 2 tasks can run in parallel (T003/T003a, T004)
- Foundational: 15 tasks can run in parallel after migrations complete (all Context7 doc fetches)
- User Stories: All 8 stories independent after foundational (can assign to different developers)
- Polish: 22 tasks can run in parallel (includes Context7 doc fetches)

### Suggested MVP Scope

**Minimum Viable Product (MVP) includes:**
- Phase 1: Setup (5 tasks)
- Phase 2: Foundational (24 tasks - includes Context7 doc fetches)
- Phase 3: User Story 1 - Signup (12 tasks)
- Phase 4: User Story 2 - Login (16 tasks)
- Phase 5: User Story 3 - Password Reset (12 tasks)

**Total MVP: 69 tasks** - Delivers complete email/password authentication with password recovery

**Post-MVP Increments:**
- Increment 2: Add OAuth (US4) = 17 tasks
- Increment 3: Add Magic Links (US5) = 12 tasks
- Increment 4: Add Email Management (US6) = 12 tasks
- Increment 5: Add Account Connections (US7) = 12 tasks
- Increment 6: Add Account Deletion (US8) = 18 tasks (GDPR compliance)
- Final: Polish & Harden (Phase 11) = 34 tasks
