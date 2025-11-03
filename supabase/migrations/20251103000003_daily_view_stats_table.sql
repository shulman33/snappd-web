-- Migration: Create daily_view_stats table for pre-aggregated analytics
-- Description: Stores daily aggregated view statistics for fast dashboard queries

-- Create daily_view_stats table
CREATE TABLE IF NOT EXISTS daily_view_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screenshot_id UUID NOT NULL REFERENCES screenshots(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  view_count INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0,
  country_stats JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one row per screenshot per day
  UNIQUE(screenshot_id, date)
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_daily_stats_screenshot ON daily_view_stats(screenshot_id, date DESC);

-- Enable row-level security
ALTER TABLE daily_view_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view stats for their own screenshots
CREATE POLICY "Users view own screenshot stats"
ON daily_view_stats FOR SELECT
USING (
  screenshot_id IN (
    SELECT id FROM screenshots WHERE user_id = auth.uid()
  )
);

-- Add comments
COMMENT ON TABLE daily_view_stats IS 'Pre-aggregated daily view statistics for performance';
COMMENT ON COLUMN daily_view_stats.unique_viewers IS 'Count of unique IP hashes per day';
COMMENT ON COLUMN daily_view_stats.country_stats IS 'Geographic distribution as JSON object, e.g., {"US": 10, "UK": 5}';
