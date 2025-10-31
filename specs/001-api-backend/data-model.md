# Data Model: Core API Backend

**Phase**: 1 (Design & Contracts)  
**Date**: 2025-10-17  
**Database**: Supabase PostgreSQL with Row-Level Security

## Overview

This document defines the database schema for snappd's API backend. All tables implement Row-Level Security (RLS) for multi-tenant data isolation. The schema supports freemium plan management, screenshot storage with expiration, monthly usage tracking with calendar-based resets, and Stripe subscription integration.

---

## Entity Relationship Diagram

```
┌─────────────────┐
│  auth.users     │ (Supabase managed)
│  - id (UUID)    │
│  - email        │
└────────┬────────┘
         │
         │ 1:1
         ▼
┌─────────────────────────┐
│  profiles               │
│  - id (UUID PK, FK)     │◄──────┐
│  - email                │       │
│  - full_name            │       │
│  - plan                 │       │
│  - stripe_customer_id   │       │
│  - stripe_subscription  │       │
│  - downgraded_at        │       │
│  - created_at           │       │
│  - updated_at           │       │
└─────────┬───────────────┘       │
          │                       │
          │ 1:N                   │
          ▼                       │
┌─────────────────────────┐       │
│  screenshots            │       │
│  - id (UUID PK)         │       │
│  - user_id (UUID FK)────┼───────┘
│  - short_id (TEXT)      │
│  - storage_path         │
│  - original_filename    │
│  - file_size            │
│  - width, height        │
│  - mime_type            │
│  - expires_at           │
│  - views                │
│  - is_public            │
│  - created_at           │
│  - updated_at           │
└─────────────────────────┘
          │
          │ 1:N (via user_id)
          ▼
┌─────────────────────────┐
│  monthly_usage          │
│  - id (UUID PK)         │
│  - user_id (UUID FK)────┼───────┐
│  - month (TEXT)         │       │
│  - screenshot_count     │       │
│  - storage_bytes        │       │
│  - bandwidth_bytes      │       │
│  - created_at           │       │
└─────────────────────────┘       │
                                  │
┌─────────────────────────┐       │
│  stripe_events          │       │
│  - id (TEXT PK)         │       │
│  - processed_at         │       │
└─────────────────────────┘       │
                                  │
                    (references) ─┘
```

---

## Table Definitions

### 1. profiles

Extends Supabase's `auth.users` with snappd-specific user data and plan information.

**Purpose**: Store user profile data, plan tier, Stripe customer/subscription IDs, and downgrade timestamps.

**Columns**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, REFERENCES auth.users ON DELETE CASCADE | User ID (same as auth.users.id) |
| `email` | TEXT | NOT NULL | User email (denormalized from auth.users for quick access) |
| `full_name` | TEXT | NULLABLE | User's display name |
| `plan` | TEXT | NOT NULL, DEFAULT 'free', CHECK (plan IN ('free', 'pro', 'team')) | Current subscription plan |
| `stripe_customer_id` | TEXT | UNIQUE, NULLABLE | Stripe customer ID for billing |
| `stripe_subscription_id` | TEXT | UNIQUE, NULLABLE | Active Stripe subscription ID |
| `downgraded_at` | TIMESTAMP WITH TIME ZONE | NULLABLE | Timestamp of last downgrade (for grandfathering logic) |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Account creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Last profile update timestamp |

**Indexes**:
- `idx_profiles_stripe_customer ON profiles(stripe_customer_id)` - Fast lookup for Stripe webhook processing

**Row-Level Security**:
```sql
-- Users can view own profile
CREATE POLICY "Users can view own profile" ON profiles 
  FOR SELECT USING (auth.uid() = id);

-- Users can update own profile
CREATE POLICY "Users can update own profile" ON profiles 
  FOR UPDATE USING (auth.uid() = id);
```

**Validation Rules** (enforced in application layer):
- `plan` MUST be one of: 'free', 'pro', 'team'
- `email` MUST match format: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- `stripe_customer_id` format: `cus_[A-Za-z0-9]{14,}`
- `stripe_subscription_id` format: `sub_[A-Za-z0-9]{14,}`

