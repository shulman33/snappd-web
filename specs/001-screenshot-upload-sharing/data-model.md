# Data Model: Screenshot Upload and Sharing System

**Feature**: `001-screenshot-upload-sharing`
**Date**: 2025-11-03
**Status**: Complete

## Overview

This data model extends the existing Supabase schema with tables and storage structures necessary for screenshot upload, sharing, and analytics. All tables leverage PostgreSQL features including RLS policies, triggers, and constraints.

---

## Database Schema

### Extended Tables

#### 1. `screenshots` (EXTENDED)

**Purpose**: Stores metadata for uploaded screenshots with sharing and access control settings

**Schema**:
```sql
CREATE TABLE screenshots (
  -- Existing columns (already in database)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  short_id TEXT UNIQUE NOT NULL,
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/png',
  expires_at TIMESTAMPTZ,
  views INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- NEW: Additional columns for enhanced functionality
  file_hash TEXT NOT NULL, -- SHA-256 hash for duplicate detection
  sharing_mode TEXT NOT NULL DEFAULT 'public', -- 'public', 'private', 'password'
  password_hash TEXT, -- Bcrypt hash for password-protected screenshots
  thumbnail_path TEXT, -- Path to generated thumbnail
  optimized_path TEXT, -- Path to optimized version (if different from original)
  processing_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  processing_error TEXT, -- Error message if processing failed

  -- Indexes
  CONSTRAINT valid_sharing_mode CHECK (sharing_mode IN ('public', 'private', 'password')),
  CONSTRAINT valid_mime_type CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif')),
  CONSTRAINT valid_processing_status CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  CONSTRAINT password_required_for_protected CHECK (
    (sharing_mode = 'password' AND password_hash IS NOT NULL) OR
    (sharing_mode != 'password')
  )
);

-- Indexes for performance
CREATE INDEX idx_screenshots_user_id ON screenshots(user_id);
CREATE INDEX idx_screenshots_short_id ON screenshots(short_id);
CREATE INDEX idx_screenshots_file_hash ON screenshots(user_id, file_hash);
CREATE INDEX idx_screenshots_expires_at ON screenshots(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_screenshots_created_at ON screenshots(user_id, created_at DESC);
```

**Key Fields**:
- `short_id`: Base62-encoded ID for shareable URLs (e.g., "aB3xYz")
- `file_hash`: SHA-256 hash for duplicate detection
- `sharing_mode`: Access control setting
- `password_hash`: Bcrypt-hashed password (only for password-protected mode)
- `processing_status`: Tracks image optimization state

**Relationships**:
- `user_id` → `profiles.id` (CASCADE DELETE)

**RLS Policies**:
```sql
-- Users can view their own screenshots
CREATE POLICY "Users view own screenshots"
ON screenshots FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own screenshots
CREATE POLICY "Users insert own screenshots"
ON screenshots FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own screenshots
CREATE POLICY "Users update own screenshots"
ON screenshots FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own screenshots
CREATE POLICY "Users delete own screenshots"
ON screenshots FOR DELETE
USING (auth.uid() = user_id);

-- Service role can view public screenshots (for sharing)
CREATE POLICY "Service role access"
ON screenshots FOR SELECT
USING (is_public = true OR sharing_mode = 'public');
```

---

#### 2. `view_events` (NEW)

**Purpose**: Tracks individual view events for analytics with privacy-compliant data

**Schema**:
```sql
CREATE TABLE view_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screenshot_id UUID NOT NULL REFERENCES screenshots(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_hash TEXT NOT NULL, -- SHA-256 hashed IP for privacy
  country TEXT, -- Country code from IP geolocation (e.g., 'US', 'UK')
  is_authenticated BOOLEAN DEFAULT false,
  is_owner BOOLEAN DEFAULT false, -- True if viewer is screenshot owner
  user_agent_hash TEXT, -- Hashed user agent for bot detection

  -- Indexes for analytics queries
  CREATE INDEX idx_view_events_screenshot ON view_events(screenshot_id, viewed_at DESC);
  CREATE INDEX idx_view_events_date ON view_events(viewed_at DESC);
);

-- Enable row-level security
ALTER TABLE view_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users view own screenshot analytics"
ON view_events FOR SELECT
USING (
  screenshot_id IN (
    SELECT id FROM screenshots WHERE user_id = auth.uid()
  )
);

-- Service role can insert view events
CREATE POLICY "Service role insert views"
ON view_events FOR INSERT
WITH CHECK (true); -- Handled by API route authentication
```

