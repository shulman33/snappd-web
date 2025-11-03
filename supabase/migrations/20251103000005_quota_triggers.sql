-- Migration: Create database triggers for quota enforcement and usage tracking
-- Description: Atomic quota checks and automatic usage updates via triggers

-- Function: Check upload quota before insert (race condition safe)
CREATE OR REPLACE FUNCTION check_upload_quota()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  user_plan TEXT;
  current_month TEXT;
BEGIN
  current_month := to_char(NOW(), 'YYYY-MM');

  -- Get user plan with row lock
  SELECT plan INTO user_plan FROM profiles WHERE id = NEW.user_id FOR UPDATE;

  -- Only enforce quota for free users
  IF user_plan = 'free' THEN
    -- Get current month's count with row lock (prevents race conditions)
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

-- Trigger: Check quota before screenshot insert
CREATE TRIGGER trigger_check_quota
BEFORE INSERT ON screenshots
FOR EACH ROW
EXECUTE FUNCTION check_upload_quota();

-- Function: Update monthly_usage on screenshot insert
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

-- Trigger: Update usage on screenshot insert
CREATE TRIGGER trigger_update_usage_on_insert
AFTER INSERT ON screenshots
FOR EACH ROW
EXECUTE FUNCTION update_monthly_usage_on_insert();

-- Function: Update monthly_usage on screenshot delete
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

-- Trigger: Update usage on screenshot delete
CREATE TRIGGER trigger_update_usage_on_delete
AFTER DELETE ON screenshots
FOR EACH ROW
EXECUTE FUNCTION update_monthly_usage_on_delete();

-- Function: Increment view count atomically
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

-- Trigger: Increment views on view_event insert
CREATE TRIGGER trigger_increment_views
AFTER INSERT ON view_events
FOR EACH ROW
EXECUTE FUNCTION increment_view_count();

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update screenshots timestamp
CREATE TRIGGER trigger_update_screenshots_timestamp
BEFORE UPDATE ON screenshots
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Trigger: Update upload_sessions timestamp
CREATE TRIGGER trigger_update_upload_sessions_timestamp
BEFORE UPDATE ON upload_sessions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Add comments
COMMENT ON FUNCTION check_upload_quota() IS 'Enforces monthly quota limits for free users with row-level locking';
COMMENT ON FUNCTION update_monthly_usage_on_insert() IS 'Automatically updates monthly_usage when screenshots are inserted';
COMMENT ON FUNCTION update_monthly_usage_on_delete() IS 'Automatically updates monthly_usage when screenshots are deleted';
COMMENT ON FUNCTION increment_view_count() IS 'Atomically increments screenshot view count';
COMMENT ON FUNCTION update_updated_at() IS 'Automatically updates updated_at timestamp on row updates';
