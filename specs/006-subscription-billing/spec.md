# Feature Specification: Subscription Billing and Payment Management

**Feature Branch**: `006-subscription-billing`
**Created**: 2025-11-05
**Status**: Draft
**Input**: User description: "Build a comprehensive subscription billing and payment management system for ScreenSnap that handles plan upgrades, downgrades, payment processing, and subscription lifecycle management. Users need to be able to upgrade from the free tier to Pro ($9/month) or Team plans ($9/user/month minimum 3 users) with seamless payment processing and immediate access to premium features. The system should support both monthly and annual billing cycles with automatic pro-rating for plan changes and credits for downgrades. The system must handle subscription lifecycle events including trial periods, successful payments, failed payments, dunning management for overdue accounts, and voluntary cancellations with proper data retention policies. Implement usage-based billing features that track screenshot uploads against plan quotas and enforce restrictions in real-time, automatically granting or revoking access to premium features based on subscription status. The billing system should integrate seamlessly with the existing authentication and upload systems to enforce plan-based feature restrictions, providing API endpoints for plan management, payment method handling, and subscription status queries. Include support for team billing with admin controls for adding/removing team members, centralized billing for multiple users, and proper seat management with automatic scaling charges. The system needs to handle edge cases like payment failures during plan upgrades, subscription cancellations with remaining time, refund processing, and account reactivation after cancellation. Provide comprehensive invoice generation and delivery via email, tax calculation for different jurisdictions where required, and compliance with subscription billing regulations. Include analytics and reporting capabilities to track revenue, churn rates, plan conversion metrics, and payment success rates through API endpoints. The system must be secure with PCI compliance for payment data handling, fraud detection capabilities, and secure storage of billing information. All billing operations should provide clear user feedback with confirmation emails, receipt delivery, and transparent communication about charges, renewals, and plan changes through automated email notifications and webhook integrations."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Individual Plan Upgrade with Immediate Access (Priority: P1)

A free-tier user wants to upgrade to the Pro plan ($9/month) to unlock premium features like unlimited screenshot uploads, longer retention periods, and password-protected shares. The user enters their payment information, completes the upgrade, and immediately gains access to premium features without waiting or manual intervention.

**Why this priority**: This is the core revenue-generating feature and the most common user journey. Without this, the business cannot monetize users or provide premium value. This represents the MVP for billing.

**Independent Test**: Can be fully tested by creating a free account, selecting Pro plan upgrade, entering test payment details, and verifying immediate access to premium features (upload quota changes, feature unlocks).

**Acceptance Scenarios**:

1. **Given** a user is on the free plan with 10 screenshot uploads remaining this month, **When** they upgrade to Pro plan and payment succeeds, **Then** their upload quota immediately changes to unlimited, they receive a confirmation email with receipt, and all premium features become accessible
2. **Given** a user selects monthly billing for Pro plan, **When** they complete payment information, **Then** the system charges $9.00, creates a subscription with next billing date 30 days from now, and sends an invoice via email
3. **Given** a user selects annual billing for Pro plan, **When** they complete payment, **Then** the system charges $90.00 (with 17% discount applied), sets next billing date to 365 days from now, and displays the savings amount
4. **Given** a user enters invalid payment information, **When** they attempt to upgrade, **Then** the system displays a clear error message, keeps them on free plan, and allows retry without data loss

---

### User Story 2 - Team Plan Setup with Multi-User Management (Priority: P2)

A team administrator wants to create a Team plan subscription for their organization, starting with 5 seats ($45/month for 5 users). They need to invite team members, manage who has access, add/remove seats as the team grows, and receive a single consolidated invoice for all team members.

**Why this priority**: Team plans represent higher-value customers with more predictable revenue. This is the second most important revenue stream after individual upgrades. It's independently valuable as organizations will specifically seek team billing.

**Independent Test**: Can be fully tested by creating a team subscription with minimum 3 seats, inviting team members via email, verifying each member gets access, adding/removing seats, and confirming billing adjusts automatically.