**Key Fields**:
- `ip_hash`: SHA-256(IP + salt) for privacy compliance
- `country`: Two-letter country code from IP geolocation
- `is_owner`: Excludes owner views from public analytics
- `user_agent_hash`: For bot detection and filtering

**Relationships**:
- `screenshot_id` → `screenshots.id` (CASCADE DELETE)

---

#### 3. `daily_view_stats` (NEW)

**Purpose**: Pre-aggregated daily view statistics for fast dashboard queries

**Schema**:
```sql
CREATE TABLE daily_view_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screenshot_id UUID NOT NULL REFERENCES screenshots(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  view_count INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0, -- Count of unique IP hashes
  country_stats JSONB, -- {"US": 10, "UK": 5, ...}
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one row per screenshot per day
  UNIQUE(screenshot_id, date)
);

-- Indexes
CREATE INDEX idx_daily_stats_screenshot ON daily_view_stats(screenshot_id, date DESC);

-- Enable RLS
ALTER TABLE daily_view_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Users view own screenshot stats"
ON daily_view_stats FOR SELECT
USING (
  screenshot_id IN (
    SELECT id FROM screenshots WHERE user_id = auth.uid()
  )
);
```

**Purpose**: Improves dashboard performance by pre-aggregating view data daily

**Update Mechanism**: Background job or trigger aggregates `view_events` daily

---

#### 4. `upload_sessions` (NEW)

**Purpose**: Tracks multi-part upload sessions for resumable uploads and progress monitoring

**Schema**:
```sql
CREATE TABLE upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  upload_status TEXT DEFAULT 'pending', -- 'pending', 'uploading', 'processing', 'completed', 'failed'
  bytes_uploaded BIGINT DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  signed_url TEXT, -- Temporary signed upload URL
  signed_url_expires_at TIMESTAMPTZ,
  screenshot_id UUID REFERENCES screenshots(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_upload_status CHECK (upload_status IN ('pending', 'uploading', 'processing', 'completed', 'failed'))
);

-- Indexes
CREATE INDEX idx_upload_sessions_user ON upload_sessions(user_id, created_at DESC);
CREATE INDEX idx_upload_sessions_status ON upload_sessions(upload_status) WHERE upload_status IN ('pending', 'uploading');

-- Enable RLS
ALTER TABLE upload_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users manage own upload sessions"
ON upload_sessions FOR ALL
USING (auth.uid() = user_id);
```

**Key Fields**:
- `upload_status`: Current state of upload process
- `bytes_uploaded`: For progress tracking
- `retry_count`: Tracks automatic retry attempts (max 3)
- `signed_url`: Temporary Supabase signed upload URL
- `screenshot_id`: Links to final screenshot after completion

**Relationships**:
- `user_id` → `profiles.id` (CASCADE DELETE)
- `screenshot_id` → `screenshots.id` (SET NULL)

---

### Extended Existing Tables

#### 5. `monthly_usage` (EXTENDED)

**Purpose**: Already exists; no schema changes needed

**Existing Schema**:
```sql
CREATE TABLE monthly_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- Format: "YYYY-MM"
  screenshot_count INTEGER DEFAULT 0,
  storage_bytes BIGINT DEFAULT 0,
  bandwidth_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, month)
);
```

**Usage**: Updated by triggers when screenshots are created/deleted

---

#### 6. `profiles` (NO CHANGES)

**Existing Schema**: Already contains plan information (`plan` column: 'free', 'pro', 'team')

---

## Storage Structure

### Supabase Storage Bucket: `screenshots`

**Configuration**:
```sql
-- Bucket settings (configured via Supabase Dashboard or SQL)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'screenshots',
  'screenshots',
  true, -- Public bucket for CDN access
  10485760, -- 10MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
);
```

**Folder Structure**:
```
screenshots/
├── {user_id}/
│   ├── {year}/
│   │   ├── {month}/
│   │   │   ├── {hash}-{timestamp}.{ext}      # Original file
│   │   │   ├── {hash}-{timestamp}_thumb.webp # Thumbnail (generated)
│   │   │   └── {hash}-{timestamp}_opt.webp   # Optimized version (generated)
```