**State Transitions**:
1. **Signup**: `plan = 'free'`, `stripe_customer_id` created via Stripe API
2. **Upgrade**: `plan = 'pro'`, `stripe_subscription_id` set, `downgraded_at = NULL`
3. **Downgrade**: `plan = 'free'`, `stripe_subscription_id = NULL`, `downgraded_at = NOW()`
4. **Cancel**: `plan = 'free'` at end of billing period (Stripe webhook: `subscription.deleted`)

---

### 2. screenshots

Stores metadata for all uploaded screenshots with access control and expiration handling.

**Purpose**: Track screenshot metadata, ownership, public access, expiration dates, and view analytics.

**Columns**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Internal screenshot ID |
| `user_id` | UUID | NOT NULL, REFERENCES profiles(id) ON DELETE CASCADE | Owner of the screenshot |
| `short_id` | TEXT | NOT NULL, UNIQUE | Public-facing short ID (6-char nanoid) for URLs |
| `storage_path` | TEXT | NOT NULL | Supabase Storage path: `{user_id}/{timestamp}_{nanoid}.{ext}` |
| `original_filename` | TEXT | NOT NULL | Original filename from upload (max 255 chars) |
| `file_size` | BIGINT | NOT NULL | File size in bytes (max 10MB = 10,485,760 bytes) |
| `width` | INTEGER | NOT NULL | Image width in pixels |
| `height` | INTEGER | NOT NULL | Image height in pixels |
| `mime_type` | TEXT | NOT NULL, DEFAULT 'image/png' | MIME type: image/png, image/jpeg, image/gif, image/webp |
| `expires_at` | TIMESTAMP WITH TIME ZONE | NULLABLE | Expiration timestamp (NULL for pro users, upload_date + 30 days for free) |
| `views` | INTEGER | NOT NULL, DEFAULT 0 | Number of times screenshot viewed via public link |
| `is_public` | BOOLEAN | NOT NULL, DEFAULT true | Whether screenshot is publicly shareable |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Upload timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Last metadata update timestamp |

**Indexes**:
- `idx_screenshots_user_created ON screenshots(user_id, created_at DESC)` - Fast user history queries
- `idx_screenshots_short_id ON screenshots(short_id)` - Fast public viewer lookups
- `idx_screenshots_expires ON screenshots(expires_at) WHERE expires_at IS NOT NULL` - Efficient expiration cleanup

**Row-Level Security**:
```sql
-- Users can view own screenshots OR public screenshots
CREATE POLICY "Users can view own screenshots" ON screenshots 
  FOR SELECT USING (auth.uid() = user_id OR is_public = true);

-- Users can insert own screenshots only
CREATE POLICY "Users can insert own screenshots" ON screenshots 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update own screenshots only
CREATE POLICY "Users can update own screenshots" ON screenshots 
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete own screenshots only
CREATE POLICY "Users can delete own screenshots" ON screenshots 
  FOR DELETE USING (auth.uid() = user_id);
```

**Validation Rules** (enforced in application layer):
- `short_id` MUST be 6-character alphanumeric (nanoid)
- `file_size` MUST be ≤ 10,485,760 bytes (10MB)
- `mime_type` MUST be one of: 'image/png', 'image/jpeg', 'image/gif', 'image/webp'
- `original_filename` MUST be ≤ 255 characters
- `width` and `height` MUST be > 0
- `expires_at` calculation: `created_at + INTERVAL '30 days'` for free tier, NULL for pro tier

**State Transitions**:
1. **Upload**: Insert row with `expires_at` based on user plan, `views = 0`, `is_public = true`
2. **View**: Increment `views` when accessed via `/api/s/[shortId]`
3. **Expire**: When `NOW() > expires_at`, public viewer returns 410 Gone
4. **Delete**: User-initiated deletion removes row and calls Storage API to delete file

---

### 3. monthly_usage