**Acceptance Scenarios**:

1. **Given** a user wants to create a Team plan, **When** they select Team billing and specify 5 seats, **Then** the system calculates $45/month (5 × $9), enforces minimum 3 seats, and creates a team subscription with the user as admin
2. **Given** a team admin has a 5-seat subscription, **When** they add a 6th team member, **Then** the system immediately charges prorated amount for the remainder of the billing cycle and updates next invoice to $54/month
3. **Given** a team admin invites a new member, **When** the invitation is sent, **Then** the invitee receives an email with join link, and upon acceptance, is immediately granted team plan features
4. **Given** a team admin removes a member mid-cycle, **When** the removal is confirmed, **Then** the member loses premium access immediately, the seat becomes available, and account receives prorated credit applied to next invoice
5. **Given** a team has 5 seats with only 3 filled, **When** the admin views team dashboard, **Then** they see 3 active members, 2 available seats, and are billed for all 5 seats as reserved capacity

---

### User Story 3 - Plan Downgrade with Credit Application (Priority: P2)

A Pro user wants to downgrade to the free plan or a Team admin wants to reduce their seat count. The system should handle the downgrade gracefully, apply prorated credits to future charges or refund if requested, and clearly communicate what features will be lost and when.

**Why this priority**: Proper downgrade handling reduces churn by providing flexibility and builds trust. Users need to feel they can reduce commitment without penalty. This is critical for retention and brand reputation.

**Independent Test**: Can be fully tested by upgrading to Pro, using for partial billing cycle, downgrading to Free, and verifying credit calculation is accurate and premium features remain active until period ends.

**Acceptance Scenarios**:

1. **Given** a user has Pro plan with 15 days remaining in billing cycle, **When** they downgrade to Free plan, **Then** premium features remain active for 15 days, account receives $4.50 credit, and downgrade takes effect at period end
2. **Given** a team admin has 10 seats and wants to reduce to 5 seats, **When** they request reduction, **Then** the system confirms which members will be removed, applies prorated credit for 5 seats, and prevents reduction below 3-seat minimum
3. **Given** a user downgrades and has unused credit of $4.50, **When** they later upgrade again, **Then** the credit is automatically applied to the first invoice, reducing the charge
4. **Given** a user wants to downgrade immediately, **When** they select immediate downgrade option, **Then** the system calculates prorated refund, processes refund to original payment method, and immediately revokes premium access

---

### User Story 4 - Payment Failure Recovery and Dunning (Priority: P1)

A subscriber's payment method expires or has insufficient funds, causing a payment failure. The system should automatically retry payment, notify the user with clear action steps, provide grace period to update payment information, and only suspend service after reasonable attempts to recover payment.

**Why this priority**: Payment failures are a primary cause of involuntary churn. Proper dunning and recovery can save 20-40% of failed payments, directly impacting revenue retention. This is critical for business sustainability.

**Independent Test**: Can be fully tested by simulating expired card scenario, triggering payment failure, verifying retry attempts occur on schedule, checking email notifications are sent, and confirming account suspension timeline.

**Acceptance Scenarios**:

1. **Given** a subscription payment fails on renewal date, **When** the failure is detected, **Then** the system immediately sends email notification, retries payment after 3 days, maintains service access during grace period, and logs the failure event
2. **Given** payment has failed and first retry also fails, **When** 7 days pass since original failure, **Then** the system sends second notification with urgency level increased, attempts second retry, and warns of impending service suspension
3. **Given** payment has failed twice, **When** 14 days pass with no successful payment, **Then** the system sends final warning email, attempts third retry, and if still failing, suspends premium features while preserving account data
4. **Given** a user's account is suspended due to payment failure, **When** they update payment method and manually retry, **Then** payment processes immediately, service is restored within minutes, and subscription resumes normal billing cycle
5. **Given** payment failure occurred but user updates card before retry, **When** automatic retry executes, **Then** the system uses updated payment method, payment succeeds, and user receives confirmation of successful recovery

---

### User Story 5 - Voluntary Cancellation with Data Retention (Priority: P2)

