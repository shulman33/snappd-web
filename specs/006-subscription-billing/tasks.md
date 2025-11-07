# Tasks: Subscription Billing and Payment Management

**Input**: Design documents from `/specs/006-subscription-billing/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/billing-api.yaml

**Tests**: Tests are NOT explicitly requested in the specification, so they are EXCLUDED from this task list.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Using Next.js 15 App Router structure:
- API routes: `app/api/v1/billing/`
- Library modules: `src/lib/billing/`
- Database migrations: `supabase/migrations/`
- Type definitions: `src/types/billing.ts`
- OpenAPI spec: `public/openapi.json`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Use context7 to fetch latest Next.js 15 App Router documentation for API route patterns
- [X] T002 Use context7 to fetch latest Stripe Node.js SDK documentation (v16.x) for subscription management
- [X] T003 Use context7 to fetch latest @supabase/supabase-js documentation for database operations
- [X] T004 [P] Install required dependencies: stripe, zod in package.json
- [X] T005 [P] Create library module structure: src/lib/billing/, src/types/billing.ts
- [X] T006 [P] Review project structure to understand existing auth and upload API patterns in src/app/api/v1/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Use Supabase MCP to review existing database schema
- [X] T008 Create a migration with all 11 tables (subscriptions, stripe_customers, payment_methods, teams, team_members, usage_records, invoices, credit_balances, subscription_events, dunning_attempts, stripe_events) and RLS policies
- [X] T009 Use Supabase MCP apply_migration to run the migration
- [ ] T010 Use Supabase MCP generate_typescript_types to create updated type definitions in src/types/supabase.ts
- [ ] T011 [P] Create billing types in src/types/billing.ts (Plan, Subscription, Invoice, TeamMember, UsageRecord, SubscriptionEvent)
- [ ] T012 [P] Use context7 to fetch Stripe SDK documentation for Customer creation, then implement Stripe client singleton in src/lib/billing/stripe.ts
- [ ] T013 [P] Use context7 to fetch Stripe webhook signature verification documentation, then implement webhook processing utilities in src/lib/billing/webhook.ts (verifyWebhookSignature, handleWebhookEvent)
- [ ] T014 Create POST /api/v1/billing/webhook route in app/api/v1/billing/webhook/route.ts with webhook signature verification and idempotency
- [ ] T015 Update public/openapi.json to add /api/v1/billing/webhook endpoint definition
- [ ] T016 [P] Use Supabase MCP execute_sql to verify stripe_events table idempotency, then test webhook idempotency by inserting duplicate event IDs
- [ ] T017 Use Supabase MCP list_tables to verify all billing tables created correctly
- [ ] T018 Use Supabase MCP get_advisors for security and performance recommendations after schema changes
- [ ] T019 [P] Use context7 to fetch Stripe Checkout Session documentation, then implement session creation helpers in src/lib/billing/subscription.ts (createCheckoutSession, getOrCreateStripeCustomer)
- [ ] T020 [P] Implement quota checking utilities in src/lib/billing/quota.ts (checkUploadQuota, getUsageForPeriod, resetMonthlyUsage)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Individual Plan Upgrade with Immediate Access (Priority: P1) 🎯 MVP

**Goal**: Free-tier user upgrades to Pro plan ($9/month) with immediate premium feature access

**Independent Test**: Create free account, select Pro plan upgrade, enter test payment details (Stripe test card 4242 4242 4242 4242), verify immediate access to premium features and quota change to unlimited

### Implementation for User Story 1

- [ ] T021 [P] [US1] Review project structure to understand existing quota enforcement in upload routes
- [ ] T022 [P] [US1] Use context7 to fetch Stripe Checkout documentation for subscription mode, then create POST /api/v1/billing/create-checkout route in app/api/v1/billing/create-checkout/route.ts
- [ ] T023 [US1] Update public/openapi.json to add /api/v1/billing/create-checkout endpoint with plan type and billing cycle parameters
- [ ] T024 [US1] Implement plan selection logic with Stripe Price ID lookup based on plan type (pro/team) and billing cycle (monthly/annual) in create-checkout route
- [ ] T025 [US1] Add 14-day trial configuration to Checkout Session with payment_method_collection='always' and trial_settings.end_behavior.missing_payment_method='cancel'
- [ ] T026 [P] [US1] Use context7 to fetch Stripe webhook event types documentation, then implement checkout.session.completed webhook handler in src/lib/billing/webhook.ts
- [ ] T027 [US1] Implement customer.subscription.created webhook handler in webhook route to create subscription record in database
- [ ] T028 [US1] Use Supabase MCP execute_sql to verify subscription record creation, then test complete checkout flow: create session → complete payment → verify webhook processing
- [ ] T029 [P] [US1] Create GET /api/v1/billing/subscription route in app/api/v1/billing/subscription/route.ts to return current subscription details
- [ ] T030 [US1] Update public/openapi.json to add /api/v1/billing/subscription endpoint
- [ ] T031 [US1] Implement feature access control in src/lib/billing/quota.ts to check subscription status and return quota limits based on plan
- [ ] T032 [US1] Update existing GET /api/v1/auth/user/usage route to include subscription plan and quota limits in response
- [ ] T033 [US1] Update public/openapi.json to extend /api/v1/auth/user/usage response schema with subscription information
- [ ] T034 [US1] Use Supabase MCP execute_sql to test quota changes after subscription creation, then verify immediate quota update when subscription activates
- [ ] T035 [US1] Use Stripe CLI to test webhook with stripe listen --forward-to localhost:3000/api/v1/billing/webhook and verify event processing

**Checkpoint**: At this point, User Story 1 should be fully functional - users can upgrade to Pro and immediately access premium features

---

## Phase 4: User Story 6 - Usage-Based Quota Enforcement (Priority: P1)

**Goal**: Automatically track uploads against quotas and enforce limits in real-time with upgrade prompts

**Independent Test**: Create free account with 10 uploads/month, upload 10 screenshots, attempt 11th (should fail), upgrade to Pro (unlimited), verify quota allows unlimited uploads

### Implementation for User Story 6

- [ ] T036 [P] [US6] Review existing upload initialization route at app/api/v1/upload/init/route.ts to understand current quota checking
- [ ] T037 [US6] Use context7 to fetch Supabase trigger documentation, then implement monthly usage tracking trigger in existing migration to auto-increment screenshot_count
- [ ] T038 [US6] Enhance quota checking in POST /api/v1/upload/init route to query subscription status and enforce plan-based limits (free=10, pro=unlimited)
- [ ] T039 [US6] Add upgrade prompt to quota exceeded error response with plan information and upgrade URL
- [ ] T040 [US6] Update public/openapi.json to extend upload init error responses with quota information and upgrade details
- [ ] T041 [US6] Implement customer.subscription.updated webhook handler to update profiles.plan when subscription plan changes
- [ ] T042 [US6] Implement customer.subscription.deleted webhook handler to revert user to free plan and enforce free tier quotas
- [ ] T043 [US6] Use Supabase MCP execute_sql to test quota trigger by inserting test screenshots, then verify monthly_usage.screenshot_count increments correctly
- [ ] T044 [US6] Use Supabase MCP execute_sql to set user quota to 10/10, then test quota enforcement: 10th upload succeeds, 11th fails with upgrade message
- [ ] T045 [US6] Use Supabase MCP execute_sql to update user plan to 'pro', then verify quota check allows unlimited uploads
- [ ] T046 [US6] Implement monthly quota reset logic triggered by billing cycle renewal (customer.subscription.updated webhook with period change)

**Checkpoint**: Quota system enforcing limits and driving upgrade path

---

## Phase 5: User Story 4 - Payment Failure Recovery and Dunning (Priority: P1)

**Goal**: Automatically retry failed payments with email notifications and grace period before suspension

**Independent Test**: Use Stripe test card that declines (4000 0000 0000 0002), trigger payment failure, verify retry schedule, check email notifications, confirm 14-day grace period before suspension

### Implementation for User Story 4

- [ ] T047 [P] [US4] Review project structure to understand existing SendGrid email integration in src/lib/email/
- [ ] T048 [P] [US4] Use context7 to fetch Stripe Smart Retries documentation, then configure Smart Retries in Stripe Dashboard with schedule: Day 3, Day 7, Day 14
- [ ] T049 [US4] Implement invoice.payment_failed webhook handler in webhook route to update subscription status to 'past_due' and create dunning_attempt record
- [ ] T050 [US4] Use context7 to fetch SendGrid template creation documentation, then create email template for payment failure notification in src/lib/email/templates/payment-failed.tsx
- [ ] T051 [US4] Implement email notification in invoice.payment_failed webhook handler to send payment failure notice with update payment method link
- [ ] T052 [US4] Implement invoice.payment_succeeded webhook handler to clear past_due status and update subscription to 'active'
- [ ] T053 [P] [US4] Create GET /api/v1/billing/usage/check route in app/api/v1/billing/usage/check/route.ts to verify quota during grace period
- [ ] T054 [US4] Update public/openapi.json to add /api/v1/billing/usage/check endpoint
- [ ] T055 [US4] Implement grace period logic in quota checking to allow uploads for 14 days after payment failure (past_due status)
- [ ] T056 [US4] Implement customer.subscription.updated webhook handler to detect suspension after grace period (status=past_due for 14+ days) and revoke premium access
- [ ] T057 [US4] Use Stripe test webhooks to simulate invoice.payment_failed event and verify dunning_attempt record creation
- [ ] T058 [US4] Use Stripe test webhooks to simulate invoice.payment_succeeded event after failure and verify subscription status restoration
- [ ] T059 [US4] Use Supabase MCP execute_sql to verify dunning_attempts table tracks retry schedule and results

**Checkpoint**: Payment failure recovery maximizes revenue retention with automated dunning

---

## Phase 6: User Story 2 - Team Plan Setup with Multi-User Management (Priority: P2)

**Goal**: Team admin creates Team plan with multi-seat billing, invites members, manages seats with automatic proration

**Independent Test**: Create team subscription with 5 seats, invite 3 members via email, verify access, add 6th seat (verify proration charge), remove member (verify credit)

### Implementation for User Story 2

- [ ] T060 [P] [US2] Review project structure to understand email invitation patterns
- [ ] T061 [P] [US2] Use context7 to fetch Stripe subscription item quantity update documentation for seat management
- [ ] T062 [US2] Extend POST /api/v1/billing/create-checkout route to support team plan with seatCount parameter (minimum 3 seats enforced)
- [ ] T063 [US2] Update public/openapi.json to extend create-checkout endpoint with seatCount parameter for team plans
- [ ] T064 [US2] Implement team record creation in checkout.session.completed webhook handler when planType='team'
- [ ] T065 [P] [US2] Create POST /api/v1/billing/teams route in app/api/v1/billing/teams/route.ts for creating team subscriptions
- [ ] T066 [US2] Update public/openapi.json to add /api/v1/billing/teams endpoint
- [ ] T067 [P] [US2] Create GET /api/v1/billing/teams/[teamId] route in app/api/v1/billing/teams/[teamId]/route.ts to return team details
- [ ] T068 [US2] Update public/openapi.json to add /api/v1/billing/teams/:teamId endpoint
- [ ] T069 [P] [US2] Create POST /api/v1/billing/teams/[teamId]/members route in app/api/v1/billing/teams/[teamId]/members/route.ts for inviting team members
- [ ] T070 [US2] Update public/openapi.json to add /api/v1/billing/teams/:teamId/members endpoint
- [ ] T071 [US2] Use context7 to fetch SendGrid documentation, then create team invitation email template in src/lib/email/templates/team-invitation.tsx
- [ ] T072 [US2] Implement invitation token generation and expiration (7 days) in POST teams/[teamId]/members route
- [ ] T073 [P] [US2] Create POST /api/v1/billing/teams/invitations/accept route in app/api/v1/billing/teams/invitations/accept/route.ts
- [ ] T074 [US2] Update public/openapi.json to add /api/v1/billing/teams/invitations/accept endpoint
- [ ] T075 [US2] Implement team member access grant logic in invitation acceptance to update user profile with team plan features
- [ ] T076 [P] [US2] Create PATCH /api/v1/billing/teams/[teamId] route in app/api/v1/billing/teams/[teamId]/route.ts for updating seat count
- [ ] T077 [US2] Update public/openapi.json to add PATCH /api/v1/billing/teams/:teamId endpoint
- [ ] T078 [US2] Use context7 to fetch Stripe subscription update and proration documentation, then implement seat count update with automatic proration in PATCH teams/[teamId] route
- [ ] T079 [US2] Use Stripe API to calculate prorated charge preview before seat addition using stripe.invoices.retrieveUpcoming()
- [ ] T080 [P] [US2] Create DELETE /api/v1/billing/teams/[teamId]/members/[memberId] route in app/api/v1/billing/teams/[teamId]/members/[memberId]/route.ts
- [ ] T081 [US2] Update public/openapi.json to add DELETE /api/v1/billing/teams/:teamId/members/:memberId endpoint
- [ ] T082 [US2] Implement member removal logic with immediate access revocation and seat count update
- [ ] T083 [US2] Use Supabase MCP execute_sql to verify teams.filled_seats auto-updates via trigger when team_members change
- [ ] T084 [US2] Use Stripe test mode to verify proration calculation when adding seat mid-cycle
- [ ] T085 [US2] Use Stripe test mode to verify credit application when removing seat mid-cycle
- [ ] T086 [US2] Use Supabase MCP execute_sql to test team member invitation flow: create invitation → verify token → accept → verify access granted

**Checkpoint**: Team billing enables higher-value customers with proper seat management

---

## Phase 7: User Story 3 - Plan Downgrade with Credit Application (Priority: P2)

**Goal**: Users can downgrade plans with prorated credits applied to account or refunded

**Independent Test**: Upgrade to Pro, wait partial billing cycle, downgrade to Free, verify prorated credit calculation, confirm premium features active until period end

### Implementation for User Story 3

- [ ] T087 [P] [US3] Review project structure to understand credit balance tracking
- [ ] T088 [P] [US3] Use context7 to fetch Stripe Customer Portal configuration documentation for plan changes
- [ ] T089 [US3] Create POST /api/v1/billing/create-portal route in app/api/v1/billing/create-portal/route.ts to generate Customer Portal session
- [ ] T090 [US3] Update public/openapi.json to add /api/v1/billing/create-portal endpoint
- [ ] T091 [US3] Configure Stripe Customer Portal in Stripe Dashboard to allow plan downgrades with proration_behavior='create_prorations'
- [ ] T092 [US3] Implement customer.subscription.updated webhook handler to detect plan downgrade and calculate prorated credit
- [ ] T093 [US3] Use context7 to fetch Stripe credit note documentation, then implement credit balance creation in credit_balances table when downgrade occurs
- [ ] T094 [US3] Implement invoice.created webhook handler to apply credit_balance to new invoices automatically
- [ ] T095 [US3] Add downgrade scheduling logic to maintain premium access until current_period_end when cancel_at_period_end=true
- [ ] T096 [US3] Update quota checking logic in upload routes to respect current plan until downgrade effective date
- [ ] T097 [US3] Use Stripe test mode to verify credit calculation: $9/month Pro plan, downgrade after 15 days = $4.50 credit
- [ ] T098 [US3] Use Supabase MCP execute_sql to verify credit_balances record created with correct amount after downgrade
- [ ] T099 [US3] Use Stripe invoices API to verify credit applied to next invoice after downgrade

**Checkpoint**: Flexible downgrade process builds trust and reduces churn

---

## Phase 8: User Story 5 - Voluntary Cancellation with Data Retention (Priority: P2)

**Goal**: Users can cancel subscriptions with clear options and 90-day data retention for reactivation

**Independent Test**: Subscribe to Pro, cancel with "end of period" option, verify service continues until period end, confirm data retained 90 days, test reactivation

### Implementation for User Story 5

- [ ] T100 [P] [US5] Review existing Stripe Customer Portal configuration for cancellation options
- [ ] T101 [US5] Create POST /api/v1/billing/subscription/cancel route in app/api/v1/billing/subscription/cancel/route.ts
- [ ] T102 [US5] Update public/openapi.json to add /api/v1/billing/subscription/cancel endpoint with immediate and end-of-period options
- [ ] T103 [US5] Use context7 to fetch Stripe subscription cancellation documentation, then implement end-of-period cancellation with cancel_at_period_end=true in cancel route
- [ ] T104 [US5] Implement immediate cancellation with prorate=true and send invoice.created event for refund calculation
- [ ] T105 [US5] Use context7 to fetch SendGrid templates documentation, then create cancellation confirmation email template in src/lib/email/templates/subscription-canceled.tsx
- [ ] T106 [US5] Implement customer.subscription.deleted webhook handler to update subscription status and create subscription_event audit log
- [ ] T107 [US5] Add data retention timestamp calculation (canceled_at + 90 days) to subscription record when canceled
- [ ] T108 [P] [US5] Create POST /api/v1/billing/subscription/reactivate route in app/api/v1/billing/subscription/reactivate/route.ts
- [ ] T109 [US5] Update public/openapi.json to add /api/v1/billing/subscription/reactivate endpoint
- [ ] T110 [US5] Implement reactivation logic to check data retention period and restore access if within 90 days
- [ ] T111 [US5] Use Stripe test mode to test end-of-period cancellation: verify cancel_at_period_end=true and service continues
- [ ] T112 [US5] Use Stripe test mode to test immediate cancellation: verify prorate calculation and immediate access revocation
- [ ] T113 [US5] Use Supabase MCP execute_sql to verify subscription_events table logs cancellation with reason and timestamp

**Checkpoint**: Transparent cancellation builds trust and enables easy reactivation

---

## Phase 9: User Story 7 - Invoice Generation and Tax Calculation (Priority: P3)

**Goal**: Automatically generate PDF invoices with tax calculation and email delivery

**Independent Test**: Complete subscription purchase with business address in tax jurisdiction (e.g., California), receive invoice via email with tax breakdown, access invoice history

### Implementation for User Story 7

- [ ] T114 [P] [US7] Review project structure to understand existing email infrastructure
- [ ] T115 [P] [US7] Use context7 to fetch Stripe Tax configuration documentation
- [ ] T116 [US7] Configure Stripe Tax in Stripe Dashboard and enable automatic tax calculation for US and EU jurisdictions
- [ ] T117 [US7] Enable tax_id_collection in Checkout Session creation for business customers
- [ ] T118 [US7] Implement invoice.finalized webhook handler to create invoice record in invoices table
- [ ] T119 [US7] Use context7 to fetch Stripe invoice PDF generation documentation, then implement PDF download URL storage in invoice record
- [ ] T120 [P] [US7] Create email template for invoice delivery in src/lib/email/templates/invoice.tsx
- [ ] T121 [US7] Implement invoice.payment_succeeded webhook handler to send invoice email with PDF attachment link
- [ ] T122 [P] [US7] Create GET /api/v1/billing/invoices route in app/api/v1/billing/invoices/route.ts for listing user invoices
- [ ] T123 [US7] Update public/openapi.json to add /api/v1/billing/invoices endpoint with pagination
- [ ] T124 [P] [US7] Create GET /api/v1/billing/invoices/[invoiceId] route in app/api/v1/billing/invoices/[invoiceId]/route.ts
- [ ] T125 [US7] Update public/openapi.json to add /api/v1/billing/invoices/:invoiceId endpoint
- [ ] T126 [US7] Implement invoice filtering by date range and payment status in invoices list route
- [ ] T127 [US7] Use Stripe test mode with test tax calculation to verify tax amount displayed before checkout
- [ ] T128 [US7] Use Stripe test webhooks to simulate invoice.finalized and verify invoice record creation with tax breakdown
- [ ] T129 [US7] Use Supabase MCP execute_sql to verify invoices table stores tax_amount and tax_rate correctly

**Checkpoint**: Professional invoicing supports business customers and tax compliance

---

## Phase 10: User Story 8 - Analytics and Revenue Reporting (Priority: P3)

**Goal**: Provide subscription metrics API for business decision-making

**Independent Test**: Generate test subscription data (10 upgrades, 3 downgrades, 2 cancellations), access analytics API, verify metrics accurately reflect test data

### Implementation for User Story 8

- [ ] T130 [P] [US8] Review project structure to understand existing analytics patterns
- [ ] T131 [P] [US8] Use context7 to fetch PostgreSQL aggregation query documentation for revenue calculations
- [ ] T132 [P] [US8] Implement analytics utilities in src/lib/billing/analytics.ts (calculateMRR, getActiveSubscriptions, getConversionRate, getChurnRate)
- [ ] T133 [P] [US8] Create GET /api/v1/billing/analytics route in app/api/v1/billing/analytics/route.ts
- [ ] T134 [US8] Update public/openapi.json to add /api/v1/billing/analytics endpoint with query parameters for date range and metrics
- [ ] T135 [US8] Implement MRR calculation by aggregating active subscriptions with recurring charges
- [ ] T136 [US8] Implement conversion rate calculation from subscription_events (free → paid transitions)
- [ ] T137 [US8] Implement churn rate calculation from canceled subscriptions within time period
- [ ] T138 [US8] Add payment success rate calculation from invoice payment status
- [ ] T139 [US8] Add dunning recovery rate calculation from dunning_attempts table
- [ ] T140 [US8] Use Supabase MCP execute_sql to verify analytics queries with GROUP BY and aggregate functions
- [ ] T141 [US8] Use Supabase MCP execute_sql to insert test subscription events and verify conversion rate calculation
- [ ] T142 [US8] Test analytics API with date range filters and verify results match manual calculations

**Checkpoint**: Analytics enable data-driven business optimization

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T143 [P] Use Supabase MCP get_advisors with type='security' and type='performance' for final audit recommendations
- [ ] T144 [P] Use context7 to fetch Next.js 15 error handling patterns, then add comprehensive error handling across all billing API routes
- [ ] T145 [P] Use context7 to fetch structured logging best practices for Next.js, then implement logging for all billing operations using centralized logger from src/lib/logger.ts
- [ ] T146 [P] Use context7 to fetch @upstash/ratelimit documentation, then add rate limiting to all billing endpoints (10 payment attempts/hour per user)
- [ ] T147 Use Supabase MCP get_advisors with type='performance' to identify missing indexes, then optimize database queries with proper indexes on subscriptions.status, invoices.user_id, team_members.team_id
- [ ] T148 [P] Use context7 to fetch Stripe webhook retry documentation, then add webhook retry handling with exponential backoff
- [ ] T149 Use Supabase MCP list_tables to review all RLS policies on billing tables, then verify service role access for webhook processing
- [ ] T150 [P] Use context7 to fetch OpenAPI validation tools documentation, then validate all billing routes against contracts/billing-api.yaml
- [ ] T151 [P] Use Supabase MCP execute_sql to analyze webhook processing performance with EXPLAIN ANALYZE
- [ ] T152 Use context7 to fetch Stripe subscription lifecycle best practices, then implement subscription.trial_will_end webhook handler to send trial ending reminder
- [ ] T153 [P] Create trial ending email template in src/lib/email/templates/trial-ending.tsx
- [ ] T154 [P] Create subscription created email template in src/lib/email/templates/subscription-created.tsx
- [ ] T155 Implement customer.subscription.created webhook handler to send welcome email with subscription details
- [ ] T156 Verify all billing API routes are properly reflected in public/openapi.json with correct request/response schemas
- [ ] T157 Use Stripe CLI to test complete subscription lifecycle: trial → active → past_due → active → canceled
- [ ] T158 Use Supabase MCP execute_sql to verify all billing-related triggers fire correctly (quota updates, team seat sync, plan updates)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-10)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 11)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories (MVP core)
- **User Story 6 (P1)**: Depends on US1 - Requires subscription creation flow to test quota updates
- **User Story 4 (P1)**: Depends on US1 - Requires active subscriptions to test payment failures
- **User Story 2 (P2)**: Depends on US1 - Extends checkout with team-specific logic
- **User Story 3 (P2)**: Depends on US1 - Requires active subscription to test downgrades
- **User Story 5 (P2)**: Depends on US1 - Requires active subscription to test cancellation
- **User Story 7 (P3)**: Depends on US1 - Requires invoice generation from successful payments
- **User Story 8 (P3)**: Depends on US1, US3, US5 - Needs subscription lifecycle events for analytics

### Within Each User Story

- Foundation tasks must complete before story implementation
- Tasks marked [P] within a story can run in parallel
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- Database migration tasks can be created in parallel, applied sequentially
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Models/utilities within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

### Critical Path for Documentation Fetching

**IMPORTANT**: Context7, Supabase MCP, and Stripe usage pattern integrated throughout all user stories:

1. **Before starting any task involving external libraries**: Use context7 to fetch latest documentation
2. **Before any database operations**: Use Supabase MCP tools to verify state and test queries
3. **After schema changes**: Always run Supabase MCP get_advisors to catch security issues
4. **During testing**: Use Supabase MCP execute_sql to insert test data and verify behavior
5. **For Stripe operations**: Use Stripe CLI and test mode for webhook simulation

**Context7 Usage Examples** (30+ tasks):
- T001: Fetch Next.js 15 App Router documentation
- T002: Fetch Stripe Node.js SDK documentation
- T003: Fetch @supabase/supabase-js documentation
- T012: Fetch Stripe Customer creation documentation
- T013: Fetch Stripe webhook verification documentation
- T019: Fetch Stripe Checkout Session documentation
- T022: Fetch Stripe Checkout subscription mode documentation
- T026: Fetch Stripe webhook event types documentation
- T037: Fetch Supabase trigger documentation
- T048: Fetch Stripe Smart Retries documentation
- T050: Fetch SendGrid template documentation
- T061: Fetch Stripe subscription quantity update documentation
- T071: Fetch SendGrid documentation for team invitations
- T078: Fetch Stripe proration documentation
- T088: Fetch Stripe Customer Portal configuration documentation
- T093: Fetch Stripe credit note documentation
- T103: Fetch Stripe subscription cancellation documentation
- T115: Fetch Stripe Tax configuration documentation
- T119: Fetch Stripe invoice PDF generation documentation
- T131: Fetch PostgreSQL aggregation query documentation

**Supabase MCP Usage Examples** (25+ tasks):
- T007: Use list_migrations to review existing migrations
- T009: Use apply_migration to apply billing schema migration
- T010: Use generate_typescript_types to create type definitions
- T016: Use execute_sql to test webhook idempotency
- T017: Use list_tables to verify tables created
- T018: Use get_advisors for security/performance audit
- T028: Use execute_sql to verify subscription record creation
- T034: Use execute_sql to test quota changes
- T043: Use execute_sql to test quota trigger
- T044: Use execute_sql to test quota enforcement
- T045: Use execute_sql to verify unlimited quota for Pro
- T057: Use execute_sql to verify dunning attempt tracking
- T083: Use execute_sql to verify team seat auto-update trigger
- T086: Use execute_sql to test invitation flow
- T098: Use execute_sql to verify credit balance creation
- T113: Use execute_sql to verify subscription events logging
- T128: Use execute_sql to verify invoice record with tax
- T140: Use execute_sql to verify analytics queries
- T143: Use get_advisors for final audit
- T147: Use get_advisors to identify missing indexes
- T149: Use list_tables to review RLS policies
- T151: Use execute_sql with EXPLAIN ANALYZE for performance
- T158: Use execute_sql to verify all triggers

**Stripe CLI Usage**:
- T035: Use stripe listen to test webhook locally
- T057: Use Stripe test webhooks for payment failure
- T084: Use Stripe test mode for proration verification
- T097: Use Stripe test mode for credit calculation
- T111: Use Stripe test mode for cancellation flows
- T127: Use Stripe test mode for tax calculation
- T157: Use Stripe CLI for complete lifecycle testing

---

## Parallel Example: User Story 1

```bash
# After Foundational phase completes, launch these in parallel:
Task T021: "Review project structure for quota enforcement patterns"
Task T022: "Use context7 to fetch Stripe Checkout documentation, create checkout route"
Task T026: "Use context7 to fetch webhook events documentation, implement handlers"
Task T029: "Create GET subscription route"
Task T031: "Implement feature access control in quota utilities"

