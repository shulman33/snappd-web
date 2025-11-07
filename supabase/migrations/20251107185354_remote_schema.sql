drop policy "Service role can manage all credit balances" on "public"."credit_balances";

drop policy "Service role can manage all dunning attempts" on "public"."dunning_attempts";

drop policy "Service role can manage all invoices" on "public"."invoices";

drop policy "Service role can manage all payment methods" on "public"."payment_methods";

drop policy "Service role can manage all Stripe customers" on "public"."stripe_customers";

drop policy "Service role can manage all subscription events" on "public"."subscription_events";

drop policy "Service role can manage all subscriptions" on "public"."subscriptions";

drop policy "Service role can manage all team members" on "public"."team_members";

drop policy "Service role can manage all teams" on "public"."teams";

drop policy "Service role can manage all usage records" on "public"."usage_records";

drop policy "Team members can view their team" on "public"."teams";

revoke delete on table "public"."credit_balances" from "anon";

revoke insert on table "public"."credit_balances" from "anon";

revoke references on table "public"."credit_balances" from "anon";

revoke select on table "public"."credit_balances" from "anon";

revoke trigger on table "public"."credit_balances" from "anon";

revoke truncate on table "public"."credit_balances" from "anon";

revoke update on table "public"."credit_balances" from "anon";

revoke delete on table "public"."credit_balances" from "authenticated";

revoke insert on table "public"."credit_balances" from "authenticated";

revoke references on table "public"."credit_balances" from "authenticated";

revoke select on table "public"."credit_balances" from "authenticated";

revoke trigger on table "public"."credit_balances" from "authenticated";

revoke truncate on table "public"."credit_balances" from "authenticated";

revoke update on table "public"."credit_balances" from "authenticated";

revoke delete on table "public"."credit_balances" from "service_role";

revoke insert on table "public"."credit_balances" from "service_role";

revoke references on table "public"."credit_balances" from "service_role";

revoke select on table "public"."credit_balances" from "service_role";

revoke trigger on table "public"."credit_balances" from "service_role";

revoke truncate on table "public"."credit_balances" from "service_role";

revoke update on table "public"."credit_balances" from "service_role";

revoke delete on table "public"."dunning_attempts" from "anon";

revoke insert on table "public"."dunning_attempts" from "anon";

revoke references on table "public"."dunning_attempts" from "anon";

revoke select on table "public"."dunning_attempts" from "anon";

revoke trigger on table "public"."dunning_attempts" from "anon";

revoke truncate on table "public"."dunning_attempts" from "anon";

revoke update on table "public"."dunning_attempts" from "anon";

revoke delete on table "public"."dunning_attempts" from "authenticated";

revoke insert on table "public"."dunning_attempts" from "authenticated";

revoke references on table "public"."dunning_attempts" from "authenticated";

revoke select on table "public"."dunning_attempts" from "authenticated";

revoke trigger on table "public"."dunning_attempts" from "authenticated";

revoke truncate on table "public"."dunning_attempts" from "authenticated";

revoke update on table "public"."dunning_attempts" from "authenticated";

revoke delete on table "public"."dunning_attempts" from "service_role";

revoke insert on table "public"."dunning_attempts" from "service_role";

revoke references on table "public"."dunning_attempts" from "service_role";

revoke select on table "public"."dunning_attempts" from "service_role";

revoke trigger on table "public"."dunning_attempts" from "service_role";

revoke truncate on table "public"."dunning_attempts" from "service_role";

revoke update on table "public"."dunning_attempts" from "service_role";

revoke delete on table "public"."invoices" from "anon";

revoke insert on table "public"."invoices" from "anon";

revoke references on table "public"."invoices" from "anon";

revoke select on table "public"."invoices" from "anon";

revoke trigger on table "public"."invoices" from "anon";

revoke truncate on table "public"."invoices" from "anon";

revoke update on table "public"."invoices" from "anon";

revoke delete on table "public"."invoices" from "authenticated";

revoke insert on table "public"."invoices" from "authenticated";

revoke references on table "public"."invoices" from "authenticated";

revoke select on table "public"."invoices" from "authenticated";

revoke trigger on table "public"."invoices" from "authenticated";

revoke truncate on table "public"."invoices" from "authenticated";

revoke update on table "public"."invoices" from "authenticated";