A subscriber wants to cancel their subscription, either immediately or at the end of their current billing period. The system should make cancellation clear and straightforward, confirm what happens to their data, offer options for timing, and provide ability to reactivate later.

**Why this priority**: Transparent cancellation policies build trust and reduce support burden. Users who can easily cancel (and reactivate) are more likely to try premium plans. Poor cancellation experiences damage brand reputation.

**Independent Test**: Can be fully tested by subscribing to Pro, immediately canceling with "end of period" option, verifying service continues until period ends, confirming data retention after cancellation, and testing reactivation flow.

**Acceptance Scenarios**:

1. **Given** a Pro user wants to cancel, **When** they initiate cancellation, **Then** the system offers two options: "Cancel at period end" (default) or "Cancel immediately with prorated refund", explains data retention policy, and requires confirmation
2. **Given** a user selects "Cancel at period end", **When** cancellation is confirmed, **Then** premium features remain active until current period ends, user receives confirmation email, and subscription auto-cancels on end date without further charges
3. **Given** a user selects "Cancel immediately", **When** cancellation is confirmed, **Then** premium access is revoked immediately, prorated refund is calculated and processed, and user receives confirmation with refund amount and timeline
4. **Given** a user's subscription was canceled 30 days ago, **When** they attempt to reactivate, **Then** all previous account data and screenshots are still accessible, they can select a plan and payment method, and service resumes immediately upon payment
5. **Given** a team admin cancels team subscription, **When** cancellation is confirmed, **Then** all team members receive notification, team features remain active until period end, and each member reverts to free plan on cancellation date

---

### User Story 6 - Usage-Based Quota Enforcement (Priority: P1)

The system must automatically track screenshot uploads against plan quotas and enforce limits in real-time. When a user approaches or reaches their quota, the system should notify them, prevent further uploads if quota exceeded (unless upgraded), and automatically reset quotas at the start of each billing cycle.

**Why this priority**: Usage enforcement is critical for fair resource allocation and preventing abuse. Without this, free users could consume unlimited resources, making the business model unsustainable. This is a core requirement for any freemium model.

**Independent Test**: Can be fully tested by creating a free account with 10 uploads/month limit, uploading 10 screenshots, attempting 11th upload (should fail), upgrading to Pro (unlimited), and verifying quota now allows unlimited uploads.

**Acceptance Scenarios**:

1. **Given** a free user has uploaded 8 of 10 screenshots this month, **When** they upload the 9th screenshot, **Then** the system displays a warning "1 upload remaining this month - upgrade to Pro for unlimited", stores the screenshot, and updates quota counter
2. **Given** a free user has reached their 10-upload quota, **When** they attempt to upload another screenshot, **Then** the upload is blocked with message "Monthly quota reached - upgrade to Pro for unlimited uploads", offers upgrade link, and preserves the attempted file for post-upgrade
3. **Given** a free user reaches quota and upgrades to Pro, **When** upgrade payment succeeds, **Then** quota immediately changes to unlimited, previously blocked upload is automatically processed, and user receives confirmation of upgrade and quota change
4. **Given** a Pro user downgrades to Free mid-month with 45 screenshots uploaded, **When** downgrade takes effect at period end, **Then** existing screenshots remain accessible (grandfathered), but new uploads are blocked until next cycle when quota resets to 10
5. **Given** a user's monthly billing cycle renews, **When** the new cycle starts, **Then** quota counters reset to plan limits, user receives email summary of previous month's usage, and new month starts with fresh quota

---

### User Story 7 - Invoice Generation and Tax Calculation (Priority: P3)

The system must automatically generate detailed invoices for all transactions, deliver them via email, calculate applicable taxes based on user location, and provide access to invoice history for accounting purposes.

**Why this priority**: Professional invoicing is required for business customers and tax compliance. While not blocking MVP, it's necessary for scaling to business users and international markets. Many team plan customers require proper invoices for expense reporting.

