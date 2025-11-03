-- Migration: Create upload_sessions table for resumable uploads
-- Description: Tracks upload session state for progress monitoring and retry logic

-- Create upload_sessions table
CREATE TABLE IF NOT EXISTS upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  upload_status TEXT DEFAULT 'pending',
  bytes_uploaded BIGINT DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  signed_url TEXT,
  signed_url_expires_at TIMESTAMPTZ,
  screenshot_id UUID REFERENCES screenshots(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint for valid upload status
  CONSTRAINT valid_upload_status CHECK (upload_status IN ('pending', 'uploading', 'processing', 'completed', 'failed'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_upload_sessions_user ON upload_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_status ON upload_sessions(upload_status)
  WHERE upload_status IN ('pending', 'uploading');

-- Enable row-level security
ALTER TABLE upload_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage their own upload sessions
CREATE POLICY "Users manage own upload sessions"
ON upload_sessions FOR ALL
USING (auth.uid() = user_id);

-- Add comments
COMMENT ON TABLE upload_sessions IS 'Tracks upload session state for resumable uploads and progress monitoring';
COMMENT ON COLUMN upload_sessions.upload_status IS 'Current state: pending, uploading, processing, completed, failed';
COMMENT ON COLUMN upload_sessions.retry_count IS 'Number of automatic retry attempts (max 3)';
COMMENT ON COLUMN upload_sessions.signed_url IS 'Temporary Supabase signed upload URL';
COMMENT ON COLUMN upload_sessions.screenshot_id IS 'Links to final screenshot record after completion';