Tracks monthly usage statistics per user for billing enforcement and analytics.

**Purpose**: Enforce free tier limits (10 screenshots/month), track storage/bandwidth for future pro tier pricing.

**Columns**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Internal usage record ID |
| `user_id` | UUID | NOT NULL, REFERENCES profiles(id) ON DELETE CASCADE | User this usage belongs to |
| `month` | TEXT | NOT NULL | Month in format 'YYYY-MM' (e.g., '2025-10') |
| `screenshot_count` | INTEGER | NOT NULL, DEFAULT 0 | Number of screenshots uploaded this month (post-downgrade only) |
| `storage_bytes` | BIGINT | NOT NULL, DEFAULT 0 | Total storage used in bytes (for future metering) |
| `bandwidth_bytes` | BIGINT | NOT NULL, DEFAULT 0 | Total bandwidth consumed in bytes (for future metering) |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Record creation timestamp |

**Indexes**:
- `idx_monthly_usage_user_month ON monthly_usage(user_id, month)` - Fast current month lookups

**Unique Constraint**:
- `UNIQUE(user_id, month)` - One usage record per user per month

**Row-Level Security**:
```sql
-- Users can view own usage only
CREATE POLICY "Users can view own usage" ON monthly_usage 
  FOR SELECT USING (auth.uid() = user_id);
```

**Validation Rules** (enforced in application layer):
- `month` format: `/^\d{4}-\d{2}$/` (e.g., '2025-10')
- `screenshot_count` MUST be ≥ 0
- `storage_bytes` MUST be ≥ 0
- `bandwidth_bytes` MUST be ≥ 0

**State Transitions**:
1. **First Upload of Month**: UPSERT creates record with `screenshot_count = 1`, `storage_bytes = file_size`
2. **Subsequent Uploads**: UPSERT increments `screenshot_count` and `storage_bytes`
3. **Month Rollover**: New record created automatically on first upload of new month
4. **Downgrade**: Only screenshots uploaded after `profiles.downgraded_at` count toward limit

**Usage Calculation Example**:
```sql
-- Get current month usage for free tier limit enforcement
SELECT screenshot_count
FROM monthly_usage
WHERE user_id = $1
  AND month = to_char(NOW(), 'YYYY-MM');

-- For grandfathering: only count screenshots uploaded after downgrade
SELECT COUNT(*)
FROM screenshots
WHERE user_id = $1
  AND created_at >= COALESCE((SELECT downgraded_at FROM profiles WHERE id = $1), '1970-01-01')
  AND created_at >= date_trunc('month', NOW());
```

---

### 4. stripe_events

Stores processed Stripe webhook event IDs for idempotency.

**Purpose**: Prevent duplicate webhook processing (Stripe can retry failed webhooks).

**Columns**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Stripe event ID (e.g., `evt_1A2B3C4D5E6F7G8H`) |
| `processed_at` | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | When event was successfully processed |

**No Indexes**: Primary key on `id` is sufficient for idempotency checks.

**No RLS**: Service role only (not user-accessible).

**Validation Rules**:
- `id` format: `/^evt_[A-Za-z0-9]{16,}$/` (Stripe event ID)

**Usage Pattern**:
```sql
-- Before processing webhook
SELECT id FROM stripe_events WHERE id = $1;
-- If exists, return 200 OK (already processed)

-- After processing webhook
INSERT INTO stripe_events (id) VALUES ($1);
```

---

## Database Migrations

**Initial Schema**: `supabase/migrations/20251017000000_initial_schema.sql`

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'team')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  downgraded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Screenshots table
CREATE TABLE screenshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  short_id TEXT UNIQUE NOT NULL,
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  mime_type TEXT DEFAULT 'image/png',
  expires_at TIMESTAMP WITH TIME ZONE,
  views INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Monthly usage table
CREATE TABLE monthly_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  month TEXT NOT NULL,
  screenshot_count INTEGER DEFAULT 0,
  storage_bytes BIGINT DEFAULT 0,
  bandwidth_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month)
);

