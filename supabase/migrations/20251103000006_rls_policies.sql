-- Migration: Create RLS policies for screenshot sharing and access control
-- Description: Implements row-level security policies for screenshots table

-- Note: RLS policies for view_events, daily_view_stats, and upload_sessions
-- are already created in their respective table creation migrations.
-- This migration focuses on screenshots table policies.

-- Enable RLS on screenshots if not already enabled
ALTER TABLE screenshots ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own screenshots
DROP POLICY IF EXISTS "Users view own screenshots" ON screenshots;
CREATE POLICY "Users view own screenshots"
ON screenshots FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own screenshots
DROP POLICY IF EXISTS "Users insert own screenshots" ON screenshots;
CREATE POLICY "Users insert own screenshots"
ON screenshots FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own screenshots
DROP POLICY IF EXISTS "Users update own screenshots" ON screenshots;
CREATE POLICY "Users update own screenshots"
ON screenshots FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Users can delete their own screenshots
DROP POLICY IF EXISTS "Users delete own screenshots" ON screenshots;
CREATE POLICY "Users delete own screenshots"
ON screenshots FOR DELETE
USING (auth.uid() = user_id);

-- Policy: Public screenshots viewable by anyone (for sharing)
-- This policy allows unauthenticated access to public screenshots
DROP POLICY IF EXISTS "Public screenshots viewable" ON screenshots;
CREATE POLICY "Public screenshots viewable"
ON screenshots FOR SELECT
USING (
  is_public = true
  AND sharing_mode = 'public'
  AND (expires_at IS NULL OR expires_at > NOW())
);

-- Add comments
COMMENT ON POLICY "Users view own screenshots" ON screenshots IS 'Users can view all their own screenshots';
COMMENT ON POLICY "Users insert own screenshots" ON screenshots IS 'Users can only insert screenshots for themselves';
COMMENT ON POLICY "Users update own screenshots" ON screenshots IS 'Users can only update their own screenshots';
COMMENT ON POLICY "Users delete own screenshots" ON screenshots IS 'Users can only delete their own screenshots';
COMMENT ON POLICY "Public screenshots viewable" ON screenshots IS 'Public, non-expired screenshots viewable by anyone for sharing';
