# Integration Test User Journeys

This document outlines comprehensive user journeys for the Snappd authentication system that **must** be tested using integration tests with the `integration-test-architect` agent.

## Overview

Each journey represents a complete end-to-end flow that users experience in the application. These tests validate that multiple API endpoints work together correctly, data flows properly between steps, and the system handles both success and failure scenarios appropriately.

---

## 1. Email/Password Account Creation & Verification Journey

**User Story**: A new user creates an account with email/password and verifies their email address.

### Happy Path
1. **POST /api/auth/signup** - User creates account
   - Validates email/password
   - Creates user in auth.users
   - Auto-creates profile in profiles table
   - Sends verification email
   - Returns user data with emailVerified=false

2. **GET /api/auth/verify-email** - User clicks verification link in email
   - Validates token_hash from email
   - Uses PKCE flow with OTP verification
   - Confirms email in auth system
   - Redirects to dashboard

3. **POST /api/auth/signin** - User signs in with verified email
   - Authenticates with email/password
   - Checks email is verified
   - Returns user profile with session

4. **GET /api/auth/user** - Client fetches current user profile
   - Returns full user data including plan, email verification status

### Error Scenarios
- Signup with already-registered email (409 conflict)
- Signup rate limiting after 5 attempts (429 account lockout)
- Signin before email verification (403 forbidden)
- Signin with invalid credentials (401 unauthorized)
- Account lockout after 5 failed login attempts
- IP blocking after 20 failed login attempts from same IP
- Invalid or expired verification token
- Resending verification email (rate limited to 3 per hour)

### Data Validation
- Profile is created with correct default values (plan='free')
- Auth events logged: signup_success, email_verified, login_success
- Rate limit counters properly track attempts
- Session cookies are set correctly

---

## 2. Password Reset Journey

**User Story**: A user forgets their password and resets it via email link.