**Independent Test**: Can be fully tested by completing a subscription purchase with a business address in a tax jurisdiction, receiving invoice via email with tax calculated, and accessing invoice history through account settings.

**Acceptance Scenarios**:

1. **Given** a user completes a subscription payment, **When** payment succeeds, **Then** the system generates PDF invoice with transaction details (date, amount, plan, billing period), sends it via email within 5 minutes, and stores it in account invoice history
2. **Given** a user is located in a tax jurisdiction (e.g., EU, specific US states), **When** they purchase a subscription, **Then** the system calculates applicable tax based on billing address, displays tax amount before payment, includes tax breakdown on invoice, and remits tax appropriately
3. **Given** a team admin makes payment for team subscription, **When** invoice is generated, **Then** invoice includes line items for each seat, prorated charges/credits if applicable, team admin details as billing contact, and company information if provided
4. **Given** a user needs to access past invoices, **When** they view invoice history, **Then** they see all invoices with dates, amounts, payment status, download links for PDFs, and filter options by date range or transaction type

---

### User Story 8 - Analytics and Revenue Reporting (Priority: P3)

Business administrators need access to analytics showing subscription metrics, revenue trends, conversion rates, churn analysis, and payment success rates to make informed business decisions and identify areas for improvement.

**Why this priority**: Analytics are critical for business optimization but not required for core billing functionality. This can be built incrementally after core flows are working. Essential for long-term growth but not blocking for MVP.

**Independent Test**: Can be fully tested by generating test subscription data (upgrades, downgrades, cancellations), accessing analytics dashboard, and verifying metrics accurately reflect the test transactions.

**Acceptance Scenarios**:

1. **Given** an admin accesses revenue analytics, **When** they view the dashboard, **Then** they see metrics including: Monthly Recurring Revenue (MRR), total active subscriptions by plan, conversion rate (free to paid), churn rate, and trends over time
2. **Given** an admin wants to analyze payment health, **When** they view payment analytics, **Then** they see payment success rate, breakdown of failed payment reasons, dunning recovery rate, and average time to payment recovery
3. **Given** an admin wants to understand user behavior, **When** they view plan analytics, **Then** they see upgrade/downgrade patterns, average time from signup to first upgrade, most common plan transitions, and lifetime value by cohort
4. **Given** analytics data is requested via API, **When** authorized client makes API call, **Then** the system returns metrics in structured format with date ranges, filterable by plan type, time period, and aggregation level

---

### Edge Cases

- **Payment failure during plan upgrade**: What happens if a user selects a higher plan but payment fails? (System should keep them on current plan, save their plan selection, and allow retry without re-entering details)

- **Subscription cancellation with unused team seats**: How are credits calculated when a team downsizes significantly mid-cycle? (Calculate prorated credit based on removed seats × remaining days in cycle ÷ total cycle days)

- **Account reactivation after long period**: What if a user reactivates 6 months after cancellation? (All data preserved per retention policy, but expired screenshots may be deleted per existing retention rules)

- **Concurrent plan changes**: What happens if a user upgrades while a downgrade is scheduled for end of period? (Upgrade takes precedence, cancels scheduled downgrade, starts new billing cycle immediately)

- **Failed payment during dunning with concurrent upgrade attempt**: If auto-retry fails but user manually upgrades to different plan, which takes priority? (Manual upgrade succeeds, replaces failed subscription with new one, clears dunning state)

- **Tax jurisdiction change mid-cycle**: If user moves to different tax jurisdiction during subscription, when does new tax rate apply? (New tax rate applies from next billing cycle; current cycle completes with original tax calculation)

- **Partial refund calculation with credits**: If user has $5 credit and downgrades with $8 refund due, how is this handled? (Combine credit + refund = $13 total credit; apply to future charges or refund to payment method per user choice)

- **Team admin role transfer**: If team admin cancels their account but team subscription is active, who manages it? (System requires admin to transfer role before account deletion; prevents orphaned team subscriptions)

- **Proration with annual billing**: How are prorated charges calculated for annual subscriptions when seats are added? (Calculate daily rate: annual cost ÷ 365 × days remaining, charge immediately for prorated amount)

