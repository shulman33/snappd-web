-- Migration: Fix Quota Period Matching
--
-- This migration fixes the incomplete quota reset on billing cycle renewal issue.
-- The main problems were:
-- 1. The callable check_upload_quota(p_user_id) function used exact period_start matching
--    which fails for mid-month subscriptions
-- 2. The screenshot insert/delete triggers only updated monthly_usage, not usage_records
--
-- Solution:
-- 1. Update check_upload_quota(p_user_id) to use date range matching with fallback
-- 2. Update triggers to sync both usage_records and monthly_usage tables

-- ============================================================================
-- 1. Update the callable check_upload_quota function to use date range matching
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_upload_quota(p_user_id uuid)
RETURNS TABLE(allowed boolean, current_count integer, quota_limit integer, plan_type text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_plan TEXT;
  v_current_count INTEGER;
  v_quota_limit INTEGER;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Get user's current plan
  SELECT plan INTO v_plan FROM public.profiles WHERE id = p_user_id;

  -- Set quota based on plan
  CASE v_plan
    WHEN 'free' THEN v_quota_limit := 10;
    WHEN 'pro' THEN v_quota_limit := NULL;
    WHEN 'team' THEN v_quota_limit := NULL;
    ELSE v_quota_limit := 10; -- Default to free tier
  END CASE;

  -- Get current usage count using date range matching (not exact match)
  -- This works for both subscription-aligned periods and calendar months
  SELECT COALESCE(screenshot_count, 0)
  INTO v_current_count
  FROM public.usage_records
  WHERE user_id = p_user_id
    AND period_start <= v_now
    AND period_end > v_now
  ORDER BY period_start DESC
  LIMIT 1;

  -- If no usage_records found, fall back to monthly_usage (legacy compatibility)
  IF v_current_count IS NULL THEN
    SELECT COALESCE(screenshot_count, 0)
    INTO v_current_count
    FROM public.monthly_usage
    WHERE user_id = p_user_id
      AND month = pg_catalog.to_char(v_now, 'YYYY-MM');
  END IF;

  -- Default to 0 if no records found
  v_current_count := COALESCE(v_current_count, 0);

  RETURN QUERY SELECT
    (v_quota_limit IS NULL OR v_current_count < v_quota_limit) AS allowed,
    v_current_count AS current_count,
    v_quota_limit AS quota_limit,
    v_plan AS plan_type;
END;
$function$;

-- ============================================================================
-- 2. Update the screenshot insert trigger to sync BOTH tables
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_monthly_usage_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  current_month TEXT;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  current_month := pg_catalog.to_char(v_now, 'YYYY-MM');

  -- 1. Update legacy monthly_usage table (for backward compatibility)
  INSERT INTO public.monthly_usage (user_id, month, screenshot_count, storage_bytes)
  VALUES (NEW.user_id, current_month, 1, NEW.file_size)
  ON CONFLICT (user_id, month)
  DO UPDATE SET
    screenshot_count = public.monthly_usage.screenshot_count + 1,
    storage_bytes = public.monthly_usage.storage_bytes + NEW.file_size;

  -- 2. Find the current billing period using date range matching
  SELECT period_start, period_end INTO v_period_start, v_period_end
  FROM public.usage_records
  WHERE user_id = NEW.user_id
    AND period_start <= v_now
    AND period_end > v_now
  ORDER BY period_start DESC
  LIMIT 1;

  IF v_period_start IS NOT NULL THEN
    -- Update existing usage_records entry
    UPDATE public.usage_records
    SET
      screenshot_count = screenshot_count + 1,
      storage_bytes = storage_bytes + NEW.file_size,
      updated_at = v_now
    WHERE user_id = NEW.user_id
      AND period_start = v_period_start;
  ELSE
    -- No usage_records for current period - create one using calendar month
    -- This handles free users who don't have a subscription
    v_period_start := pg_catalog.date_trunc('month', v_now);
    v_period_end := pg_catalog.date_trunc('month', v_now) + INTERVAL '1 month';

    INSERT INTO public.usage_records (user_id, period_start, period_end, screenshot_count, storage_bytes, bandwidth_bytes)
    VALUES (NEW.user_id, v_period_start, v_period_end, 1, NEW.file_size, 0)
    ON CONFLICT (user_id, period_start)
    DO UPDATE SET
      screenshot_count = public.usage_records.screenshot_count + 1,
      storage_bytes = public.usage_records.storage_bytes + NEW.file_size,
      updated_at = v_now;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 3. Update the screenshot delete trigger to sync BOTH tables
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_monthly_usage_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  screenshot_month TEXT;
  v_period_start TIMESTAMPTZ;
  v_created_at TIMESTAMPTZ := OLD.created_at;
BEGIN
  screenshot_month := pg_catalog.to_char(v_created_at, 'YYYY-MM');

  -- 1. Update legacy monthly_usage table
  UPDATE public.monthly_usage
  SET
    screenshot_count = screenshot_count - 1,
    storage_bytes = storage_bytes - OLD.file_size
  WHERE user_id = OLD.user_id AND month = screenshot_month;

  -- 2. Find the usage_records period that contains the screenshot's creation date
  SELECT period_start INTO v_period_start
  FROM public.usage_records
  WHERE user_id = OLD.user_id
    AND period_start <= v_created_at
    AND period_end > v_created_at
  ORDER BY period_start DESC
  LIMIT 1;

  IF v_period_start IS NOT NULL THEN
    -- Update the usage_records entry
    UPDATE public.usage_records
    SET
      screenshot_count = GREATEST(screenshot_count - 1, 0),
      storage_bytes = GREATEST(storage_bytes - OLD.file_size, 0),
      updated_at = NOW()
    WHERE user_id = OLD.user_id
      AND period_start = v_period_start;
  END IF;

  RETURN OLD;
END;
$function$;

-- ============================================================================
-- 4. Add optimized index for date range queries on usage_records
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_usage_records_period_range
ON public.usage_records(user_id, period_start DESC, period_end);

-- ============================================================================
-- 5. Add comment documenting the fix
-- ============================================================================
COMMENT ON FUNCTION public.check_upload_quota(uuid) IS
'Checks if user can upload based on plan quota. Uses date range matching to find
the current billing period, with fallback to monthly_usage for legacy compatibility.
Fixed in migration 20251201182804 to use range queries instead of exact period_start match.';

COMMENT ON FUNCTION public.update_monthly_usage_on_insert() IS
'Trigger function that updates both monthly_usage and usage_records tables on screenshot insert.
Fixed in migration 20251201182804 to sync both tables for billing period consolidation.';

COMMENT ON FUNCTION public.update_monthly_usage_on_delete() IS
'Trigger function that updates both monthly_usage and usage_records tables on screenshot delete.
Fixed in migration 20251201182804 to sync both tables for billing period consolidation.';
