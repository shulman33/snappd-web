# Snappd Web - Project Documentation

## Supabase Backend Setup

### Project Information
- **Project Name**: shulman33's Project
- **Project ID**: `iitxfjhnywekstxagump`
- **Region**: us-east-1
- **Status**: ACTIVE_HEALTHY
- **Database Version**: PostgreSQL 17.6.1.021
- **API URL**: https://iitxfjhnywekstxagump.supabase.co
- **Created**: 2025-10-15

### Database Schema

#### Tables

**profiles** (5 rows, RLS enabled)
- `id` (uuid, PK) - Foreign key to auth.users
- `email` (text)
- `full_name` (text, nullable)
- `plan` (text, nullable, default: 'free') - Options: 'free', 'pro', 'team'
- `stripe_customer_id` (text, unique, nullable)
- `stripe_subscription_id` (text, unique, nullable)
- `downgraded_at` (timestamptz, nullable)
- `created_at` (timestamptz, nullable, default: now())
- `updated_at` (timestamptz, nullable, default: now())

**screenshots** (0 rows, RLS enabled)
- `id` (uuid, PK, default: gen_random_uuid())
- `user_id` (uuid, FK -> profiles.id)
- `short_id` (text, unique)
- `storage_path` (text)
- `original_filename` (text)
- `file_size` (bigint)
- `width` (integer)
- `height` (integer)
- `mime_type` (text, nullable, default: 'image/png')
- `expires_at` (timestamptz, nullable)
- `views` (integer, nullable, default: 0)
- `is_public` (boolean, nullable, default: true)
- `created_at` (timestamptz, nullable, default: now())
- `updated_at` (timestamptz, nullable, default: now())

**monthly_usage** (0 rows, RLS enabled)
- `id` (uuid, PK, default: gen_random_uuid())
- `user_id` (uuid, FK -> profiles.id)
- `month` (text)
- `screenshot_count` (integer, nullable, default: 0)
- `storage_bytes` (bigint, nullable, default: 0)
- `bandwidth_bytes` (bigint, nullable, default: 0)
- `created_at` (timestamptz, nullable, default: now())

**stripe_events** (0 rows, RLS disabled)
- `id` (text, PK) - Stripe event ID for idempotency
- `processed_at` (timestamptz, nullable, default: now())
- Note: RLS disabled by design - system table for webhook idempotency tracking only

**auth_events** (33 rows, RLS enabled)
- `id` (uuid, PK, default: gen_random_uuid())
- `event_type` (text) - Authentication event type
- `user_id` (uuid, nullable, FK -> auth.users.id)
- `email` (text, nullable)
- `ip_address` (inet) - IP address of the request
- `user_agent` (text, nullable) - Browser/client user agent
- `metadata` (jsonb, nullable, default: '{}') - Additional event metadata
- `created_at` (timestamptz, default: now())

### Storage Buckets

**screenshots**
- Public: Yes
- File size limit: 10 MB (10485760 bytes)
- Allowed MIME types: image/png, image/jpeg, image/jpg, image/webp, image/gif

### Installed Extensions

- `pg_graphql` (1.5.11) - GraphQL support
- `supabase_vault` (0.3.1) - Vault extension for secrets
- `pgcrypto` (1.3) - Cryptographic functions
- `pg_stat_statements` (1.11) - SQL statistics tracking
- `uuid-ossp` (1.1) - UUID generation
- `plpgsql` (1.0) - Procedural language

### Migrations

1. `20251020205404_initial_schema` - Initial database schema
2. `20251020225252_add_profiles_insert_policy` - Added RLS policy for profiles
3. `20251102192854_add_auth_events_table` - Added auth_events table for tracking authentication events
4. `20251102192912_add_profile_trigger` - Added trigger for profile management
5. `20251102192946_add_profiles_foreign_key` - Added foreign key constraint to profiles
6. `20251103141944_disable_rls_on_stripe_events` - Disabled RLS on stripe_events (idempotency table)
7. `20251103144539_add_password_verification_function` - Added password verification function
8. `20251103145354_add_delete_user_data_function` - Added function to delete user data (GDPR/CCPA compliance)

### Edge Functions

No edge functions currently deployed.

### Security Advisories

**Active Warnings:**
1. **Function Search Path Mutable**: `public.handle_new_user` function has mutable search_path
   - Recommendation: Set search_path parameter on function
   - [Learn more](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)

2. **RLS Disabled in Public**: `stripe_events` table has RLS disabled
   - This is intentional - table is for webhook idempotency tracking only
   - Only accessed via service role, contains no user data
   - [Learn more](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public)

