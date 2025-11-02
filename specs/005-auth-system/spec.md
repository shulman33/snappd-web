# Feature Specification: Comprehensive Authentication System

**Feature Branch**: `005-auth-system`
**Created**: 2025-11-02
**Status**: Draft
**Input**: User description: "Build a comprehensive authentication system for Snappd that handles user registration, login, session management, and account security. The system should support multiple authentication methods including email/password, social OAuth (Google, GitHub), and magic link authentication for passwordless login. Users need to be able to create accounts, verify their email addresses, securely log in and out, reset forgotten passwords, and manage their authentication preferences. The system should handle user sessions across the browser extension and web dashboard, ensuring users stay logged in appropriately while maintaining security. Include proper rate limiting to prevent abuse, secure password requirements, and account lockout mechanisms for security. The authentication system should integrate seamlessly with our existing user profiles and billing system, automatically creating user profiles when accounts are created and linking to Stripe customer records for paid users. Users should be able to delete their accounts completely, update their email addresses with proper verification, and manage connected social accounts. The system needs to work reliably across different browsers and handle edge cases like expired sessions, concurrent logins, and authentication state synchronization between the extension and web app. All authentication flows should be user-friendly with clear error messages and recovery options when things go wrong."

## Clarifications

### Session 2025-11-02

- Q: Where will Supabase Auth user accounts be stored? → A: In Supabase's auth.users schema (managed by Supabase Auth), with profiles table referencing auth.users.id via foreign key
- Q: Which session storage mechanism should be used for authentication tokens? → A: HTTP-only cookies (immune to XSS, accessible server-side, works across web and extension with proper setup)
- Q: How should the browser extension synchronize authentication state changes with the web dashboard? → A: Polling with exponential backoff - checks every 10-30s when active, simpler infrastructure, acceptable 30s lag
- Q: What should be the scope of rate limiting for failed login attempts? → A: Both: 5 failed attempts per account + 20 failed attempts per IP within 15 minutes (defense-in-depth, best security)
- Q: How should the system handle email delivery failures for authentication emails? → A: Retry with exponential backoff + notify user

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Email/Password Account Creation (Priority: P1)

A new user wants to create an account using their email address and password to start using Snappd for screenshot management.

**Why this priority**: This is the foundational authentication method that enables users to access the platform. Without this, users cannot create accounts or use the service. It's the baseline requirement for all other features.

**Independent Test**: Can be fully tested by submitting a registration form with valid credentials, confirming the email verification link works, and successfully logging in with the new account. Delivers immediate value by allowing users to create and access their Snappd account.

**Acceptance Scenarios**:

1. **Given** a user visits the registration page, **When** they enter a valid email, a strong password (meeting requirements), and submit the form, **Then** they receive a verification email and see a confirmation message
2. **Given** a user has received a verification email, **When** they click the verification link, **Then** their email is verified and they are redirected to the dashboard
3. **Given** a user enters an email that already exists, **When** they submit the registration form, **Then** they see an error message indicating the email is already in use
4. **Given** a user enters a weak password, **When** they submit the registration form, **Then** they see validation errors explaining password requirements
5. **Given** a user successfully registers, **When** the account is created, **Then** a profile record is automatically created with 'free' plan tier

---

### User Story 2 - Secure Login and Session Management (Priority: P1)

A registered user wants to log in securely to access their screenshots and manage their account, with their session persisting appropriately across browser sessions.

**Why this priority**: Login is essential for existing users to access their accounts. Without reliable session management, users would be constantly forced to re-authenticate, creating a poor user experience. This is critical for both web dashboard and browser extension usage.

**Independent Test**: Can be tested by logging in with valid credentials, verifying the session persists across page refreshes and browser tabs, and confirming the user remains logged in until they explicitly log out or the session expires. Delivers value by providing secure, seamless access to the platform.

**Acceptance Scenarios**:

1. **Given** a verified user enters correct credentials, **When** they submit the login form, **Then** they are redirected to their dashboard and a secure session is established
2. **Given** a user enters incorrect credentials, **When** they submit the login form, **Then** they see a generic error message ("Invalid email or password") to prevent account enumeration
3. **Given** a user is logged in, **When** they close and reopen their browser, **Then** they remain logged in if the session hasn't expired (configurable duration, default 7 days)
4. **Given** a user exceeds the maximum login attempts (5 failed attempts per account), **When** they try to log in again, **Then** their account is temporarily locked for 15 minutes
5. **Given** an IP address exceeds the maximum login attempts (20 failed attempts across any accounts), **When** another login is attempted from that IP, **Then** the IP is temporarily blocked for 15 minutes
6. **Given** a user is logged in on both the web dashboard and browser extension, **When** they perform an action on either platform, **Then** their authentication state is synchronized across both

---

### User Story 3 - Password Reset and Recovery (Priority: P1)

A user who forgot their password needs a secure way to regain access to their account without contacting support.

**Why this priority**: Users frequently forget passwords, and without a self-service recovery mechanism, this creates friction and support burden. This is essential for maintaining user access and reducing abandonment.

**Independent Test**: Can be tested by requesting a password reset, receiving the reset email with a time-limited token, setting a new password, and successfully logging in with the new credentials. Delivers value by restoring user access without support intervention.

**Acceptance Scenarios**:

1. **Given** a user clicks "Forgot Password", **When** they enter their registered email and submit, **Then** they receive a password reset email with a secure token (valid for 1 hour)
2. **Given** a user clicks the reset link in their email, **When** they enter a new password meeting requirements, **Then** their password is updated and they can log in immediately
3. **Given** a user attempts to use an expired reset token (>1 hour old), **When** they try to reset their password, **Then** they see an error message and can request a new reset link
4. **Given** a user requests multiple password resets rapidly, **When** they exceed rate limits (3 requests per hour), **Then** subsequent requests are throttled with a clear error message
5. **Given** a user successfully resets their password, **When** the change is complete, **Then** all existing sessions are invalidated except the current one

---

### User Story 4 - Social OAuth Authentication (Priority: P2)

A user wants to register or log in using their existing Google or GitHub account for a faster, passwordless authentication experience.

**Why this priority**: OAuth provides convenience and security for users who prefer not to manage another password. While not critical for MVP, it significantly improves user experience and reduces registration friction, leading to higher conversion rates.

**Independent Test**: Can be tested by clicking "Continue with Google/GitHub", being redirected to the provider's authorization page, granting permissions, and being returned to Snappd with an authenticated session and automatically created profile. Delivers value by offering alternative authentication methods.

**Acceptance Scenarios**:

1. **Given** a new user clicks "Continue with Google", **When** they authorize Snappd access, **Then** an account is created automatically with their email from the OAuth provider and they are logged in
2. **Given** an existing user with email/password clicks "Continue with Google" using the same email, **When** they authorize access, **Then** the OAuth provider is linked to their existing account
3. **Given** a user registers via GitHub OAuth, **When** their account is created, **Then** a profile is created with their email and name from GitHub
4. **Given** a user's OAuth token expires or is revoked, **When** they try to access the platform, **Then** they are prompted to re-authenticate with the OAuth provider
5. **Given** a user has both email/password and OAuth linked, **When** they log in using either method, **Then** they access the same account

---

### User Story 5 - Magic Link Passwordless Authentication (Priority: P2)

A user wants to log in by receiving a secure link via email, avoiding the need to remember or type a password.

**Why this priority**: Magic links provide excellent UX for users who prefer passwordless authentication and are particularly useful for mobile users. While not critical for launch, this modern authentication method enhances accessibility and security.

**Independent Test**: Can be tested by entering an email address, receiving a magic link email, clicking the link, and being automatically logged in. Delivers value by providing a secure, password-free authentication option.

**Acceptance Scenarios**:

1. **Given** a registered user enters their email and requests a magic link, **When** they click the link in their email (valid for 15 minutes), **Then** they are automatically logged in
2. **Given** a new user requests a magic link, **When** they click the link, **Then** an account is created for them and they are logged in
3. **Given** a user requests multiple magic links, **When** they exceed rate limits (5 requests per hour), **Then** subsequent requests are throttled
4. **Given** a user clicks an expired magic link, **When** they try to authenticate, **Then** they see an error message and can request a new link
5. **Given** a user has an active session, **When** they click a magic link, **Then** they are logged in without disrupting existing sessions

---

### User Story 6 - Email Address Management (Priority: P3)

A user wants to update their email address for account communications and login, with proper verification to ensure they own the new email.

**Why this priority**: Email updates are infrequent but necessary for account maintenance. This can be implemented after core authentication flows are stable, as users can still use the platform without this feature.

**Independent Test**: Can be tested by initiating an email change, receiving verification emails to both old and new addresses, confirming the change, and logging in with the new email. Delivers value by allowing users to maintain accurate contact information.

**Acceptance Scenarios**:

1. **Given** a logged-in user navigates to account settings, **When** they enter a new email and submit, **Then** verification emails are sent to both old and new addresses
2. **Given** a user has pending email change verification, **When** they verify both emails within 24 hours, **Then** their email is updated and they receive confirmation
3. **Given** a user attempts to change to an email already in use, **When** they submit the form, **Then** they see an error message indicating the email is unavailable
4. **Given** a user verifies a new email, **When** the change is complete, **Then** all future communications and login use the new email
5. **Given** a user has OAuth providers linked, **When** they change their email, **Then** OAuth connections remain active and functional

---

### User Story 7 - Connected Account Management (Priority: P3)

A user wants to view and manage which OAuth providers are connected to their account, with the ability to link or unlink Google and GitHub accounts.

**Why this priority**: Account management is important for security-conscious users, but can be added after OAuth authentication is working. Users can still access their accounts without this management interface.

**Independent Test**: Can be tested by viewing connected accounts in settings, linking a new OAuth provider, unlinking an existing provider (with safeguards), and confirming the changes persist. Delivers value by giving users control over their authentication methods.

**Acceptance Scenarios**:

1. **Given** a logged-in user navigates to account settings, **When** they view connected accounts, **Then** they see all linked OAuth providers with connection dates
2. **Given** a user wants to add a provider, **When** they click "Connect Google/GitHub" and authorize, **Then** the provider is linked to their account
3. **Given** a user has both email/password and OAuth providers, **When** they unlink an OAuth provider, **Then** they can still access their account via other methods
4. **Given** a user only has one authentication method, **When** they attempt to unlink it, **Then** they are prevented with a warning to add another method first
5. **Given** a user unlinks an OAuth provider, **When** they try to log in with that provider, **Then** they are prompted to re-link or use alternative authentication

---

### User Story 8 - Account Deletion (Priority: P3)

A user wants to permanently delete their Snappd account and all associated data, with clear understanding of the consequences.

**Why this priority**: Account deletion is required for privacy compliance (GDPR, CCPA), but is used infrequently and can be implemented after core features are stable. This is essential for legal compliance but not for day-to-day usage.

**Independent Test**: Can be tested by initiating account deletion, confirming with password verification, and verifying that the account, profile, screenshots, and user data are completely removed from the system. Delivers value by respecting user privacy and complying with data protection regulations.

**Acceptance Scenarios**:

1. **Given** a logged-in user navigates to account settings, **When** they click "Delete Account" and confirm their intent, **Then** they are prompted to verify their password
2. **Given** a user confirms account deletion, **When** they submit their password, **Then** their account, profile, all screenshots, and usage data are permanently deleted
3. **Given** a user deletes their account, **When** the deletion is complete, **Then** they cannot log in with those credentials again and receive a confirmation email
4. **Given** a user has an active Stripe subscription, **When** they delete their account, **Then** the subscription is cancelled and the Stripe customer record is marked as deleted
5. **Given** a user's account is deleted, **When** they attempt to use the same email to register again, **Then** they can create a new account (email becomes available again)

---

### Edge Cases

