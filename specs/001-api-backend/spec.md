# Feature Specification: Core API Backend

**Feature Branch**: `001-api-backend`  
**Created**: 2025-10-17  
**Status**: Draft  
**Input**: Build the core API backend for snappd, a screenshot annotation and sharing tool. This API will power both the browser extension and web dashboard, handling screenshot uploads, user management, and sharing functionality.

## Clarifications

### Session 2025-10-17

- Q: Should free tier monthly usage limits reset on calendar month boundaries (1st of each month) or on the user's signup anniversary date? → A: Calendar month (all users reset on the 1st) - simpler implementation and analytics
- Q: How should the system handle the rare case when a newly generated shareable ID already exists in the database? → A: Retry generation until unique ID found (max 3 attempts, then fail) - standard URL shortener approach
- Q: When a pro user downgrades to free tier, what happens to their existing screenshots that exceed the free tier limit? → A: Grandfathered (all existing screenshots remain accessible, but new uploads limited to 10/month) - preserves user data
- Q: What level of file security scanning should be implemented for uploaded screenshots? → A: MIME type validation only (ensure file is actually an image) - fast and sufficient for MVP
- Q: For free tier users, when does the 30-day expiration countdown start? → A: Upload date (each screenshot expires 30 days after individual upload) - simple and predictable

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Screenshot Upload and Sharing (Priority: P1)

A user captures a screenshot via the browser extension, uploads it to snappd, and immediately receives a shareable link to send to colleagues.

**Why this priority**: This is the core value proposition of snappd - capturing and sharing screenshots quickly. Without this working, the product has no value.

**Independent Test**: Can be fully tested by uploading a screenshot through the API, receiving a unique shareable link, and verifying the link opens the screenshot for anonymous viewers.

**Acceptance Scenarios**:

1. **Given** a user is authenticated, **When** they upload a screenshot (up to 10MB), **Then** the system returns a unique shareable link in format `snappd.app/s/abc123` within 10 seconds
2. **Given** an anonymous user, **When** they visit a valid shareable link, **Then** they see the screenshot with proper metadata (filename, dimensions) and view count increments
3. **Given** a free tier user with 10 screenshots already uploaded this month, **When** they attempt to upload an 11th screenshot, **Then** the system returns an error indicating monthly limit reached
4. **Given** a pro tier user, **When** they upload any number of screenshots, **Then** all uploads succeed without hitting limits

---

### User Story 2 - User Authentication and Plan Management (Priority: P2)

A user signs up for snappd using their Google account, explores the free tier, decides to upgrade to Pro for $9/month, and manages their subscription through Stripe.

**Why this priority**: User authentication and plan management enable the business model. This is essential for tracking usage, enforcing limits, and generating revenue.

**Independent Test**: Can be fully tested by creating an account via OAuth, verifying JWT token issuance, checking plan limits enforcement, upgrading via Stripe, and confirming subscription webhook processing.

**Acceptance Scenarios**:

1. **Given** a new user, **When** they sign up via email/password, Google OAuth, or GitHub OAuth, **Then** a user profile is created with free tier plan and Stripe customer ID
2. **Given** an authenticated user on free tier, **When** they view their account dashboard, **Then** they see current usage (7/10 screenshots used this month) and upgrade option
3. **Given** a free tier user, **When** they click upgrade and complete Stripe checkout for $9/month, **Then** their account is upgraded to pro tier and limits are removed
4. **Given** a pro tier user, **When** their subscription payment fails, **Then** system processes Stripe webhook and downgrades account to free tier with existing screenshots grandfathered
5. **Given** a pro tier user, **When** they cancel subscription, **Then** they retain pro access until end of billing period, then downgrade to free tier with existing screenshots grandfathered

---

### User Story 3 - Screenshot History and Management (Priority: P3)

A user logs into the web dashboard to view their screenshot history, organize screenshots by searching and filtering, and delete old screenshots to free up space.

**Why this priority**: Screenshot management provides long-term value and improves user retention. Users need to find and manage their uploaded content.

**Independent Test**: Can be fully tested by uploading multiple screenshots, fetching paginated history, searching by filename, filtering by date, and deleting specific screenshots with verification.

**Acceptance Scenarios**:

1. **Given** a user with 150 uploaded screenshots, **When** they view their screenshot history, **Then** they see paginated results (50 per page) sorted by newest first
2. **Given** a user viewing their history, **When** they search for "design mockup", **Then** only screenshots with matching filenames appear in results
3. **Given** a user, **When** they delete a screenshot, **Then** the screenshot and all associated metadata are permanently removed and the file is deleted from storage
4. **Given** a free tier user with screenshots older than 30 days, **When** they view their history, **Then** expired screenshots are marked with expiration status and can no longer be accessed via shareable links
5. **Given** a pro tier user with screenshots from 6 months ago, **When** they view their history, **Then** all screenshots remain accessible with no expiration warnings

---

### Edge Cases