- **Multiple payment methods on file**: If user has backup payment method and primary fails, should system auto-failover? (Yes - attempt backup payment method before entering dunning process; notify user of switch)

- **Quota enforcement during plan transition grace period**: If downgrade is scheduled for end of period, which quota applies during final days? (Current plan quota applies until exact moment of downgrade; prevents premature feature restriction)

- **Invoice generation for $0 transactions**: How are credits-only transactions (no actual charge) invoiced? (Generate invoice showing original charge, credit applied, net $0; maintains complete transaction history)

## Requirements *(mandatory)*

### Functional Requirements

#### Plan Management

- **FR-001**: System MUST support three plan tiers: Free ($0/month), Pro ($9/month), and Team ($9/user/month with 3-user minimum)
- **FR-002**: System MUST support both monthly and annual billing cycles with 17% discount applied to annual subscriptions (e.g., Pro annual = $90/year instead of $108)
- **FR-003**: System MUST allow users to upgrade plans with immediate effect and access to premium features within 60 seconds of successful payment
- **FR-004**: System MUST allow users to downgrade plans with two options: immediate (with prorated refund) or end-of-period (with remaining access)
- **FR-005**: System MUST enforce minimum team size of 3 seats for Team plan and prevent reduction below this threshold
- **FR-006**: System MUST support adding/removing team members with automatic prorated billing adjustments

#### Payment Processing

- **FR-007**: System MUST integrate with Stripe payment processing for all transaction handling (card processing, subscription management, webhook events)
- **FR-008**: System MUST securely tokenize payment information and never store raw card details (PCI compliance via Stripe)
- **FR-009**: System MUST process payments in USD currency
- **FR-010**: System MUST calculate and charge prorated amounts when users upgrade mid-cycle (immediate charge for remainder of period at higher rate)
- **FR-011**: System MUST calculate and apply prorated credits when users downgrade mid-cycle (credit applied to account balance)
- **FR-012**: System MUST support stored payment methods with ability to update or change payment method without interrupting subscription
- **FR-013**: System MUST process refunds to original payment method within 5-10 business days for immediate cancellations and disputed charges

#### Subscription Lifecycle

- **FR-014**: System MUST automatically charge recurring subscription fees on the billing anniversary date (monthly or annual)
- **FR-015**: System MUST support 14-day free trial periods for Pro and Team plans, allowing users to access all premium features without payment during trial, with automatic conversion to paid subscription after trial ends if payment method is provided
- **FR-016**: System MUST send email notifications at least 7 days before subscription renewal with upcoming charge amount and date
- **FR-017**: System MUST allow users to cancel subscriptions at any time with clear confirmation of when cancellation takes effect
- **FR-018**: System MUST preserve user data for 90 days after subscription cancellation to enable reactivation
- **FR-019**: System MUST allow reactivation of canceled subscriptions with restoration of all preserved data

#### Payment Failure and Dunning

- **FR-020**: System MUST automatically retry failed payments on the following schedule: Day 3, Day 7, Day 14 after initial failure
- **FR-021**: System MUST send email notifications after each failed payment attempt with instructions to update payment method
- **FR-022**: System MUST maintain premium feature access for 14 days after initial payment failure (grace period) to allow recovery
- **FR-023**: System MUST suspend premium features (but preserve account and data) after 14 days of unsuccessful payment retry attempts
- **FR-024**: System MUST allow manual payment retry by user at any time during dunning process
- **FR-025**: System MUST automatically restore service within 5 minutes when user updates payment method and payment succeeds during dunning

#### Usage-Based Quotas