- **Concurrent Login Attempts**: What happens when a user tries to log in from multiple devices/browsers simultaneously?
  - Expected: All login attempts should be allowed; sessions are independent and managed separately for each device/browser

- **Session Expiration During Active Use**: How does the system handle a session expiring while a user is actively using the extension or web app?
  - Expected: User is prompted to re-authenticate without losing unsaved work; graceful degradation with clear messaging

- **Email Verification Link Expiration**: What happens if a user clicks a verification link after it has expired?
  - Expected: Clear error message with option to resend verification email; user account remains unverified until confirmed

- **OAuth Provider Service Outage**: How does the system handle authentication when Google or GitHub OAuth services are unavailable?
  - Expected: Display appropriate error message; users with email/password can still authenticate; retry mechanism for OAuth

- **Race Condition on Account Creation**: What happens if a user submits registration twice rapidly or from multiple tabs?
  - Expected: System prevents duplicate accounts via database constraints; only one account created; clear error on subsequent attempts

- **Password Reset During Active Session**: How does the system handle a password reset request when the user is already logged in?
  - Expected: Allow password reset; inform user they're already logged in; optionally invalidate other sessions

- **Cross-Platform Session Synchronization Lag**: What happens if auth state changes in the web app but hasn't synced to the extension yet?
  - Expected: Extension polls for auth state changes using exponential backoff (10-30 second intervals); maximum lag of 30 seconds; poll resets to 10s interval on user activity

- **Malformed OAuth Responses**: How does the system handle unexpected or malicious data from OAuth providers?
  - Expected: Validate all OAuth responses; reject invalid data; log security events; display generic error to user

- **Account Lockout Recovery**: What happens when a user's account is locked due to failed login attempts and they've lost access to their email?
  - Expected: User must wait for automatic lockout expiration (15 minutes); no additional recovery mechanisms provided; lockout automatically lifts after timeout period

- **Shared IP Rate Limiting**: What happens when multiple legitimate users share an IP address (office, VPN, public WiFi) and the IP gets rate limited?
  - Expected: IP-based limit set higher (20 attempts vs 5 per account) to accommodate shared IPs; individual accounts can still be locked independently at 5 attempts; both limits reset after 15 minutes; users on blocked IP see clear error message indicating temporary block

- **Email Bounce on Critical Authentication Emails**: What happens when verification, password reset, or magic link emails bounce?
  - Expected: System retries email delivery using exponential backoff (3 attempts: immediate, 2min, 5min); logs all delivery attempts and failures; after final failure, displays user-friendly error message with options to update email address or contact support

- **Token Replay Attacks**: How does the system prevent reuse of password reset tokens, magic links, or email verification links?
  - Expected: Single-use tokens; invalidate after use; validate token hasn't been consumed; log suspicious activity

- **Profile Creation Failures**: What happens if account creation succeeds but profile creation in the database fails?
  - Expected: Roll back the entire account creation using database transaction; ensure atomicity between authentication account and profile creation; user receives error message and must retry registration

## Requirements *(mandatory)*

### Functional Requirements

**Authentication Methods**

- **FR-001**: System MUST support email/password authentication with secure password hashing
- **FR-002**: System MUST support OAuth authentication via Google and GitHub providers
- **FR-003**: System MUST support magic link authentication via email for passwordless login
- **FR-004**: System MUST allow users to have multiple authentication methods linked to a single account
- **FR-005**: System MUST prevent account creation with duplicate email addresses across all authentication methods

**Registration and Verification**

- **FR-006**: System MUST require email verification for new accounts created with email/password
- **FR-007**: System MUST send verification emails within 1 minute of account creation
- **FR-008**: System MUST generate secure, time-limited verification tokens (valid for 24 hours)
- **FR-009**: System MUST automatically create a user profile with 'free' plan tier upon successful registration
- **FR-010**: System MUST validate email format before accepting registration requests
- **FR-011**: System MUST enforce password requirements: minimum 8 characters, at least one uppercase letter, one lowercase letter, one number, and one special character
- **FR-012**: System MUST retry failed email deliveries using exponential backoff: 3 attempts over 5 minutes (immediate, 2min, 5min) for transient failures
- **FR-013**: System MUST display user-friendly error message after final email delivery failure with options to update email address or contact support
- **FR-014**: System MUST log all email delivery attempts and failures for debugging and monitoring purposes

