# Data Model: Authentication System

**Feature**: Comprehensive Authentication System
**Date**: 2025-11-02
**Phase**: 1 (Design & Contracts)

## Overview

This document defines the data entities, relationships, and validation rules for the authentication system. The model integrates with Supabase Auth's managed `auth.users` table and extends it with application-specific data in the `profiles` table.

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────┐
│        auth.users (Supabase)        │
│─────────────────────────────────────│
│ id (PK, UUID)                       │
│ email (unique, indexed)             │
│ encrypted_password (hashed)         │
│ email_confirmed_at (timestamp)      │
│ created_at (timestamp)              │
│ updated_at (timestamp)              │
│ last_sign_in_at (timestamp)         │
│ raw_user_meta_data (JSONB)          │
└─────────────────────────────────────┘
            │
            │ 1:1 (FK)
            ▼
┌─────────────────────────────────────┐
│      profiles (Application)         │
│─────────────────────────────────────│
│ id (PK, FK → auth.users.id)         │
│ email (text, indexed)               │
│ full_name (text, nullable)          │
│ plan (text: free/pro/team)          │
│ stripe_customer_id (unique)         │
│ stripe_subscription_id (unique)     │
│ downgraded_at (timestamp)           │
│ created_at (timestamp)              │
│ updated_at (timestamp)              │
└─────────────────────────────────────┘
            │
            │ 1:many
            ▼
┌─────────────────────────────────────┐
│         screenshots                 │
│─────────────────────────────────────│
│ user_id (FK → profiles.id)          │
│ ... (existing schema)               │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│       auth.identities               │
│     (OAuth Provider Links)          │
│─────────────────────────────────────│
│ id (PK, UUID)                       │
│ user_id (FK → auth.users.id)        │
│ provider (text: google/github)      │
│ provider_id (text, unique)          │
│ identity_data (JSONB)               │
│ created_at (timestamp)              │
│ updated_at (timestamp)              │
└─────────────────────────────────────┘
            ▲
            │ many:1
            │
    ┌───────┴───────┐
    │  auth.users   │
    └───────────────┘

┌─────────────────────────────────────┐
│         auth_events (NEW)           │
│      (Audit Log & Rate Limiting)    │
│─────────────────────────────────────│
│ id (PK, UUID)                       │
│ event_type (text)                   │
│ user_id (FK → auth.users.id, NULL) │
│ email (text, indexed)               │
│ ip_address (INET, indexed)          │
│ user_agent (text)                   │
│ metadata (JSONB)                    │
│ created_at (timestamp, indexed)     │
└─────────────────────────────────────┘
```

---

## 1. User Account (auth.users)

**Table**: `auth.users` (Supabase Auth managed)
**Purpose**: Core authentication identity managed by Supabase Auth

### Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique user identifier |
| `email` | TEXT | UNIQUE, NOT NULL | User's email address (login identifier) |
| `encrypted_password` | TEXT | NULLABLE | Hashed password (NULL for OAuth-only users) |
| `email_confirmed_at` | TIMESTAMPTZ | NULLABLE | Timestamp when email was verified |
| `confirmed_at` | TIMESTAMPTZ | NULLABLE | Alias for email_confirmed_at |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Account creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |
| `last_sign_in_at` | TIMESTAMPTZ | NULLABLE | Last successful login |
| `raw_user_meta_data` | JSONB | DEFAULT '{}' | Additional user metadata |
| `is_super_admin` | BOOLEAN | DEFAULT FALSE | Admin flag (app-specific) |

### Indexes
```sql
-- Managed by Supabase Auth
CREATE UNIQUE INDEX users_email_idx ON auth.users(email);
CREATE INDEX users_created_at_idx ON auth.users(created_at DESC);
```

### Validation Rules
- **Email**: Must be valid email format (RFC 5322), max 255 characters
- **Password**: Min 8 chars, must contain uppercase, lowercase, number, special char
- **Email verification**: Required before account is fully active

### State Transitions
```
[New User]
    → UNVERIFIED (email_confirmed_at = NULL)
    → VERIFIED (email_confirmed_at = timestamp) [via email verification link]
    → ACTIVE (can authenticate and access protected resources)