- **FR-026**: System MUST track screenshot upload count per user per billing cycle and enforce plan-based quotas in real-time
- **FR-027**: System MUST enforce the following upload quotas: Free (10 uploads/month), Pro (unlimited), Team (unlimited per team member)
- **FR-028**: System MUST reset usage counters at the start of each billing cycle (monthly or annual anniversary date)
- **FR-029**: System MUST display remaining quota to users during upload process with warnings at 80% and 100% usage
- **FR-030**: System MUST block screenshot uploads when quota is exceeded and display upgrade prompt with direct link to plan selection
- **FR-031**: System MUST immediately update quota limits when user upgrades or downgrades plan (no delay)
- **FR-032**: System MUST grandfather existing screenshots when user downgrades (keep accessible but block new uploads beyond free tier quota)

#### Feature Access Control

- **FR-033**: System MUST grant/revoke premium features based on active subscription status with synchronization across all user sessions
- **FR-034**: System MUST enforce plan-based feature restrictions including: password-protected shares (Pro/Team only), extended retention beyond 30 days (Pro/Team only), custom share links (Pro/Team only), priority upload processing (Pro/Team only)
- **FR-035**: System MUST maintain feature access until end of billing period even after cancellation request (unless immediate cancellation selected)

#### Team Billing and Management

- **FR-036**: System MUST designate one user as Team Admin with permissions to invite members, remove members, view billing, and manage subscription
- **FR-037**: System MUST send email invitations to team members with secure join links that expire after 7 days
- **FR-038**: System MUST grant team plan features to invited members immediately upon invitation acceptance
- **FR-039**: System MUST generate single consolidated invoice for team subscription showing per-seat cost and total team cost
- **FR-040**: System MUST calculate seat charges as: (number of seats × $9) regardless of whether all seats are filled
- **FR-041**: System MUST allow Team Admin to transfer admin role to another team member before account deletion
- **FR-042**: System MUST prevent Team Admin account deletion if they are the sole admin (must transfer role first)

#### Invoicing and Tax

- **FR-043**: System MUST generate PDF invoices for all transactions including: subscription charges, upgrades, downgrades, refunds, and seat changes
- **FR-044**: System MUST send invoices via email within 5 minutes of transaction completion
- **FR-045**: System MUST store all invoices in user account with permanent access via invoice history page
- **FR-046**: System MUST calculate and collect sales tax based on user billing address for applicable jurisdictions
- **FR-047**: System MUST display tax amount separately before payment confirmation for transparency
- **FR-048**: System MUST include tax breakdown on invoices with jurisdiction and rate applied

#### Analytics and Reporting

- **FR-049**: System MUST provide API endpoints for retrieving subscription analytics including: MRR, active subscriptions by plan, conversion rates, churn rate
- **FR-050**: System MUST track payment success rate, failed payment reasons, and dunning recovery rate
- **FR-051**: System MUST calculate customer lifetime value (LTV) and average revenue per user (ARPU) metrics
- **FR-052**: System MUST provide analytics data via API with filtering by date range, plan type, and user cohort

#### Security and Compliance

- **FR-053**: System MUST comply with PCI DSS standards by using Stripe for all payment processing (no card data stored in application database)
- **FR-054**: System MUST use HTTPS for all payment and billing-related API endpoints
- **FR-055**: System MUST log all subscription changes (upgrades, downgrades, cancellations) with timestamp and user ID for audit trail
- **FR-056**: System MUST implement rate limiting on payment API endpoints to prevent abuse (max 10 payment attempts per hour per user)
- **FR-057**: System MUST validate webhook signatures from Stripe to prevent fraudulent payment events
- **FR-058**: System MUST implement idempotency for webhook processing to prevent duplicate charges from retry attempts

#### Email Notifications

- **FR-059**: System MUST send confirmation emails for: subscription creation, plan upgrades, plan downgrades, cancellations, payment successes, payment failures
- **FR-060**: System MUST send renewal reminder emails 7 days before next billing date with charge amount
- **FR-061**: System MUST send invoice emails immediately after each successful payment
- **FR-062**: System MUST send dunning emails after each failed payment retry with clear call-to-action to update payment method
- **FR-063**: System MUST send team invitation emails with join links and expiration notice

#### API Endpoints