**Example Path**:
```
screenshots/550e8400-e29b-41d4-a716-446655440000/2025/11/a3f5e8b-1730678400000.png
```

**Storage RLS Policies**:
```sql
-- Users can upload to their own folder
CREATE POLICY "Users upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'screenshots' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can read their own files
CREATE POLICY "Users read own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'screenshots' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Public read access for sharing (via signed URLs)
CREATE POLICY "Public read via signed URLs"
ON storage.objects FOR SELECT
USING (bucket_id = 'screenshots');
```

---

## Database Triggers

### 1. Update `monthly_usage` on Screenshot Insert

```sql
CREATE OR REPLACE FUNCTION update_monthly_usage_on_insert()
RETURNS TRIGGER AS $$
DECLARE
  current_month TEXT;
BEGIN
  current_month := to_char(NOW(), 'YYYY-MM');

  INSERT INTO monthly_usage (user_id, month, screenshot_count, storage_bytes)
  VALUES (NEW.user_id, current_month, 1, NEW.file_size)
  ON CONFLICT (user_id, month)
  DO UPDATE SET
    screenshot_count = monthly_usage.screenshot_count + 1,
    storage_bytes = monthly_usage.storage_bytes + NEW.file_size;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_usage_on_insert
AFTER INSERT ON screenshots
FOR EACH ROW
EXECUTE FUNCTION update_monthly_usage_on_insert();
```

### 2. Update `monthly_usage` on Screenshot Delete

```sql
CREATE OR REPLACE FUNCTION update_monthly_usage_on_delete()
RETURNS TRIGGER AS $$
DECLARE
  screenshot_month TEXT;
BEGIN
  screenshot_month := to_char(OLD.created_at, 'YYYY-MM');

  UPDATE monthly_usage
  SET
    screenshot_count = screenshot_count - 1,
    storage_bytes = storage_bytes - OLD.file_size
  WHERE user_id = OLD.user_id AND month = screenshot_month;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_usage_on_delete
AFTER DELETE ON screenshots
FOR EACH ROW
EXECUTE FUNCTION update_monthly_usage_on_delete();
```

### 3. Enforce Upload Quota

```sql
CREATE OR REPLACE FUNCTION check_upload_quota()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  user_plan TEXT;
  current_month TEXT;
BEGIN
  current_month := to_char(NOW(), 'YYYY-MM');

  -- Get user plan
  SELECT plan INTO user_plan FROM profiles WHERE id = NEW.user_id;

  -- Only enforce for free users
  IF user_plan = 'free' THEN
    -- Get current month's count with row lock
    SELECT COALESCE(screenshot_count, 0) INTO current_count
    FROM monthly_usage
    WHERE user_id = NEW.user_id AND month = current_month
    FOR UPDATE;

    IF current_count >= 10 THEN
      RAISE EXCEPTION 'Monthly quota exceeded. Upgrade to Pro for unlimited uploads.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_quota
BEFORE INSERT ON screenshots
FOR EACH ROW
EXECUTE FUNCTION check_upload_quota();
```

### 4. Update Screenshot View Count

```sql
CREATE OR REPLACE FUNCTION increment_view_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment view counter atomically
  UPDATE screenshots
  SET views = views + 1
  WHERE id = NEW.screenshot_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_views
AFTER INSERT ON view_events
FOR EACH ROW
EXECUTE FUNCTION increment_view_count();
```

### 5. Update Timestamps

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_screenshots_timestamp
BEFORE UPDATE ON screenshots
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_upload_sessions_timestamp
BEFORE UPDATE ON upload_sessions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
```

---

## Type Definitions (TypeScript)

### Core Types

```typescript
// Database types (generated by Supabase CLI)
export interface Database {
  public: {
    Tables: {
      screenshots: {
        Row: Screenshot
        Insert: ScreenshotInsert
        Update: ScreenshotUpdate
      }
      view_events: {
        Row: ViewEvent
        Insert: ViewEventInsert
        Update: ViewEventUpdate
      }
      daily_view_stats: {
        Row: DailyViewStats
        Insert: DailyViewStatsInsert
        Update: DailyViewStatsUpdate
      }
      upload_sessions: {
        Row: UploadSession
        Insert: UploadSessionInsert
        Update: UploadSessionUpdate
      }
      monthly_usage: {
        Row: MonthlyUsage
        Insert: MonthlyUsageInsert
        Update: MonthlyUsageUpdate
      }
    }
  }
}