```

### Access Patterns
- **Read**: `supabase.auth.getUser()` - Validates and retrieves current user
- **Create**: `supabase.auth.signUp()` - Creates user with email/password
- **Update**: `supabase.auth.updateUser()` - Updates user metadata or password
- **Delete**: `supabase.auth.admin.deleteUser()` - Admin-only deletion

### Important Notes
- ⚠️ **NEVER modify this table directly** - Always use Supabase Auth APIs
- ⚠️ Row Level Security (RLS) managed by Supabase
- ⚠️ Passwords automatically hashed with bcrypt by Supabase
- ⚠️ Email confirmations sent automatically by Supabase

---

## 2. User Profile (profiles)

**Table**: `profiles` (Application managed)
**Purpose**: Extend auth.users with application-specific user data

### Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, REFERENCES auth.users(id) ON DELETE CASCADE | Links to auth.users |
| `email` | TEXT | NOT NULL, INDEXED | Denormalized from auth.users for query performance |
| `full_name` | TEXT | NULLABLE | User's display name |
| `plan` | TEXT | NOT NULL, DEFAULT 'free', CHECK(plan IN ('free', 'pro', 'team')) | Subscription tier |
| `stripe_customer_id` | TEXT | UNIQUE, NULLABLE | Stripe customer reference |
| `stripe_subscription_id` | TEXT | UNIQUE, NULLABLE | Active Stripe subscription |
| `downgraded_at` | TIMESTAMPTZ | NULLABLE | When user downgraded from paid plan |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Profile creation time |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last profile update |

### SQL Definition
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'team')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  downgraded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_stripe_customer ON profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_profiles_plan ON profiles(plan);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Service role can insert (for trigger)
CREATE POLICY "Service role can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (true);
```

### Validation Rules
- **email**: Must match auth.users.email (enforced by trigger)
- **full_name**: Max 255 characters, no special validation
- **plan**: Must be one of: `'free'`, `'pro'`, `'team'`
- **stripe_customer_id**: Unique, set when user upgrades to paid plan
- **stripe_subscription_id**: Unique, set when subscription is active

### State Transitions
```
[FREE PLAN]
    → PRO (via Stripe checkout, sets stripe_customer_id + stripe_subscription_id)
    → TEAM (via Stripe checkout, sets stripe_customer_id + stripe_subscription_id)
    → FREE (via cancellation, sets downgraded_at)
```

### Relationship to auth.users
- **1:1 relationship**: One profile per user
- **Created automatically**: Via database trigger on auth.users insert
- **Cascade delete**: If auth.users row deleted, profile also deleted

### Automatic Creation Trigger
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, plan, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'free',
    NOW(),
    NOW()
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error and re-raise to rollback auth.users insert
  RAISE EXCEPTION 'Failed to create profile for user %: %', NEW.id, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

---

## 3. OAuth Provider Links (auth.identities)

**Table**: `auth.identities` (Supabase Auth managed)
**Purpose**: Links user accounts to OAuth providers (Google, GitHub)

### Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Identity identifier |
| `user_id` | UUID | REFERENCES auth.users(id) | User this identity belongs to |
| `provider` | TEXT | NOT NULL | OAuth provider ('google', 'github') |
| `provider_id` | TEXT | NOT NULL | Provider's user ID |
| `identity_data` | JSONB | NOT NULL, DEFAULT '{}' | Provider-specific data (email, name, avatar) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When OAuth connection was made |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update |

### Indexes
```sql
-- Managed by Supabase Auth
CREATE UNIQUE INDEX identities_provider_id_idx ON auth.identities(provider, provider_id);
CREATE INDEX identities_user_id_idx ON auth.identities(user_id);
```