- **FR-064**: System MUST provide REST API endpoints for: listing available plans, creating subscriptions, upgrading/downgrading plans, canceling subscriptions, updating payment methods, retrieving subscription status, viewing usage quotas
- **FR-065**: System MUST require authentication for all billing API endpoints using existing JWT/session authentication
- **FR-066**: System MUST return subscription status in user profile API response including: current plan, billing cycle, next billing date, payment status
- **FR-067**: System MUST provide webhook endpoint to receive Stripe events including: payment succeeded, payment failed, subscription canceled, subscription updated

### Key Entities *(include if feature involves data)*

- **Subscription**: Represents a user's active or canceled subscription with attributes: plan type (Free/Pro/Team), billing cycle (monthly/annual), status (active/canceled/past_due/suspended), current period start/end dates, next billing date, payment method reference

- **Plan**: Defines available subscription tiers with attributes: name (Free/Pro/Team), base price, billing interval (month/year), quota limits (uploads per month), feature flags (password protection, extended retention, etc.)

- **Invoice**: Record of all financial transactions with attributes: invoice number, date, line items (description, quantity, unit price), subtotal, tax amount, total amount, payment status, PDF file reference

- **Payment Method**: Tokenized reference to user's payment information with attributes: Stripe payment method ID, card brand, last 4 digits, expiration date, billing address, default flag

- **Team**: Represents a team subscription with attributes: team name, admin user ID, seat count, filled seats, team member list, billing contact information

- **Team Member**: Association between user and team with attributes: user ID, team ID, role (admin/member), invitation status (pending/accepted), join date

- **Usage Record**: Tracks resource consumption against quotas with attributes: user ID, billing period start/end, screenshot upload count, storage bytes used, bandwidth bytes consumed

- **Subscription Event**: Audit log of subscription changes with attributes: event type (created/upgraded/downgraded/canceled/payment_failed), timestamp, user ID, old plan, new plan, reason, metadata

- **Credit Balance**: Tracks account credits from downgrades/refunds with attributes: user ID, current balance, expiration date, transaction history (credit added/applied)

- **Dunning Attempt**: Records payment recovery attempts with attributes: subscription ID, attempt number (1-3), attempt date, payment result, next retry date, notification sent flag

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete plan upgrade from Free to Pro in under 2 minutes with immediate access to premium features within 60 seconds of payment confirmation

- **SC-002**: System achieves 95% payment success rate for valid payment methods with functioning dunning process recovering at least 30% of initially failed payments

- **SC-003**: Invoice generation and email delivery completes within 5 minutes for 99% of transactions

- **SC-004**: Quota enforcement prevents unauthorized uploads with 100% accuracy (zero cases of free users exceeding limits or paid users being blocked incorrectly)

- **SC-005**: Plan transitions (upgrades/downgrades) calculate prorated amounts with 100% accuracy (verified against manual calculations in test scenarios)

- **SC-006**: System handles 1,000 concurrent subscription operations without performance degradation or failed transactions

- **SC-007**: Users can access complete invoice history with download functionality, achieving 100% invoice retrieval success rate

- **SC-008**: Team subscription management (add/remove members) completes within 30 seconds with automatic billing adjustment reflected in next invoice

- **SC-009**: Cancellation requests process within 1 minute with confirmation email delivered within 5 minutes, and users retain access until period end for non-immediate cancellations

- **SC-010**: Analytics API endpoints return metrics within 2 seconds for standard date ranges (1 month, 3 months, 1 year)

- **SC-011**: Webhook processing from Stripe completes within 10 seconds with zero duplicate transaction processing due to idempotency implementation

- **SC-012**: Failed payment dunning process sends reminder emails within 1 hour of each retry attempt with clear instructions that achieve at least 40% user engagement (email open rate)

- **SC-013**: System maintains 99.9% uptime for billing API endpoints during business hours

- **SC-014**: Subscription conversion rate (free to paid) improves by at least 15% compared to baseline with clear upgrade prompts and quota warnings

- **SC-015**: Customer support tickets related to billing confusion or errors reduce by 60% after implementation due to clear email communications and transparent pricing