revoke delete on table "public"."invoices" from "service_role";

revoke insert on table "public"."invoices" from "service_role";

revoke references on table "public"."invoices" from "service_role";

revoke select on table "public"."invoices" from "service_role";

revoke trigger on table "public"."invoices" from "service_role";

revoke truncate on table "public"."invoices" from "service_role";

revoke update on table "public"."invoices" from "service_role";

revoke delete on table "public"."payment_methods" from "anon";

revoke insert on table "public"."payment_methods" from "anon";

revoke references on table "public"."payment_methods" from "anon";

revoke select on table "public"."payment_methods" from "anon";

revoke trigger on table "public"."payment_methods" from "anon";

revoke truncate on table "public"."payment_methods" from "anon";

revoke update on table "public"."payment_methods" from "anon";

revoke delete on table "public"."payment_methods" from "authenticated";

revoke insert on table "public"."payment_methods" from "authenticated";

revoke references on table "public"."payment_methods" from "authenticated";

revoke select on table "public"."payment_methods" from "authenticated";

revoke trigger on table "public"."payment_methods" from "authenticated";

revoke truncate on table "public"."payment_methods" from "authenticated";

revoke update on table "public"."payment_methods" from "authenticated";

revoke delete on table "public"."payment_methods" from "service_role";

revoke insert on table "public"."payment_methods" from "service_role";

revoke references on table "public"."payment_methods" from "service_role";

revoke select on table "public"."payment_methods" from "service_role";

revoke trigger on table "public"."payment_methods" from "service_role";

revoke truncate on table "public"."payment_methods" from "service_role";

revoke update on table "public"."payment_methods" from "service_role";

revoke delete on table "public"."stripe_customers" from "anon";

revoke insert on table "public"."stripe_customers" from "anon";

revoke references on table "public"."stripe_customers" from "anon";

revoke select on table "public"."stripe_customers" from "anon";

revoke trigger on table "public"."stripe_customers" from "anon";

revoke truncate on table "public"."stripe_customers" from "anon";

revoke update on table "public"."stripe_customers" from "anon";

revoke delete on table "public"."stripe_customers" from "authenticated";

revoke insert on table "public"."stripe_customers" from "authenticated";

revoke references on table "public"."stripe_customers" from "authenticated";

revoke select on table "public"."stripe_customers" from "authenticated";

revoke trigger on table "public"."stripe_customers" from "authenticated";

revoke truncate on table "public"."stripe_customers" from "authenticated";

revoke update on table "public"."stripe_customers" from "authenticated";

revoke delete on table "public"."stripe_customers" from "service_role";

revoke insert on table "public"."stripe_customers" from "service_role";

revoke references on table "public"."stripe_customers" from "service_role";

revoke select on table "public"."stripe_customers" from "service_role";

revoke trigger on table "public"."stripe_customers" from "service_role";

revoke truncate on table "public"."stripe_customers" from "service_role";

revoke update on table "public"."stripe_customers" from "service_role";

revoke delete on table "public"."subscription_events" from "anon";

revoke insert on table "public"."subscription_events" from "anon";

revoke references on table "public"."subscription_events" from "anon";

revoke select on table "public"."subscription_events" from "anon";

revoke trigger on table "public"."subscription_events" from "anon";

revoke truncate on table "public"."subscription_events" from "anon";

revoke update on table "public"."subscription_events" from "anon";

revoke delete on table "public"."subscription_events" from "authenticated";

revoke insert on table "public"."subscription_events" from "authenticated";

revoke references on table "public"."subscription_events" from "authenticated";

revoke select on table "public"."subscription_events" from "authenticated";

revoke trigger on table "public"."subscription_events" from "authenticated";

revoke truncate on table "public"."subscription_events" from "authenticated";

revoke update on table "public"."subscription_events" from "authenticated";

revoke delete on table "public"."subscription_events" from "service_role";

revoke insert on table "public"."subscription_events" from "service_role";

revoke references on table "public"."subscription_events" from "service_role";

revoke select on table "public"."subscription_events" from "service_role";

revoke trigger on table "public"."subscription_events" from "service_role";

revoke truncate on table "public"."subscription_events" from "service_role";

revoke update on table "public"."subscription_events" from "service_role";

revoke delete on table "public"."subscriptions" from "anon";

revoke insert on table "public"."subscriptions" from "anon";

