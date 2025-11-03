-- Migration: Create view_events table for privacy-compliant analytics
-- Description: Tracks individual view events with anonymized IP addresses and geographic data

-- Create view_events table
CREATE TABLE IF NOT EXISTS view_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screenshot_id UUID NOT NULL REFERENCES screenshots(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_hash TEXT NOT NULL,
  country TEXT,
  is_authenticated BOOLEAN DEFAULT false,
  is_owner BOOLEAN DEFAULT false,
  user_agent_hash TEXT
);

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_view_events_screenshot ON view_events(screenshot_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_view_events_date ON view_events(viewed_at DESC);

-- Enable row-level security
ALTER TABLE view_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view analytics for their own screenshots
CREATE POLICY "Users view own screenshot analytics"
ON view_events FOR SELECT
USING (
  screenshot_id IN (
    SELECT id FROM screenshots WHERE user_id = auth.uid()
  )
);

-- RLS Policy: Service role can insert view events (API routes)
CREATE POLICY "Service role insert views"
ON view_events FOR INSERT
WITH CHECK (true);

-- Add comments
COMMENT ON TABLE view_events IS 'Privacy-compliant view tracking for screenshot analytics';
COMMENT ON COLUMN view_events.ip_hash IS 'SHA-256 hashed IP address for privacy compliance (GDPR)';
COMMENT ON COLUMN view_events.country IS 'Two-letter country code from IP geolocation';
COMMENT ON COLUMN view_events.is_owner IS 'True if viewer is screenshot owner (excluded from public analytics)';
COMMENT ON COLUMN view_events.user_agent_hash IS 'Hashed user agent for bot detection';