-- Stripe events table
CREATE TABLE stripe_events (
  id TEXT PRIMARY KEY,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_screenshots_user_created ON screenshots(user_id, created_at DESC);
CREATE INDEX idx_screenshots_short_id ON screenshots(short_id);
CREATE INDEX idx_screenshots_expires ON screenshots(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_monthly_usage_user_month ON monthly_usage(user_id, month);
CREATE INDEX idx_profiles_stripe_customer ON profiles(stripe_customer_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE screenshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own screenshots" ON screenshots FOR SELECT USING (auth.uid() = user_id OR is_public = true);
CREATE POLICY "Users can insert own screenshots" ON screenshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own screenshots" ON screenshots FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own screenshots" ON screenshots FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own usage" ON monthly_usage FOR SELECT USING (auth.uid() = user_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_screenshots_updated_at BEFORE UPDATE ON screenshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## Type Definitions

**TypeScript types** (auto-generated from Supabase):

```typescript
// src/types/database.ts
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          plan: 'free' | 'pro' | 'team';
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          downgraded_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          plan?: 'free' | 'pro' | 'team';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          downgraded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          plan?: 'free' | 'pro' | 'team';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          downgraded_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      screenshots: {
        Row: {
          id: string;
          user_id: string;
          short_id: string;
          storage_path: string;
          original_filename: string;
          file_size: number;
          width: number;
          height: number;
          mime_type: string;
          expires_at: string | null;
          views: number;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          short_id: string;
          storage_path: string;
          original_filename: string;
          file_size: number;
          width: number;
          height: number;
          mime_type?: string;
          expires_at?: string | null;
          views?: number;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          short_id?: string;
          storage_path?: string;
          original_filename?: string;
          file_size?: number;
          width?: number;
          height?: number;
          mime_type?: string;
          expires_at?: string | null;
          views?: number;
          is_public?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      monthly_usage: {
        Row: {
          id: string;
          user_id: string;
          month: string;
          screenshot_count: number;
          storage_bytes: number;
          bandwidth_bytes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month: string;
          screenshot_count?: number;
          storage_bytes?: number;
          bandwidth_bytes?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          month?: string;
          screenshot_count?: number;
          storage_bytes?: number;
          bandwidth_bytes?: number;
          created_at?: string;
        };
      };
      stripe_events: {
        Row: {
          id: string;
          processed_at: string;
        };
        Insert: {
          id: string;
          processed_at?: string;
        };
        Update: {
          id?: string;
          processed_at?: string;
        };
      };
    };
  };
};
```

---

## Performance Considerations

1. **Query Optimization**:
   - All foreign keys indexed for fast joins
   - Composite index on `(user_id, created_at DESC)` for screenshot history pagination
   - Partial index on `expires_at` for cleanup jobs (excludes NULL values)

2. **Connection Pooling**:
   - Use Supabase connection pooler for serverless functions
   - Transaction mode for OLTP operations, session mode for migrations

3. **Data Growth Estimates**:
   - 1,000 users × 50 screenshots/year = 50,000 rows/year in `screenshots`
   - 1,000 users × 12 months = 12,000 rows/year in `monthly_usage`
   - Minimal growth for `profiles` and `stripe_events`
   - Total database size: ~500MB/year (mostly in Supabase Storage, not PostgreSQL)

4. **Cleanup Jobs**:
   - Weekly cron job to delete expired screenshots and storage files
   - Quarterly archival of old `monthly_usage` rows (>12 months)
   - No cleanup needed for `stripe_events` (audit trail)

---

## Summary

4 tables, 5 indexes, 7 RLS policies. Supports all functional requirements:
- ✅ Multi-tenant isolation via RLS
- ✅ Freemium plan management with grandfathering
- ✅ Screenshot expiration based on upload date
- ✅ Monthly usage tracking with calendar resets
- ✅ Stripe webhook idempotency
- ✅ Public screenshot sharing with analytics

Ready for contract generation (Phase 1 continued).