**Session Management**

- **FR-015**: System MUST create secure session tokens upon successful authentication and store them in HTTP-only cookies
- **FR-016**: System MUST maintain sessions for a configurable duration (default 7 days)
- **FR-017**: System MUST support concurrent sessions across multiple devices and browsers
- **FR-018**: System MUST synchronize authentication state between web dashboard and browser extension within 30 seconds using polling with exponential backoff (10-30 second intervals when extension is active)
- **FR-019**: System MUST invalidate sessions upon user logout by clearing HTTP-only cookies and revoking server-side session records
- **FR-020**: System MUST automatically extend session expiration on user activity (sliding window)
- **FR-021**: System MUST detect and handle expired sessions gracefully with re-authentication prompts
- **FR-022**: System MUST set appropriate cookie security flags: HttpOnly, Secure (HTTPS-only), SameSite=Lax for CSRF protection
- **FR-023**: Browser extension MUST implement polling with exponential backoff to check auth state: start at 10s intervals, increase to maximum 30s when idle, reset to 10s on user activity

**Password Management**

- **FR-024**: System MUST provide password reset functionality via email
- **FR-025**: System MUST generate secure, time-limited password reset tokens (valid for 1 hour)
- **FR-026**: System MUST invalidate all other sessions when a password is successfully reset (except the current session)
- **FR-027**: System MUST allow users to change their password when authenticated
- **FR-028**: System MUST require current password verification before allowing password changes

**Security and Rate Limiting**

- **FR-029**: System MUST implement dual-scope rate limiting on login attempts: (1) maximum 5 failed attempts per account within 15 minutes, AND (2) maximum 20 failed attempts per IP address within 15 minutes
- **FR-030**: System MUST temporarily lock accounts for 15 minutes after exceeding per-account failed login limit (5 attempts)
- **FR-031**: System MUST temporarily block IP addresses for 15 minutes after exceeding per-IP failed login limit (20 attempts)
- **FR-032**: System MUST implement rate limiting on password reset requests: maximum 3 requests per hour per email
- **FR-033**: System MUST implement rate limiting on magic link requests: maximum 5 requests per hour per email
- **FR-034**: System MUST implement rate limiting on email verification resend: maximum 3 requests per hour per email
- **FR-035**: System MUST prevent account enumeration by showing generic error messages for failed logins
- **FR-036**: System MUST ensure all authentication tokens are single-use (verification, reset, magic links)
- **FR-037**: System MUST log all authentication events including source IP address (login, logout, failed attempts, password changes, rate limit triggers) for security audit
- **FR-038**: System MUST track failed login attempts by both account identifier and source IP address independently to enable defense-in-depth rate limiting

**OAuth Integration**

- **FR-039**: System MUST handle OAuth authorization codes and exchange them for access tokens securely
- **FR-040**: System MUST extract user email and name from OAuth provider responses
- **FR-041**: System MUST link OAuth providers to existing accounts when emails match
- **FR-042**: System MUST create new accounts automatically for new OAuth users
- **FR-043**: System MUST handle OAuth errors gracefully and provide clear user feedback
- **FR-044**: System MUST store minimal OAuth provider information (provider name, provider user ID, linked date)

**Account Management**

- **FR-045**: Users MUST be able to update their email address with verification of both old and new addresses
- **FR-046**: System MUST send verification emails to both old and new addresses for email changes
- **FR-047**: System MUST complete email changes only after both addresses are verified within 24 hours
- **FR-048**: Users MUST be able to view all connected OAuth providers in account settings
- **FR-049**: Users MUST be able to link additional OAuth providers to their account
- **FR-050**: Users MUST be able to unlink OAuth providers if they have at least one other authentication method
- **FR-051**: System MUST prevent users from removing their last authentication method
- **FR-052**: Users MUST be able to delete their account completely

