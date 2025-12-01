-- Migration: Add status tracking to stripe_events for robust idempotency
-- This implements a three-state machine pattern (NULL -> in_progress -> completed)
-- to handle race conditions and failed handler recovery.

-- Add status column with check constraint
ALTER TABLE stripe_events
ADD COLUMN status text CHECK (status IN ('in_progress', 'completed'));

-- Add attempted_at timestamp for tracking when processing started
ALTER TABLE stripe_events
ADD COLUMN attempted_at timestamptz;

-- Rename processed_at to completed_at for clarity
ALTER TABLE stripe_events
RENAME COLUMN processed_at TO completed_at;

-- Update existing records to have 'completed' status
-- (all existing records were successfully processed)
UPDATE stripe_events
SET status = 'completed', attempted_at = completed_at
WHERE status IS NULL;

-- Make status NOT NULL after backfilling existing data
ALTER TABLE stripe_events
ALTER COLUMN status SET NOT NULL;

-- Add default for status column
ALTER TABLE stripe_events
ALTER COLUMN status SET DEFAULT 'in_progress';

-- Create index for efficient lookups of stale in_progress events
CREATE INDEX idx_stripe_events_status_attempted
ON stripe_events(status, attempted_at)
WHERE status = 'in_progress';

-- Add comment explaining the pattern
COMMENT ON TABLE stripe_events IS 'Webhook idempotency tracking with three-state machine: NULL -> in_progress -> completed. Events stuck in in_progress for >1 hour can be reprocessed.';
COMMENT ON COLUMN stripe_events.status IS 'Processing status: in_progress (being processed), completed (successfully processed)';
COMMENT ON COLUMN stripe_events.attempted_at IS 'Timestamp when processing was first attempted';
COMMENT ON COLUMN stripe_events.completed_at IS 'Timestamp when processing completed successfully';