### Validation Rules
- **provider**: Must be one of: `'google'`, `'github'`
- **provider_id**: Unique per provider (user can't link same Google account twice)
- **identity_data**: Contains email, name, avatar_url from OAuth provider

### State Transitions
```
[No OAuth]
    → LINKED (user clicks "Connect with Google/GitHub")
    → UNLINKED (user removes OAuth connection, identity row deleted)
```

### Relationship to auth.users
- **Many-to-one**: One user can have multiple OAuth identities (Google + GitHub)
- **Created automatically**: When user signs in with OAuth or links account
- **Cannot delete last auth method**: Must have at least one way to authenticate

---

## 4. Authentication Events (auth_events)

**Table**: `auth_events` (NEW - Application managed)
**Purpose**: Audit log for security events and rate limiting enforcement

### Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Event identifier |
| `event_type` | TEXT | NOT NULL | Type of auth event |
| `user_id` | UUID | REFERENCES auth.users(id) ON DELETE SET NULL, NULLABLE | User involved (NULL for IP-only events) |
| `email` | TEXT | NULLABLE, INDEXED | Email address (for failed login attempts) |
| `ip_address` | INET | NOT NULL, INDEXED | Source IP address |
| `user_agent` | TEXT | NULLABLE | Browser/client user agent |
| `metadata` | JSONB | DEFAULT '{}' | Additional event-specific data |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW(), INDEXED | Event timestamp |

### SQL Definition
```sql
CREATE TABLE auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  ip_address INET NOT NULL,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX idx_auth_events_type ON auth_events(event_type);
CREATE INDEX idx_auth_events_user ON auth_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_auth_events_email ON auth_events(email) WHERE email IS NOT NULL;
CREATE INDEX idx_auth_events_ip ON auth_events(ip_address);
CREATE INDEX idx_auth_events_created ON auth_events(created_at DESC);

-- Composite index for rate limiting queries
CREATE INDEX idx_auth_events_rate_limit
  ON auth_events(event_type, email, created_at)
  WHERE event_type IN ('login_failure', 'password_reset', 'magic_link', 'verification_resend');

-- RLS Policies
ALTER TABLE auth_events ENABLE ROW LEVEL SECURITY;

-- Only service role can insert/read
CREATE POLICY "Service role only"
  ON auth_events
  USING (auth.role() = 'service_role');
```

### Event Types

| Event Type | Description | user_id | email | metadata |
|------------|-------------|---------|-------|----------|
| `login_success` | Successful login | ✓ | ✓ | `{ method: 'password'|'oauth'|'magic_link' }` |
| `login_failure` | Failed login attempt | ✗ | ✓ | `{ reason: 'invalid_credentials'|'unverified_email' }` |
| `signup_success` | New account created | ✓ | ✓ | `{ method: 'email'|'oauth' }` |
| `signup_failure` | Failed signup | ✗ | ✓ | `{ reason: 'email_exists'|'validation_error' }` |
| `password_reset` | Password reset requested | ✓ | ✓ | `{ reset_token_sent: boolean }` |
| `password_changed` | Password successfully changed | ✓ | ✓ | `{ method: 'reset'|'user_initiated' }` |
| `email_verified` | Email verification completed | ✓ | ✓ | `{ verification_method: 'link'|'code' }` |
| `magic_link_sent` | Magic link sent | ✗ | ✓ | `{ expires_at: timestamp }` |
| `magic_link_used` | Magic link used for login | ✓ | ✓ | `{ link_age_seconds: number }` |
| `account_locked` | Account locked due to failed attempts | ✓ | ✓ | `{ failed_attempts: number, locked_until: timestamp }` |
| `ip_blocked` | IP blocked due to rate limit | ✗ | ✗ | `{ failed_attempts: number, blocked_until: timestamp }` |
| `oauth_linked` | OAuth provider linked to account | ✓ | ✓ | `{ provider: 'google'|'github' }` |
| `oauth_unlinked` | OAuth provider unlinked | ✓ | ✓ | `{ provider: 'google'|'github' }` |
| `account_deleted` | User account deleted | ✓ | ✓ | `{ deletion_reason: string }` |
| `profile_updated` | User profile updated | ✓ | ✓ | `{ fields_changed: string[] }` |

### Usage Examples

#### Log Failed Login
```typescript
await supabase.from('auth_events').insert({
  event_type: 'login_failure',
  email: loginEmail,
  ip_address: requestIp,
  user_agent: requestUserAgent,
  metadata: { reason: 'invalid_credentials' },
});
```

#### Query for Rate Limiting
```typescript
// Check if account should be locked (5 failures in 15 min)
const { count } = await supabase
  .from('auth_events')
  .select('*', { count: 'exact', head: true })
  .eq('event_type', 'login_failure')
  .eq('email', userEmail)
  .gte('created_at', fifteenMinutesAgo.toISOString());

if (count >= 5) {
  // Account locked
  await supabase.from('auth_events').insert({
    event_type: 'account_locked',
    email: userEmail,
    ip_address: requestIp,
    metadata: {
      failed_attempts: count,
      locked_until: fifteenMinutesFromNow.toISOString()
    },
  });
}
```

### Retention Policy
```sql
-- Delete events older than 90 days (compliance)
CREATE OR REPLACE FUNCTION cleanup_old_auth_events()
RETURNS void AS $$
BEGIN
  DELETE FROM auth_events
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule daily cleanup (requires pg_cron extension)
SELECT cron.schedule(
  'cleanup-auth-events',
  '0 2 * * *', -- Run at 2 AM daily
  'SELECT cleanup_old_auth_events();'
);
```

---

## 5. Authentication Tokens (Managed by Supabase)

**Purpose**: Time-limited, single-use tokens for verification and authentication

### Token Types

| Token Type | Purpose | Expiration | Storage | Single-Use |
|------------|---------|------------|---------|------------|
| **Email Verification** | Confirm user email address | 24 hours | Supabase (hashed) | ✓ |
| **Password Reset** | Allow password change | 1 hour | Supabase (hashed) | ✓ |
| **Magic Link** | Passwordless authentication | 15 minutes | Supabase (hashed) | ✓ |
| **Session Token** | Maintain authenticated session | 7 days (sliding) | HTTP-only cookie | ✗ (refreshable) |
| **Refresh Token** | Renew session without re-login | 30 days | HTTP-only cookie | ✗ (rotates on use) |

### Security Properties
- All tokens are **cryptographically random** (min 128 bits entropy)
- Verification/reset/magic link tokens are **hashed** before storage (SHA-256)
- **Single-use enforcement**: Token invalidated after first use
- **Automatic cleanup**: Expired tokens purged automatically by Supabase

---

## 6. Session (Managed by Supabase)

**Table**: Internal to Supabase Auth
**Purpose**: Track active user sessions

### Session Properties
- **Duration**: 7 days (configurable, sliding window)
- **Storage**: HTTP-only cookies (immune to XSS)
- **Refresh**: Automatic in middleware via `getUser()`
- **Concurrent Sessions**: Allowed across devices
- **Invalidation**: Manual logout or token expiration

### Cookie Configuration
```typescript
{
  name: 'sb-access-token',
  httpOnly: true,
  secure: true, // HTTPS only
  sameSite: 'lax', // CSRF protection
  maxAge: 604800, // 7 days in seconds
  path: '/',
}
```

---

## Data Integrity Constraints

### Foreign Keys
- `profiles.id` → `auth.users.id` (CASCADE DELETE)
- `auth_events.user_id` → `auth.users.id` (SET NULL on delete)
- `auth.identities.user_id` → `auth.users.id` (CASCADE DELETE)

### Unique Constraints
- `auth.users.email` - One account per email
- `profiles.stripe_customer_id` - One Stripe customer per user
- `profiles.stripe_subscription_id` - One active subscription per user
- `auth.identities(provider, provider_id)` - Can't link same OAuth account twice

### Check Constraints
- `profiles.plan IN ('free', 'pro', 'team')` - Valid plan tiers only
- `auth_events.event_type IN (...)` - Valid event types only

---

## Performance Considerations

### Index Strategy
- **Email lookups**: Indexed on both `auth.users` and `profiles`
- **Rate limiting**: Composite index on `(event_type, email, created_at)`
- **Audit queries**: Separate indexes on `user_id`, `ip_address`, `created_at`

### Query Optimization
- **Denormalized email**: Stored in `profiles` to avoid joins
- **Partial indexes**: Only index non-NULL `stripe_customer_id`
- **Covering indexes**: Include frequently queried columns

### Scaling Considerations
- **Partitioning**: `auth_events` can be partitioned by `created_at` (monthly)
- **Archiving**: Move old events to cold storage after 90 days
- **Caching**: Session data cached in Redis via `@upstash/ratelimit`

---

## Migration from Existing Schema

### Current State (from CLAUDE.md)
```sql
-- Existing profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  plan TEXT DEFAULT 'free',
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  downgraded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Required Changes
1. **Add foreign key constraint**: `profiles.id` → `auth.users.id`
2. **Add NOT NULL constraint**: `profiles.email` (was nullable)
3. **Add CHECK constraint**: `profiles.plan IN ('free', 'pro', 'team')`
4. **Create auth_events table**: New table for audit logging
5. **Create trigger**: `on_auth_user_created` for automatic profile creation
6. **Add indexes**: Performance indexes for rate limiting queries

### Migration SQL
```sql
-- Step 1: Add constraints to existing profiles table
ALTER TABLE profiles
  ADD CONSTRAINT fk_profiles_auth_users
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE profiles
  ALTER COLUMN email SET NOT NULL;

ALTER TABLE profiles
  ADD CONSTRAINT check_plan_values
  CHECK (plan IN ('free', 'pro', 'team'));

-- Step 2: Create auth_events table
-- (See section 4 above for full definition)

-- Step 3: Create trigger for automatic profile creation
-- (See section 2 above for trigger definition)

-- Step 4: Backfill any missing data
-- (Ensure all auth.users have corresponding profiles)
```

---

## Next Steps (Implementation)

1. **Create migration files**: Supabase migrations for schema changes
2. **Generate TypeScript types**: Run `supabase gen types typescript`
3. **Create Zod schemas**: Validation schemas matching database types
4. **Implement API routes**: Use data model to build authentication endpoints
5. **Write tests**: Unit tests for database operations, integration tests for full flows

---

**Ready for Phase 1 continuation**: API contract generation