3. **Auth - Leaked Password Protection**: Currently disabled
   - Recommendation: Enable HaveIBeenPwned.org integration for enhanced security
   - [Learn more](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

### Performance Advisories

**Auth RLS Performance:**
1. **auth_events** table has RLS policy "Service role only" that re-evaluates for each row
   - Replace `auth.<function>()` with `(select auth.<function>())` for better performance
   - [Learn more](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)

**Unused Indexes:**
1. `idx_screenshots_expires` on screenshots table - Never used
2. `idx_profiles_stripe_customer` on profiles table - Never used
3. `idx_auth_events_type` on auth_events table - Never used
4. `idx_auth_events_email` on auth_events table - Never used
5. `idx_auth_events_ip` on auth_events table - Never used
   - Consider removing if truly unused to improve write performance

## API Routes

### Authentication API (/api/auth)

**User Registration & Account Management**

- **POST /api/auth/signup**
  - Creates new user account with email/password
  - Rate limiting: 5 attempts per 15 min (account lockout)
  - Auto-creates profile in profiles table
  - Sends verification email
  - Returns: 201 with user data | 409 email exists | 429 rate limited

- **DELETE /api/auth/account**
  - Permanently deletes user account (GDPR/CCPA compliance)
  - Requires password verification or OAuth re-authentication
  - Cancels Stripe subscriptions
  - Deletes all user data (profiles, screenshots, auth_events)
  - Removes screenshots from storage
  - Returns: 200 success | 401 unauthorized | 403 invalid password

**Email/Password Authentication**

- **POST /api/auth/signin**
  - Authenticates with email/password
  - Dual-scope rate limiting:
    - Account: 5 failures per 15 min (account lockout)
    - IP: 20 failures per 15 min (IP blocking)
  - Email verification check
  - Generic error messages (prevent enumeration)
  - Returns: 200 with session | 401 invalid credentials | 403 unverified email | 429 rate limited

- **POST /api/auth/signout**
  - Terminates current session
  - Clears session cookies
  - Returns: 200 success | 401 unauthorized

- **GET /api/auth/user**
  - Retrieves current user profile
  - Used by browser extension for auth polling
  - Returns: 200 with user data | 401 unauthorized

**Email Verification**

- **GET /api/auth/verify-email**
  - Verifies email via token_hash from email link
  - PKCE flow with OTP verification
  - Redirects to dashboard on success
  - Query params: token_hash, type, next (optional)

- **POST /api/auth/verify-email/resend**
  - Resends verification email
  - Rate limiting: 3 requests per hour
  - Prevents email enumeration
  - Returns: 200 success | 429 rate limited

**Password Reset**

- **POST /api/auth/reset-password**
  - Initiates password reset flow
  - Sends reset email with token
  - Rate limiting: 3 requests per hour
  - Exponential backoff: immediate, 2min, 5min
  - Returns: 200 success | 429 rate limited | 500 delivery failed

- **POST /api/auth/reset-password/confirm**
  - Confirms password reset with token
  - Token expiration: 1 hour
  - Single-use enforcement
  - Invalidates all other sessions
  - Returns: 200 success | 401 invalid/expired token

**Magic Link (Passwordless)**

- **POST /api/auth/magic-link**
  - Sends magic link for passwordless auth
  - Rate limiting: 5 requests per hour
  - Auto-creates account for new users
  - Link expiration: 15 minutes
  - Exponential backoff retry
  - Returns: 200 success | 429 rate limited | 500 delivery failed

- **GET /api/auth/magic-link/callback**
  - Verifies magic link token
  - Single-use enforcement
  - Handles existing active sessions gracefully
  - Tracks link age in auth events
  - Redirects to dashboard on success

**OAuth Authentication**

- **GET /api/auth/callback/google**
  - Handles Google OAuth callback
  - Auto-creates account for new users
  - Links OAuth to existing accounts with matching email
  - Extracts email, name, avatar from Google
  - Validates and sanitizes OAuth responses
  - Stores OAuth identity in auth.identities
  - Redirects to dashboard with welcome flag for new users

### Security Features

**Rate Limiting**
- Account lockout: 5 failures in 15 min
- IP blocking: 20 failures in 15 min
- Verification emails: 3 per hour
- Password reset: 3 per hour
- Magic links: 5 per hour

**Auth Event Logging**
All authentication events logged to auth_events table:
- signup_success, signup_failure
- login_success, login_failure
- email_verified, verification_resend
- password_changed, password_reset
- magic_link_sent, magic_link_used
- oauth_linked
- account_locked, ip_blocked
- account_deleted

**Session Management**
- HTTP-only cookies
- Server-side validation
- Session invalidation on password change
- Multiple concurrent sessions supported

## Architecture Notes

This is a screenshot sharing application with:
- User management with tiered pricing (free/pro/team)
- Stripe integration for payments
- Screenshot upload and storage with metadata tracking
- Usage tracking per user/month
- Public/private screenshot sharing with view counts
- Authentication event logging for security and compliance
- GDPR/CCPA compliance with user data deletion functionality

## Active Technologies
- TypeScript 5.x with Next.js 15.5.5 (App Router), React 19.1.0 (005-auth-system)
- PostgreSQL via Supabase (existing instance: iitxfjhnywekstxagump) (005-auth-system)

## Recent Changes
- 005-auth-system: Added TypeScript 5.x with Next.js 15.5.5 (App Router), React 19.1.0