**Account Deletion**

- **FR-053**: System MUST require password verification (or OAuth re-authentication) before account deletion
- **FR-054**: System MUST permanently delete user profiles, screenshots, usage data, and authentication records upon account deletion
- **FR-055**: System MUST cancel active Stripe subscriptions when accounts are deleted
- **FR-056**: System MUST send confirmation email after successful account deletion
- **FR-057**: System MUST make the email address available for re-registration after account deletion

**Error Handling and User Experience**

- **FR-058**: System MUST provide clear, actionable error messages for all authentication failures
- **FR-059**: System MUST allow users to resend verification emails if not received
- **FR-060**: System MUST provide recovery options when tokens expire (resend verification, request new reset link)
- **FR-061**: System MUST redirect users appropriately after successful authentication (return to intended page)
- **FR-062**: System MUST display loading indicators during authentication processes
- **FR-063**: System MUST handle network failures gracefully with retry mechanisms and user feedback

**Integration with Existing Systems**

- **FR-064**: System MUST integrate with existing profiles table (id, email, full_name, plan, stripe_customer_id, stripe_subscription_id)
- **FR-065**: System MUST ensure profile creation in the profiles table happens atomically with account creation in auth.users, using a database trigger or transaction-wrapped API call to maintain consistency
- **FR-066**: System MUST roll back auth.users account creation if profile creation fails to maintain data consistency (using Supabase Auth hooks or error handling)
- **FR-067**: System MUST link new user profiles to Stripe customer records when users upgrade to paid plans
- **FR-068**: System MUST maintain referential integrity between auth.users records and profiles table via foreign key constraint (profiles.id references auth.users.id)

### Key Entities *(include if feature involves data)*

- **User Account** (auth.users table, managed by Supabase Auth): Represents the authentication identity of a user
  - Core attributes: unique identifier (UUID), primary email address, email verification status, account creation date, last login timestamp, encrypted password (for email/password auth)
  - Relationships: Links to User Profile (1:1 via profiles.id FK), OAuth Providers (1:many), Authentication Events (1:many)
  - Note: This table is managed entirely by Supabase Auth and should not be modified directly by application code

- **User Profile**: Represents the business/application data for a user (existing table)
  - Core attributes: email, full_name, plan tier (free/pro/team), stripe_customer_id, stripe_subscription_id, creation and update timestamps
  - Relationships: Links to User Account (1:1), Screenshots (1:many), Monthly Usage (1:many)

- **OAuth Provider Link**: Represents a connection between a user account and an external OAuth provider
  - Core attributes: provider name (google/github), provider user ID, email from provider, linked date
  - Relationships: Links to User Account (many:1)

- **Authentication Event**: Represents a security-relevant event for audit logging
  - Core attributes: event type (login_success, login_failure, password_reset, logout, account_locked, ip_blocked, rate_limit_triggered), timestamp, source IP address, user agent, user account reference (nullable for IP-based events)
  - Relationships: Links to User Account (many:1, nullable for IP-based blocks)
  - Purpose: Enables dual-scope rate limiting by tracking both per-account and per-IP failed login attempts

- **Authentication Token**: Represents time-limited, single-use tokens for verification and authentication
  - Core attributes: token type (email_verification, password_reset, magic_link), token value (hashed), expiration timestamp, used status, created timestamp
  - Relationships: Links to User Account (many:1)