# Then proceed with dependent tasks:
Task T023: "Update OpenAPI spec with create-checkout endpoint" (depends on T022)
Task T027: "Implement subscription.created webhook handler" (depends on T026)
Task T028: "Test complete checkout flow" (depends on T022, T027)
```

---

## Implementation Strategy

### MVP First (User Stories 1, 6, 4 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Individual upgrade)
4. Complete Phase 4: User Story 6 (Quota enforcement)
5. Complete Phase 5: User Story 4 (Payment failure recovery)
6. **STOP and VALIDATE**: Test all three P1 stories independently
7. Deploy/demo MVP

**Rationale**: User Stories 1, 6, and 4 are all P1 priority and represent the minimum viable product - plan upgrades, quota enforcement for business model, and payment reliability for revenue retention.

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP core!)
3. Add User Story 6 → Test independently → Deploy/Demo (Business model!)
4. Add User Story 4 → Test independently → Deploy/Demo (Revenue retention!)
5. Add User Story 2 → Test independently → Deploy/Demo (Team billing)
6. Add User Story 3 → Test independently → Deploy/Demo (Flexibility)
7. Continue with P2/P3 stories as needed
8. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 + 2
   - Developer B: User Story 6 + 3
   - Developer C: User Story 4 + 5
3. Stories complete and integrate independently

---

## Notes

- **[P] tasks**: Different files, no dependencies - can run in parallel
- **[Story] label**: Maps task to specific user story for traceability
- **Context7 usage**: ALWAYS fetch latest docs before implementing features using external libraries
- **Supabase MCP usage**: Use for all database operations (migrations, queries, advisors)
- **Stripe CLI usage**: Use for webhook testing and event simulation in development
- **OpenAPI updates**: ALWAYS update public/openapi.json when creating or modifying API routes
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Quota system enforced at database level with triggers (race condition safe)
- All payment processing via Stripe (PCI compliance, no card storage)
- Webhook idempotency prevents duplicate charges (database-backed)
- All billing operations logged in subscription_events for audit trail

---

## Task Summary

**Total Tasks**: 158 (API-focused, comprehensive billing system)
**MVP Tasks (P1 Stories 1, 6, 4)**: Setup (6) + Foundational (14) + US1 (15) + US6 (11) + US4 (13) = **59 tasks**

**Task Distribution by User Story**:
- Setup: 6 tasks
- Foundational: 14 tasks (BLOCKS all stories)
- User Story 1 (P1): 15 tasks (Individual upgrade - MVP core)
- User Story 6 (P1): 11 tasks (Quota enforcement - Business model)
- User Story 4 (P1): 13 tasks (Payment failure recovery - Revenue retention)
- User Story 2 (P2): 27 tasks (Team billing)
- User Story 3 (P2): 13 tasks (Downgrades)
- User Story 5 (P2): 14 tasks (Cancellation)
- User Story 7 (P3): 16 tasks (Invoices and tax)
- User Story 8 (P3): 13 tasks (Analytics)
- Polish: 16 tasks

**Parallel Opportunities Identified**: 45+ tasks marked [P] can run in parallel within their phases

**Independent Test Criteria (API Testing)**:
- US1: Create free account → Select Pro plan → Complete Stripe Checkout → Verify quota changes to unlimited
- US6: Upload 10 screenshots as free user → Attempt 11th upload → Verify quota error → Upgrade to Pro → Verify quota allows unlimited
- US4: Subscribe with test declining card → Verify payment failure webhook → Check dunning email sent → Verify 14-day grace period → Update payment method → Verify service restored
- US2: Create team with 5 seats → Invite 3 members → Verify access granted → Add 6th seat → Verify prorated charge → Remove member → Verify credit applied
- US3: Upgrade to Pro → Wait 15 days → Downgrade to Free → Verify $4.50 credit → Confirm premium access until period end
- US5: Subscribe to Pro → Cancel at period end → Verify access continues → Test reactivation within 90 days
- US7: Complete purchase with tax jurisdiction address → Verify tax calculated → Receive invoice email → Access invoice history
- US8: Generate test subscription data → Query analytics API → Verify MRR, conversion rate, churn rate accurate

**Suggested MVP Scope**: User Stories 1, 6, 4 (59 tasks total, all P1 priority)
- Delivers core value: Plan upgrades, quota enforcement, payment reliability
- Enables business model validation (free vs pro tiers)
- Can be completed in ~2-3 weeks with single developer
- **Note**: Focus is on robust API-first implementation, no UI components

**Format Validation**: ✅ All tasks follow checklist format with:
- Checkbox `- [ ]` or `- [X]`
- Task ID (T001-T158)
- [P] marker for parallelizable tasks (45+ tasks)
- [Story] label for user story tasks (US1-US8)
- Clear descriptions with exact file paths
- Context7, Supabase MCP, and Stripe usage explicitly integrated
- **API-focused**: All tasks include OpenAPI spec updates for new/modified routes