### Happy Path
1. **POST /api/auth/reset-password** - User requests password reset
   - Validates email format
   - Rate limits to 3 requests per hour
   - Sends reset email with token (with exponential backoff retry)
   - Logs password_reset event
   - Returns success (even if email doesn't exist - prevents enumeration)

2. **POST /api/auth/reset-password/confirm** - User submits new password
   - Validates reset token (1-hour expiration)
   - Validates new password strength
   - Updates password in auth system
   - Invalidates all other sessions
   - Logs password_changed event
   - Returns success

3. **POST /api/auth/signin** - User signs in with new password
   - Authenticates successfully with new credentials
   - Old password no longer works
   - Returns user profile with session

### Error Scenarios
- Rate limiting: Too many reset requests (429, 3 per hour)
- Invalid or expired reset token (401)
- Reset token already used (single-use enforcement)
- Email delivery failure after 3 retry attempts
- Weak password validation failure
- Attempting to reuse old password

### Data Validation
- Auth events logged: password_reset, password_changed
- All other sessions invalidated after password change
- Reset tokens expire after 1 hour
- Retry logic uses exponential backoff (0ms, 2min, 5min)

---

## 3. Magic Link (Passwordless) Authentication Journey

**User Story**: A user signs in using a magic link sent to their email, without needing a password.

### Happy Path
1. **POST /api/auth/magic-link** - User requests magic link
   - Validates email format
   - Rate limits to 5 requests per hour
   - Sends magic link via email (15-minute expiration)
   - Auto-creates account if user doesn't exist
   - Logs magic_link_sent event
   - Uses exponential backoff retry for email delivery

2. **GET /api/auth/magic-link/callback** - User clicks magic link
   - Validates magic link token
   - Single-use enforcement
   - Handles existing active sessions gracefully
   - Tracks link age in auth events
   - Logs magic_link_used event
   - Redirects to dashboard

3. **GET /api/auth/user** - Client fetches user profile
   - Returns authenticated user data
   - Session is active and valid

### Error Scenarios
- Rate limiting: Too many magic link requests (429, 5 per hour)
- Invalid or expired magic link token (15-minute expiration)
- Magic link already used (single-use enforcement)
- Email delivery failure after retry attempts
- Concurrent session handling

### Data Validation
- Auth events logged: magic_link_sent, magic_link_used
- New accounts created automatically for new emails
- Profile created with default values (plan='free')
- Magic links expire after 15 minutes
- Link age tracked in metadata

---

## 4. Google OAuth Authentication Journey

**User Story**: A user signs in or creates an account using Google OAuth.

### Happy Path - New User
1. **GET /api/auth/callback/google** - Google redirects after OAuth approval
   - Validates OAuth response from Google
   - Extracts email, name, avatar from Google
   - Auto-creates account for new users
   - Creates profile in profiles table
   - Stores OAuth identity in auth.identities
   - Logs oauth_linked event
   - Redirects to dashboard with welcome flag

2. **GET /api/auth/user** - Client fetches user profile
   - Returns user with OAuth identity linked
   - Profile has name from Google

### Happy Path - Existing User
1. **GET /api/auth/callback/google** - User with existing email signs in
   - Links OAuth to existing account with matching email
   - Preserves existing profile data
   - Adds Google identity to auth.identities
   - Logs login_success event
   - Redirects to dashboard

### Error Scenarios
- Invalid OAuth response from Google
- OAuth callback with missing/invalid tokens
- Email mismatch between OAuth and existing account
- OAuth provider error

### Data Validation
- Auth events logged: oauth_linked, login_success
- OAuth identity stored in auth.identities table
- Profile has Google-provided data (name, avatar)
- Multiple OAuth providers can link to same account
- Welcome flag only set for new users

---

## 5. Account Deletion Journey (GDPR/CCPA Compliance)

**User Story**: A user permanently deletes their account and all associated data.

### Happy Path - Email/Password User
1. **POST /api/auth/signin** - User signs in
   - Authenticates successfully
   - Establishes session

2. **DELETE /api/auth/account** - User requests account deletion
   - Validates user session
   - Verifies password using secure database function
   - Validates confirmation phrase: "DELETE MY ACCOUNT"
   - Cancels active Stripe subscriptions
   - Marks Stripe customer as deleted
   - Deletes screenshots from storage (atomically)
   - Deletes all user data: profiles, monthly_usage, auth_events
   - Logs account_deleted event BEFORE deletion
   - Deletes user from auth.users
   - Signs out the user
   - Returns success

3. **POST /api/auth/signin** - User attempts to sign in
   - Account no longer exists
   - Returns invalid credentials error

### Happy Path - OAuth User
1. **OAuth login** - User signs in via Google

2. **DELETE /api/auth/account** - OAuth user deletes account
   - Session validation succeeds
   - OAuth re-authentication check (verifies identity exists)
   - Same deletion flow as email/password user
   - All OAuth identities removed

### Error Scenarios
- Unauthenticated deletion attempt (401)
- Invalid password for email/password users (403)
- Missing OAuth identity for OAuth users (403)
- Database transaction failure (rolls back all changes)
- Storage deletion failure (account deleted, files orphaned for cleanup)
- Stripe cancellation failure (continues with deletion)

### Data Validation
- All user data deleted: profiles, screenshots, monthly_usage, auth_events
- Stripe subscription cancelled with prorated refund
- Stripe customer marked as deleted in metadata
- Screenshot files removed from storage bucket
- Auth events logged: account_deleted
- Transaction rollback if any critical step fails
- User cannot sign in after deletion
- Confirmation email sent (optional)

---

## 6. Session Management Journey

**User Story**: A user signs in on multiple devices and manages their sessions.

### Happy Path
1. **POST /api/auth/signin** (Device A) - User signs in on first device
   - Creates session with expiration
   - Sets HTTP-only session cookie

2. **POST /api/auth/signin** (Device B) - User signs in on second device
   - Creates separate concurrent session
   - Both sessions remain active

3. **GET /api/auth/user** (Device A) - Verify session on device A
   - Returns user profile
   - Session still valid

4. **GET /api/auth/user** (Device B) - Verify session on device B
   - Returns user profile
   - Session still valid

5. **POST /api/auth/signout** (Device A) - User signs out on device A
   - Terminates session on device A
   - Clears session cookie

6. **GET /api/auth/user** (Device A) - Check session after signout
   - Returns 401 unauthorized
   - Session no longer valid

7. **GET /api/auth/user** (Device B) - Check session on device B
   - Returns user profile
   - Session still valid (not affected by device A signout)

### Error Scenarios
- Accessing protected routes without session (401)
- Expired session handling
- Session invalidation after password change (all sessions)

### Data Validation
- Multiple concurrent sessions supported
- Session cookies are HTTP-only
- Session expiration tracked correctly
- Signout only affects current session
- Password change invalidates ALL sessions

---

## 7. Rate Limiting & Account Security Journey

**User Story**: System protects against brute force attacks through rate limiting.

### Account Lockout Scenario
1. **POST /api/auth/signin** (Attempt 1-4) - Wrong password
   - Returns 401 invalid credentials
   - Logs login_failure events
   - Account NOT locked yet

2. **POST /api/auth/signin** (Attempt 5) - Wrong password
   - Returns 429 account locked
   - Logs account_locked event
   - 15-minute lockout period

3. **POST /api/auth/signin** (Attempt 6) - Correct password during lockout
   - Returns 429 account locked
   - Cannot sign in even with correct credentials
   - Retry-After header indicates time remaining

4. **Wait 15 minutes** - Lockout period expires

5. **POST /api/auth/signin** - Correct password after lockout
   - Returns 200 with session
   - Logs login_success
   - Rate limit counter reset

### IP Blocking Scenario
1. **POST /api/auth/signin** - 20 failed attempts from same IP (different emails)
   - Returns 429 IP blocked
   - Logs ip_blocked event
   - 15-minute IP block

2. **POST /api/auth/signin** - Valid credentials from blocked IP
   - Returns 429 IP blocked
   - Cannot authenticate from blocked IP

3. **POST /api/auth/signin** - Valid credentials from different IP
   - Returns 200 with session
   - Different IP not affected

### Verification Email Rate Limiting
1. **POST /api/auth/verify-email/resend** (Attempts 1-3)
   - Returns 200 success
   - Sends verification emails

2. **POST /api/auth/verify-email/resend** (Attempt 4)
   - Returns 429 rate limited
   - 1-hour wait period

### Data Validation
- Auth events track all failures and lockouts
- Rate limit windows: 15 min (account/IP), 1 hour (verification)
- Retry-After headers provide correct wait times
- Lockouts prevent both wrong and correct credentials
- IP blocks are independent of account blocks

---

## 8. Email Verification Resend Journey

**User Story**: A user didn't receive their verification email and requests a new one.

### Happy Path
1. **POST /api/auth/signup** - User creates account
   - Account created, verification email sent
   - User doesn't receive email (spam folder, delivery issue)

2. **POST /api/auth/verify-email/resend** - Request new verification email
   - Validates email exists
   - Rate limited to 3 per hour
   - Sends new verification email
   - Logs verification_resend event
   - Returns success without revealing if account exists

3. **GET /api/auth/verify-email** - User verifies with new link
   - Token valid
   - Email confirmed
   - Redirects to dashboard

### Error Scenarios
- Rate limiting: Too many resend requests (429, 3 per hour)
- Generic success message prevents email enumeration
- Account already verified (still returns success)

### Data Validation
- Auth events logged: verification_resend, email_verified
- Rate limit enforces 3 requests per hour
- Prevents account enumeration attacks
- New verification link invalidates old ones

---

## 9. Multi-Step Onboarding Journey

**User Story**: A new user goes through the complete onboarding flow.

### Complete Flow
1. **POST /api/auth/signup** - Create account
   - Validates email/password
   - Creates profile with plan='free'
   - Sends verification email
   - Logs signup_success

2. **GET /api/auth/verify-email** - Verify email
   - Confirms email address
   - Logs email_verified

3. **POST /api/auth/signin** - First login
   - Authenticates successfully
   - Returns session and profile
   - Logs login_success

4. **GET /api/auth/user** - Fetch profile for dashboard
   - Returns user with plan='free'
   - Shows verified email status

### Data Validation
- Complete auth event sequence logged
- Profile created with correct defaults
- Session established and maintained
- Email verification required before full access

---

## 10. Cross-Authentication Method Journey

**User Story**: A user creates account with email/password, then links OAuth later (or vice versa).

### Email First, Then OAuth
1. **POST /api/auth/signup** - Create account with email/password
   - Account created with email provider

2. **GET /api/auth/verify-email** - Verify email

3. **POST /api/auth/signin** - Sign in with password
   - Session established

4. **GET /api/auth/callback/google** - Link Google OAuth
   - Matches email with existing account
   - Links OAuth identity to account
   - Both methods now available

5. **POST /api/auth/signout** - Sign out

6. **Magic Link OR Google OAuth** - Sign in with either method
   - Both authentication methods work
   - Same user account accessed

### OAuth First, Then Password Reset
1. **GET /api/auth/callback/google** - Create account via OAuth
   - Account created without password

2. **POST /api/auth/reset-password** - Set password via reset flow
   - User receives reset email
   - Can set password even though none existed

3. **POST /api/auth/signin** - Sign in with new password
   - Password authentication now works
   - OAuth still linked

### Data Validation
- Multiple auth methods link to same account
- auth.identities tracks all providers
- Profile remains consistent across methods
- User can authenticate with any linked method

---

## Implementation Notes

### Testing Best Practices

1. **Use Real Database**: Integration tests should use a real Supabase instance (test project)
2. **Cleanup**: Always clean up test data in `afterAll()` hooks
3. **Unique Data**: Use timestamps and random values to prevent test collisions
4. **Sequential Dependencies**: Test data flows between API calls
5. **Auth Headers**: Extract and reuse session tokens between requests
6. **Rate Limit Reset**: Account for rate limit windows or reset between test runs

### Test Data Factories

Create reusable helpers:
- `createTestUser(email?, password?, fullName?)` - Create unique test user
- `verifyTestUserEmail(userId)` - Bypass email verification for testing
- `createTestSession(userId)` - Generate valid session token
- `cleanupTestUser(userId)` - Remove all user data and files

### Environment Setup

Required environment variables for testing:
- `NEXT_PUBLIC_APP_URL` - Base URL for callbacks
- `SUPABASE_URL` - Test Supabase project URL
- `SUPABASE_ANON_KEY` - Anon key for client-side calls
- `SUPABASE_SERVICE_ROLE_KEY` - Service role for admin operations
- `STRIPE_SECRET_KEY` - Stripe test key for subscription tests

### Coverage Goals

Each journey should test:
- ✅ Happy path (complete successful flow)
- ✅ Error scenarios (invalid input, auth failures, rate limits)
- ✅ Data integrity (database records, relationships, timestamps)
- ✅ Event logging (auth_events table populated correctly)
- ✅ Security (RLS policies, unauthorized access, enumeration prevention)
- ✅ Idempotency (duplicate requests handled correctly)

---

## Usage with Integration Test Architect

To generate tests for any of these journeys, use the `integration-test-architect` agent:

```bash
# Example: Generate tests for Email/Password Account Creation journey
"I need integration tests for Journey #1: Email/Password Account Creation & Verification.
The journey should test signup → email verification → signin → fetch user profile,
including error scenarios like duplicate email, unverified login, and rate limiting."
```

The agent will:
1. Analyze the complete API sequence
2. Create test factories and helpers
3. Write comprehensive Jest tests with setup/teardown
4. Include both happy path and error scenarios
5. Validate data integrity and auth event logging
6. Provide setup instructions and environment requirements