- **Session**: Represents an active authenticated user session (managed by Supabase Auth)
  - Core attributes: session token (stored in HTTP-only cookie), user account reference, creation timestamp, last activity timestamp, expiration timestamp, device/browser information
  - Relationships: Links to User Account (many:1)
  - Security: Session tokens stored in HTTP-only cookies with Secure and SameSite=Lax flags to prevent XSS and CSRF attacks

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete account registration and email verification in under 3 minutes
- **SC-002**: Users can log in and reach the dashboard in under 10 seconds for 95% of login attempts
- **SC-003**: Users can complete password reset flow (request to new password set) in under 5 minutes
- **SC-004**: OAuth authentication (click OAuth button to logged in) completes in under 15 seconds for 90% of attempts
- **SC-005**: Magic link authentication (request link to logged in) completes in under 2 minutes
- **SC-006**: System maintains 99.9% uptime for authentication services
- **SC-007**: Failed authentication attempts due to system errors are less than 0.5% of total attempts
- **SC-008**: Account lockout false positives (legitimate users locked out) occur in less than 0.1% of users
- **SC-009**: Cross-platform session synchronization completes within 30 seconds for 95% of cases
- **SC-010**: Users can successfully link OAuth providers to existing accounts with 95% success rate
- **SC-011**: Account deletion completes successfully for 100% of requests within 24 hours
- **SC-012**: Authentication-related support tickets decrease by 60% compared to manual account management
- **SC-013**: Email delivery success rate for authentication emails (verification, reset, magic link) exceeds 98% after retry attempts (including exponential backoff retries)
- **SC-014**: Users report satisfaction score of 4/5 or higher for authentication experience in user surveys
- **SC-015**: Time-to-authenticate for returning users averages under 5 seconds (auto-login from existing session)

## Assumptions

- Supabase Auth will be used as the authentication provider, with user accounts stored in Supabase's auth.users schema (managed by Supabase) and the profiles table referencing auth.users.id via foreign key
- Email delivery service (e.g., Supabase Email, SendGrid, AWS SES) is configured and operational with retry capability for transient failures
- Email delivery failures will be handled with exponential backoff retry mechanism (3 attempts over 5 minutes) before notifying users
- The existing `profiles` table structure will remain unchanged and authentication will integrate with it via foreign key to auth.users
- Browser extension and web dashboard share the same authentication backend and session management
- Users have access to their email for verification and recovery flows
- OAuth provider APIs (Google, GitHub) remain stable and accessible
- Session tokens will be stored in HTTP-only cookies with Secure and SameSite=Lax flags for optimal XSS and CSRF protection
- The browser extension will query authentication state via polling with exponential backoff (10-30 second intervals) rather than direct cookie access or real-time websocket connections
- The browser extension has necessary permissions to make authenticated API calls to the backend
- A 10-30 second polling interval provides acceptable balance between server load and auth state freshness for extension users
- Rate limiting will be enforced at the application level (can be enhanced with infrastructure-level protection later)
- Legal compliance for data retention and privacy (GDPR, CCPA) is handled through account deletion and data export features (data export is out of scope for this feature)
- Multi-factor authentication (MFA) will be added in a future iteration after core authentication is stable
- Account lockout duration of 15 minutes is sufficient for security without excessive user friction
- Users who lose access to email will contact support for account recovery (automated phone/SMS recovery out of scope)

## Dependencies

- Supabase project and database must be operational (Project ID: iitxfjhnywekstxagump)
- Email service provider integration must be configured for sending authentication emails
- OAuth applications must be registered with Google and GitHub with appropriate credentials
- Existing `profiles` table and RLS policies must support authentication integration
- Browser extension must have capability to store and synchronize authentication state
- Stripe integration must be functional for handling subscription cancellations on account deletion

## Out of Scope

The following items are explicitly NOT included in this feature specification and will be addressed separately:

- Multi-factor authentication (MFA) via SMS, authenticator apps, or hardware tokens
- Biometric authentication (fingerprint, face recognition)
- Account recovery via phone number or security questions
- Data export functionality (required for GDPR compliance - separate feature)
- Admin panel for managing user accounts and viewing authentication logs
- Advanced fraud detection and bot prevention beyond basic rate limiting
- Single Sign-On (SSO) for enterprise customers
- Custom OAuth providers beyond Google and GitHub
- Password strength indicators and leaked password checking (HaveIBeenPwned integration)
- Account impersonation for support purposes
- Audit log UI for users to view their own authentication history
- Email templates customization and branding
- Internationalization (i18n) of authentication error messages and emails
- Remember me / trusted device management
- Session management UI showing active sessions across devices with ability to revoke individual sessions