- What happens when a user uploads a non-image file or a file with invalid MIME type (rejected by MIME validation)?
- How does the system handle concurrent uploads from the same user (rate limiting)?
- What happens when a free tier user's screenshot expires while an anonymous viewer has the link open?
- How does the system handle Stripe webhook failures or duplicate webhook deliveries?
- What happens when a user tries to access another user's screenshot via URL manipulation?
- How does the system handle HiDPI/Retina screenshots that exceed 10MB after capture?
- What happens during OAuth flow failures (user denies permission, network timeout)?
- What happens when shareable ID generation fails after 3 collision retries (extremely rare scenario)?
- How does the system distinguish between grandfathered screenshots and new uploads when enforcing free tier monthly limits?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept screenshot uploads up to 10MB via multipart/form-data
- **FR-002**: System MUST generate unique 6-character alphanumeric shareable IDs (format: `snappd.app/s/abc123`) and retry up to 3 times on collision before failing
- **FR-003**: System MUST store screenshot files in Supabase Storage with CDN distribution
- **FR-004**: System MUST store screenshot metadata including filename, original dimensions, upload timestamp, user ID, view count, and expiration date
- **FR-005**: System MUST enforce free tier limits: 10 new screenshot uploads per month with each screenshot expiring 30 days after its individual upload date; existing screenshots from prior pro tier are grandfathered (remain accessible but don't count toward new upload limit)
- **FR-006**: System MUST allow pro tier unlimited screenshots with no expiration
- **FR-007**: System MUST support user authentication via email/password, Google OAuth, and GitHub OAuth using Supabase Auth
- **FR-008**: System MUST track monthly usage per user and reset counters on the first day of each calendar month (all users reset simultaneously on the 1st)
- **FR-009**: System MUST integrate with Stripe for subscription management at $9/month for pro tier
- **FR-010**: System MUST process Stripe webhooks for subscription lifecycle events (created, updated, cancelled, payment_failed)
- **FR-011**: System MUST increment view count when anonymous users access shareable links
- **FR-012**: System MUST return API responses under 200ms for metadata operations (view history, get screenshot details)
- **FR-013**: System MUST complete image uploads within 10 seconds for files up to 10MB
- **FR-014**: System MUST apply row-level security policies to prevent users from accessing other users' screenshots
- **FR-015**: System MUST provide pagination for screenshot history (50 items per page)
- **FR-016**: System MUST validate uploaded files are legitimate images via MIME type validation (image/png, image/jpeg, image/gif, image/webp) and reject non-image files before storage
- **FR-017**: System MUST implement rate limiting: 10 uploads per minute per user, 100 API requests per minute per user
- **FR-018**: System MUST support CORS for browser extension access with proper origin validation
- **FR-019**: System MUST provide GDPR-compliant data deletion: complete removal of user profile, screenshots, and metadata
- **FR-020**: System MUST optimize HiDPI/Retina screenshots automatically while preserving quality
- **FR-021**: System MUST include SEO metadata (Open Graph tags) for shareable links
- **FR-022**: System MUST handle expired screenshots: return 410 Gone status with friendly message
- **FR-023**: System MUST support searching screenshot history by filename
- **FR-024**: System MUST support filtering screenshot history by date range
- **FR-025**: System MUST return proper HTTP status codes: 200 (success), 201 (created), 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 410 (gone/expired), 413 (payload too large), 429 (rate limit exceeded), 500 (server error)

### Key Entities

- **User**: Represents a registered snappd user with attributes including unique ID, email, authentication provider (email/google/github), plan type (free/pro), Stripe customer ID, monthly usage counter, account creation date, and last login timestamp
- **Screenshot**: Represents an uploaded screenshot with attributes including unique ID, shareable ID (6-char alphanumeric), owner user ID, original filename, file URL in Supabase Storage, original dimensions (width x height), file size in bytes, upload timestamp, view count, expiration date (null for pro users), and deletion status
- **Subscription**: Represents a user's Stripe subscription with attributes including unique ID, user ID, Stripe subscription ID, plan type, billing status (active/cancelled/past_due), current period start/end dates, and cancellation timestamp

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete the full upload-to-share workflow in under 10 seconds from API call to receiving shareable link
- **SC-002**: API metadata operations (fetching screenshot history, viewing details) respond in under 200ms for 95% of requests
- **SC-003**: System handles 10,000 concurrent users without performance degradation
- **SC-004**: Screenshot uploads complete successfully for files up to 10MB within 10 seconds for 99% of uploads
- **SC-005**: Rate limiting blocks abusive usage patterns while allowing 95% of legitimate requests to proceed
- **SC-006**: Row-level security prevents 100% of unauthorized access attempts to other users' screenshots
- **SC-007**: Free-to-pro conversion funnel tracks user progression with clear analytics on upgrade triggers
- **SC-008**: Stripe webhook processing succeeds for 99.9% of subscription events with automatic retry on failures
- **SC-009**: Anonymous viewers can access and view shared screenshots with page load times under 2 seconds
- **SC-010**: GDPR data deletion requests complete within 30 days with full audit trail
- **SC-011**: System maintains 99.9% uptime for core upload and sharing endpoints
- **SC-012**: Non-image file uploads are detected via MIME type validation and rejected with appropriate error messages, while legitimate image files (PNG, JPEG, GIF, WebP) are accepted without false negatives

## Assumptions

1. **Authentication**: Assuming standard Supabase Auth handles OAuth provider configuration and token management without custom implementation
2. **File Storage**: Assuming Supabase Storage provides automatic CDN distribution and HTTPS URLs for uploaded files
3. **Billing Cycle**: Monthly usage counters reset on calendar month boundaries (1st of each month) for all users simultaneously, simplifying analytics and implementation
4. **Screenshot Expiration**: Each free tier screenshot expires exactly 30 days after its individual upload date (e.g., uploaded March 15th → expires April 14th), providing predictable and fair expiration handling
5. **Rate Limiting**: Assuming rate limits apply per authenticated user (by user ID) and per IP address for anonymous requests
6. **Image Optimization**: Assuming automatic optimization targets web-friendly formats (WebP with JPEG fallback) while preserving legibility
7. **Webhook Idempotency**: Assuming Stripe webhook events include idempotency keys to prevent duplicate processing
8. **Search Functionality**: Assuming filename search uses case-insensitive substring matching without advanced full-text search
9. **Browser Extension**: Assuming extension sends proper authentication tokens and handles API errors gracefully
10. **SEO Requirements**: Assuming shareable links need basic Open Graph metadata (title, image, description) for social media previews
