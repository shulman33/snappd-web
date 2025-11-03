-- Migration: Add screenshot upload and sharing columns to screenshots table
-- Description: Extends the existing screenshots table with additional columns for
--              file hashing, sharing modes, password protection, and processing status

-- Add new columns to screenshots table
ALTER TABLE screenshots
ADD COLUMN IF NOT EXISTS file_hash TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS sharing_mode TEXT NOT NULL DEFAULT 'public',
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_path TEXT,
ADD COLUMN IF NOT EXISTS optimized_path TEXT,
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS processing_error TEXT;

-- Add constraints for valid enum values
ALTER TABLE screenshots
ADD CONSTRAINT valid_sharing_mode CHECK (sharing_mode IN ('public', 'private', 'password'));

ALTER TABLE screenshots
ADD CONSTRAINT valid_processing_status CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'));

-- Add constraint to ensure password is required for password-protected mode
ALTER TABLE screenshots
ADD CONSTRAINT password_required_for_protected CHECK (
  (sharing_mode = 'password' AND password_hash IS NOT NULL) OR
  (sharing_mode != 'password')
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_screenshots_file_hash ON screenshots(user_id, file_hash);
CREATE INDEX IF NOT EXISTS idx_screenshots_created_at ON screenshots(user_id, created_at DESC);

-- Add comment to table
COMMENT ON COLUMN screenshots.file_hash IS 'SHA-256 hash of file content for duplicate detection';
COMMENT ON COLUMN screenshots.sharing_mode IS 'Access control mode: public, private, or password';
COMMENT ON COLUMN screenshots.password_hash IS 'Bcrypt hashed password for password-protected screenshots';
COMMENT ON COLUMN screenshots.processing_status IS 'Status of image optimization processing';