export type Screenshot = {
  id: string
  user_id: string
  short_id: string
  storage_path: string
  original_filename: string
  file_size: number
  width: number
  height: number
  mime_type: 'image/png' | 'image/jpeg' | 'image/jpg' | 'image/webp' | 'image/gif'
  expires_at: string | null
  views: number
  is_public: boolean
  file_hash: string
  sharing_mode: 'public' | 'private' | 'password'
  password_hash: string | null
  thumbnail_path: string | null
  optimized_path: string | null
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  processing_error: string | null
  created_at: string
  updated_at: string
}

export type ViewEvent = {
  id: string
  screenshot_id: string
  viewed_at: string
  ip_hash: string
  country: string | null
  is_authenticated: boolean
  is_owner: boolean
  user_agent_hash: string | null
}

export type DailyViewStats = {
  id: string
  screenshot_id: string
  date: string
  view_count: number
  unique_viewers: number
  country_stats: Record<string, number> | null
  created_at: string
}

export type UploadSession = {
  id: string
  user_id: string
  filename: string
  file_size: number
  mime_type: string
  upload_status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed'
  bytes_uploaded: number
  retry_count: number
  error_message: string | null
  signed_url: string | null
  signed_url_expires_at: string | null
  screenshot_id: string | null
  created_at: string
  updated_at: string
}

export type MonthlyUsage = {
  id: string
  user_id: string
  month: string
  screenshot_count: number
  storage_bytes: number
  bandwidth_bytes: number
  created_at: string
}
```

---

## Migration Strategy

### Migration Order

1. **Migration 001**: Add new columns to `screenshots` table
2. **Migration 002**: Create `view_events` table
3. **Migration 003**: Create `daily_view_stats` table
4. **Migration 004**: Create `upload_sessions` table
5. **Migration 005**: Create database triggers
6. **Migration 006**: Create RLS policies
7. **Migration 007**: Configure storage bucket and policies

### Rollback Considerations

- All migrations are reversible
- Dropping tables with CASCADE will remove dependent data
- Storage objects must be manually cleaned up if bucket is dropped

---

## Data Retention and Cleanup

### Expired Screenshots
- **Trigger**: Daily pg_cron job at midnight UTC
- **Action**: Delete screenshots where `expires_at < NOW()`
- **Cascade**: Automatically deletes related `view_events` and storage files

### Old View Events
- **Retention**: Keep 90 days of detailed events
- **Aggregation**: Migrate to `daily_view_stats` before deletion
- **Schedule**: Weekly cleanup job

### Failed Upload Sessions
- **Retention**: 24 hours for pending/failed uploads
- **Action**: Delete stale sessions and signed URLs
- **Schedule**: Hourly cleanup job

---

## Performance Optimization

### Indexing Strategy
- Primary Keys: All UUID columns
- Foreign Keys: `user_id`, `screenshot_id`
- Lookup: `short_id`, `file_hash`
- Time-series: `created_at DESC`, `viewed_at DESC`
- Partial: `expires_at` (only non-null), `upload_status` (only active)

### Query Optimization
- Use `SELECT FOR UPDATE` for quota checks (atomic)
- Paginate screenshot lists (LIMIT/OFFSET)
- Pre-aggregate analytics daily (avoid real-time aggregation)
- Cache frequent queries (Vercel Edge Config or Redis)

### Connection Pooling
- Supabase handles connection pooling automatically
- Use transaction mode for multi-statement operations
- Avoid long-running transactions

---

## Security Considerations

### SQL Injection
- All queries use parameterized statements
- Supabase client automatically escapes inputs

### RLS Enforcement
- Enabled on all tables
- Policies enforce user isolation
- Service role bypasses RLS for admin operations

### Data Privacy
- IP addresses hashed before storage
- Passwords hashed with bcrypt (cost factor 10)
- User agent hashed for bot detection
- No PII stored in analytics tables