revoke references on table "public"."subscriptions" from "anon";

revoke select on table "public"."subscriptions" from "anon";

revoke trigger on table "public"."subscriptions" from "anon";

revoke truncate on table "public"."subscriptions" from "anon";

revoke update on table "public"."subscriptions" from "anon";

revoke delete on table "public"."subscriptions" from "authenticated";

revoke insert on table "public"."subscriptions" from "authenticated";

revoke references on table "public"."subscriptions" from "authenticated";

revoke select on table "public"."subscriptions" from "authenticated";

revoke trigger on table "public"."subscriptions" from "authenticated";

revoke truncate on table "public"."subscriptions" from "authenticated";

revoke update on table "public"."subscriptions" from "authenticated";

revoke delete on table "public"."subscriptions" from "service_role";

revoke insert on table "public"."subscriptions" from "service_role";

revoke references on table "public"."subscriptions" from "service_role";

revoke select on table "public"."subscriptions" from "service_role";

revoke trigger on table "public"."subscriptions" from "service_role";

revoke truncate on table "public"."subscriptions" from "service_role";

revoke update on table "public"."subscriptions" from "service_role";

revoke delete on table "public"."team_members" from "anon";

revoke insert on table "public"."team_members" from "anon";

revoke references on table "public"."team_members" from "anon";

revoke select on table "public"."team_members" from "anon";

revoke trigger on table "public"."team_members" from "anon";

revoke truncate on table "public"."team_members" from "anon";

revoke update on table "public"."team_members" from "anon";

revoke delete on table "public"."team_members" from "authenticated";

revoke insert on table "public"."team_members" from "authenticated";

revoke references on table "public"."team_members" from "authenticated";

revoke select on table "public"."team_members" from "authenticated";

revoke trigger on table "public"."team_members" from "authenticated";

revoke truncate on table "public"."team_members" from "authenticated";

revoke update on table "public"."team_members" from "authenticated";

revoke delete on table "public"."team_members" from "service_role";

revoke insert on table "public"."team_members" from "service_role";

revoke references on table "public"."team_members" from "service_role";

revoke select on table "public"."team_members" from "service_role";

revoke trigger on table "public"."team_members" from "service_role";

revoke truncate on table "public"."team_members" from "service_role";

revoke update on table "public"."team_members" from "service_role";

revoke delete on table "public"."teams" from "anon";

revoke insert on table "public"."teams" from "anon";

revoke references on table "public"."teams" from "anon";

revoke select on table "public"."teams" from "anon";

revoke trigger on table "public"."teams" from "anon";

revoke truncate on table "public"."teams" from "anon";

revoke update on table "public"."teams" from "anon";

revoke delete on table "public"."teams" from "authenticated";

revoke insert on table "public"."teams" from "authenticated";

revoke references on table "public"."teams" from "authenticated";

revoke select on table "public"."teams" from "authenticated";

revoke trigger on table "public"."teams" from "authenticated";

revoke truncate on table "public"."teams" from "authenticated";

revoke update on table "public"."teams" from "authenticated";

revoke delete on table "public"."teams" from "service_role";

revoke insert on table "public"."teams" from "service_role";

revoke references on table "public"."teams" from "service_role";

revoke select on table "public"."teams" from "service_role";

revoke trigger on table "public"."teams" from "service_role";

revoke truncate on table "public"."teams" from "service_role";

revoke update on table "public"."teams" from "service_role";

revoke delete on table "public"."usage_records" from "anon";

revoke insert on table "public"."usage_records" from "anon";

revoke references on table "public"."usage_records" from "anon";

revoke select on table "public"."usage_records" from "anon";

revoke trigger on table "public"."usage_records" from "anon";

revoke truncate on table "public"."usage_records" from "anon";

revoke update on table "public"."usage_records" from "anon";

revoke delete on table "public"."usage_records" from "authenticated";

revoke insert on table "public"."usage_records" from "authenticated";

revoke references on table "public"."usage_records" from "authenticated";

revoke select on table "public"."usage_records" from "authenticated";

revoke trigger on table "public"."usage_records" from "authenticated";

revoke truncate on table "public"."usage_records" from "authenticated";

revoke update on table "public"."usage_records" from "authenticated";

revoke delete on table "public"."usage_records" from "service_role";

revoke insert on table "public"."usage_records" from "service_role";

