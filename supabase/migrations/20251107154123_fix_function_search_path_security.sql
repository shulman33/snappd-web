-- Fix function search_path vulnerabilities (Security Advisory: 0011_function_search_path_mutable)
-- Setting search_path = '' prevents search path injection attacks
-- All references must be schema-qualified when search_path is empty

-- 1. handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, plan, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'free',
    NOW(),
    NOW()
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error and re-raise to rollback auth.users insert
  RAISE EXCEPTION 'Failed to create profile for user %: %', NEW.id, SQLERRM;
END;
$function$;

-- 2. check_upload_quota (function variant)
CREATE OR REPLACE FUNCTION public.check_upload_quota(p_user_id uuid)
 RETURNS TABLE(allowed boolean, current_count integer, quota_limit integer, plan_type text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_plan TEXT;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
  v_current_count INTEGER;
  v_quota_limit INTEGER;
BEGIN
  SELECT plan INTO v_plan FROM public.profiles WHERE id = p_user_id;

  CASE v_plan
    WHEN 'free' THEN v_quota_limit := 10;
    WHEN 'pro' THEN v_quota_limit := NULL;
    WHEN 'team' THEN v_quota_limit := NULL;
  END CASE;

  SELECT
    current_period_start,
    current_period_end
  INTO v_period_start, v_period_end
  FROM public.subscriptions
  WHERE user_id = p_user_id
  AND status IN ('active', 'trialing')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_period_start IS NULL THEN
    v_period_start := pg_catalog.date_trunc('month', NOW());
    v_period_end := (pg_catalog.date_trunc('month', NOW()) + INTERVAL '1 month');
  END IF;

  SELECT COALESCE(screenshot_count, 0)
  INTO v_current_count
  FROM public.usage_records
  WHERE user_id = p_user_id
  AND period_start = v_period_start;

  RETURN QUERY SELECT
    (v_quota_limit IS NULL OR v_current_count < v_quota_limit) AS allowed,
    v_current_count AS current_count,
    v_quota_limit AS quota_limit,
    v_plan AS plan_type;
END;
$function$;

-- 3. check_upload_quota (trigger variant)
CREATE OR REPLACE FUNCTION public.check_upload_quota()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
DECLARE
  current_count INTEGER;
  user_plan TEXT;
  current_month TEXT;
BEGIN
  current_month := pg_catalog.to_char(NOW(), 'YYYY-MM');

  -- Get user plan with row lock
  SELECT plan INTO user_plan FROM public.profiles WHERE id = NEW.user_id FOR UPDATE;

  -- Only enforce quota for free users
  IF user_plan = 'free' THEN
    -- Get current month's count with row lock (prevents race conditions)
    SELECT COALESCE(screenshot_count, 0) INTO current_count
    FROM public.monthly_usage
    WHERE user_id = NEW.user_id AND month = current_month
    FOR UPDATE;

    IF current_count >= 10 THEN
      RAISE EXCEPTION 'Monthly quota exceeded. Upgrade to Pro for unlimited uploads.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. update_monthly_usage_on_insert
CREATE OR REPLACE FUNCTION public.update_monthly_usage_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
DECLARE
  current_month TEXT;
BEGIN
  current_month := pg_catalog.to_char(NOW(), 'YYYY-MM');

  INSERT INTO public.monthly_usage (user_id, month, screenshot_count, storage_bytes)
  VALUES (NEW.user_id, current_month, 1, NEW.file_size)
  ON CONFLICT (user_id, month)
  DO UPDATE SET
    screenshot_count = public.monthly_usage.screenshot_count + 1,
    storage_bytes = public.monthly_usage.storage_bytes + NEW.file_size;

  RETURN NEW;
END;
$function$;

-- 5. update_monthly_usage_on_delete
CREATE OR REPLACE FUNCTION public.update_monthly_usage_on_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
DECLARE
  screenshot_month TEXT;
BEGIN
  screenshot_month := pg_catalog.to_char(OLD.created_at, 'YYYY-MM');

  UPDATE public.monthly_usage
  SET
    screenshot_count = screenshot_count - 1,
    storage_bytes = storage_bytes - OLD.file_size
  WHERE user_id = OLD.user_id AND month = screenshot_month;

  RETURN OLD;
END;
$function$;

-- 6. increment_view_count
CREATE OR REPLACE FUNCTION public.increment_view_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
BEGIN
  -- Increment view counter atomically
  UPDATE public.screenshots
  SET views = views + 1
  WHERE id = NEW.screenshot_id;

  RETURN NEW;
END;
$function$;

-- 7. update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- 8. invoke_cleanup_edge_function
CREATE OR REPLACE FUNCTION public.invoke_cleanup_edge_function()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  request_id BIGINT;
  project_url TEXT;
  service_key TEXT;
BEGIN
  -- Retrieve project URL and service role key from vault
  SELECT decrypted_secret INTO project_url
  FROM vault.decrypted_secrets
  WHERE name = 'project_url';

  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key';

  -- Check if secrets are configured
  IF project_url IS NULL OR service_key IS NULL THEN
    RAISE WARNING 'Cleanup job skipped: project_url or service_role_key not configured in vault';
    RETURN;
  END IF;

  -- Invoke the cleanup-expired Edge Function via HTTP POST
  SELECT public.net.http_post(
    url := project_url || '/functions/v1/cleanup-expired',
    headers := pg_catalog.jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := pg_catalog.jsonb_build_object(
      'timestamp', pg_catalog.now()::text
    ),
    timeout_milliseconds := 30000 -- 30 second timeout for cleanup operation
  ) INTO request_id;

  RAISE NOTICE 'Cleanup Edge Function invoked with request_id: %', request_id;
END;
$function$;

-- 9. sync_team_filled_seats
CREATE OR REPLACE FUNCTION public.sync_team_filled_seats()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
BEGIN
  UPDATE public.teams
  SET filled_seats = (
    SELECT COUNT(*)
    FROM public.team_members
    WHERE public.team_members.team_id = COALESCE(NEW.team_id, OLD.team_id)
    AND public.team_members.status = 'active'
  )
  WHERE id = COALESCE(NEW.team_id, OLD.team_id);
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 10. sync_profile_plan
CREATE OR REPLACE FUNCTION public.sync_profile_plan()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
BEGIN
  IF NEW.status IN ('active', 'trialing') THEN
    UPDATE public.profiles
    SET plan = NEW.plan_type
    WHERE id = NEW.user_id;
  ELSIF NEW.status IN ('canceled', 'suspended') THEN
    UPDATE public.profiles
    SET plan = 'free'
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$function$;