revoke references on table "public"."usage_records" from "service_role";

revoke select on table "public"."usage_records" from "service_role";

revoke trigger on table "public"."usage_records" from "service_role";

revoke truncate on table "public"."usage_records" from "service_role";

revoke update on table "public"."usage_records" from "service_role";

drop index if exists "public"."idx_stripe_customers_stripe_id";

CREATE INDEX idx_subscriptions_team_id ON public.subscriptions USING btree (team_id);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.check_upload_quota()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
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
$function$
;

CREATE OR REPLACE FUNCTION public.check_upload_quota(p_user_id uuid)
 RETURNS TABLE(allowed boolean, current_count integer, quota_limit integer, plan_type text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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
$function$
;

CREATE OR REPLACE FUNCTION public.delete_user_data(target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  screenshots_deleted integer;
  monthly_usage_deleted integer;
  auth_events_deleted integer;
  profile_deleted integer;
  screenshot_paths text[];
BEGIN
  -- All operations within this function are in a single transaction
  -- If any operation fails, PostgreSQL automatically rolls back all changes
  
  -- 1. Fetch screenshot storage paths BEFORE deleting (for storage cleanup)
  SELECT array_agg(storage_path) INTO screenshot_paths
  FROM screenshots
  WHERE user_id = target_user_id;
  
  -- 2. Delete screenshots metadata
  DELETE FROM screenshots 
  WHERE user_id = target_user_id;
  GET DIAGNOSTICS screenshots_deleted = ROW_COUNT;
  
  -- 3. Delete monthly_usage records
  DELETE FROM monthly_usage 
  WHERE user_id = target_user_id;
  GET DIAGNOSTICS monthly_usage_deleted = ROW_COUNT;
  
  -- 4. Delete auth_events records
  DELETE FROM auth_events 
  WHERE user_id = target_user_id;
  GET DIAGNOSTICS auth_events_deleted = ROW_COUNT;
  
  -- 5. Delete profile record
  DELETE FROM profiles 
  WHERE id = target_user_id;
  GET DIAGNOSTICS profile_deleted = ROW_COUNT;
  
  -- Return deletion summary including storage paths for cleanup
  RETURN jsonb_build_object(
    'screenshots_deleted', screenshots_deleted,
    'monthly_usage_deleted', monthly_usage_deleted,
    'auth_events_deleted', auth_events_deleted,
    'profile_deleted', profile_deleted,
    'storage_paths', COALESCE(screenshot_paths, ARRAY[]::text[])
  );
  
  -- If any operation fails, PostgreSQL automatically rolls back all changes
  EXCEPTION WHEN OTHERS THEN
    -- Re-raise the exception to trigger rollback
    RAISE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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
$function$
;

CREATE OR REPLACE FUNCTION public.increment_view_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  -- Increment view counter atomically
  UPDATE public.screenshots
  SET views = views + 1
  WHERE id = NEW.screenshot_id;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.invoke_cleanup_edge_function()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
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
  -- Note: Using extensions.net.http_post now that pg_net is in extensions schema
  SELECT extensions.http_post(
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
$function$
;

CREATE OR REPLACE FUNCTION public.sync_profile_plan()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
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
$function$
;

CREATE OR REPLACE FUNCTION public.sync_team_filled_seats()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_monthly_usage_on_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_monthly_usage_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_user_password(user_email text, user_password text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public', 'pg_temp'
AS $function$
DECLARE
  user_record RECORD;
BEGIN
  -- Get user record by email from auth.users
  SELECT * INTO user_record
  FROM auth.users
  WHERE email = user_email
  AND deleted_at IS NULL;
  
  -- Return false if user not found
  IF user_record IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Verify password using crypt (bcrypt comparison)
  -- The encrypted_password column stores bcrypt hashes
  -- crypt() is provided by the pgcrypto extension
  RETURN (user_record.encrypted_password = crypt(user_password, user_record.encrypted_password));
END;
$function$
;

create policy "Team members can view their team"
on "public"."teams"
as permissive
for select
to public
using (((( SELECT auth.uid() AS uid) = admin_user_id) OR (EXISTS ( SELECT 1
   FROM team_members
  WHERE ((team_members.team_id = teams.id) AND (team_members.user_id = ( SELECT auth.uid() AS uid)) AND (team_members.status = 'active'::text))))));




