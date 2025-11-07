


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."check_upload_quota"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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
$$;


ALTER FUNCTION "public"."check_upload_quota"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_upload_quota"() IS 'Enforces monthly quota limits for free users with row-level locking';



CREATE OR REPLACE FUNCTION "public"."check_upload_quota"("p_user_id" "uuid") RETURNS TABLE("allowed" boolean, "current_count" integer, "quota_limit" integer, "plan_type" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;


ALTER FUNCTION "public"."check_upload_quota"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user_data"("target_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."delete_user_data"("target_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_user_data"("target_user_id" "uuid") IS 'Atomically deletes all user data (screenshots, monthly_usage, auth_events, profiles) in a single transaction. Returns deletion summary and storage paths for cleanup. Used by account deletion API for GDPR/CCPA compliance.';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_view_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Increment view counter atomically
  UPDATE public.screenshots
  SET views = views + 1
  WHERE id = NEW.screenshot_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_view_count"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_view_count"() IS 'Atomically increments screenshot view count';



CREATE OR REPLACE FUNCTION "public"."invoke_cleanup_edge_function"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;


ALTER FUNCTION "public"."invoke_cleanup_edge_function"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."invoke_cleanup_edge_function"() IS 'Invokes the cleanup-expired Edge Function via HTTP POST to handle expired screenshot cleanup including storage files.';



CREATE OR REPLACE FUNCTION "public"."sync_profile_plan"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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
$$;


ALTER FUNCTION "public"."sync_profile_plan"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_team_filled_seats"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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
$$;


ALTER FUNCTION "public"."sync_team_filled_seats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_monthly_usage_on_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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
$$;


ALTER FUNCTION "public"."update_monthly_usage_on_delete"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_monthly_usage_on_delete"() IS 'Automatically updates monthly_usage when screenshots are deleted';



CREATE OR REPLACE FUNCTION "public"."update_monthly_usage_on_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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
$$;


ALTER FUNCTION "public"."update_monthly_usage_on_insert"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_monthly_usage_on_insert"() IS 'Automatically updates monthly_usage when screenshots are inserted';



CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_updated_at"() IS 'Automatically updates updated_at timestamp on row updates';



CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_user_password"("user_email" "text", "user_password" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'auth', 'public', 'pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."verify_user_password"("user_email" "text", "user_password" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."verify_user_password"("user_email" "text", "user_password" "text") IS 'Securely verifies a user password without creating a session. Returns true if password is correct, false otherwise. Uses SECURITY DEFINER to access auth.users table.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."auth_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "user_id" "uuid",
    "email" "text",
    "ip_address" "inet" NOT NULL,
    "user_agent" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."auth_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_balances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "current_balance" integer DEFAULT 0,
    "transactions" "jsonb" DEFAULT '[]'::"jsonb",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "credit_balances_current_balance_check" CHECK (("current_balance" >= 0))
);


ALTER TABLE "public"."credit_balances" OWNER TO "postgres";


COMMENT ON TABLE "public"."credit_balances" IS 'Tracks account credits from downgrades and refunds';



CREATE TABLE IF NOT EXISTS "public"."daily_view_stats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "screenshot_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "view_count" integer DEFAULT 0,
    "unique_viewers" integer DEFAULT 0,
    "country_stats" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."daily_view_stats" OWNER TO "postgres";


COMMENT ON TABLE "public"."daily_view_stats" IS 'Pre-aggregated daily view statistics for performance';



COMMENT ON COLUMN "public"."daily_view_stats"."unique_viewers" IS 'Count of unique IP hashes per day';



COMMENT ON COLUMN "public"."daily_view_stats"."country_stats" IS 'Geographic distribution as JSON object, e.g., {"US": 10, "UK": 5}';



CREATE TABLE IF NOT EXISTS "public"."dunning_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subscription_id" "uuid" NOT NULL,
    "attempt_number" integer NOT NULL,
    "attempt_date" timestamp with time zone NOT NULL,
    "payment_result" "text" NOT NULL,
    "failure_reason" "text",
    "next_retry_date" timestamp with time zone,
    "notification_sent" boolean DEFAULT false,
    "notification_sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "dunning_attempts_attempt_number_check" CHECK ((("attempt_number" >= 1) AND ("attempt_number" <= 3))),
    CONSTRAINT "dunning_attempts_payment_result_check" CHECK (("payment_result" = ANY (ARRAY['pending'::"text", 'success'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."dunning_attempts" OWNER TO "postgres";


COMMENT ON TABLE "public"."dunning_attempts" IS 'Tracks payment recovery attempts during the grace period';



CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subscription_id" "uuid",
    "stripe_invoice_id" "text" NOT NULL,
    "stripe_hosted_invoice_url" "text",
    "stripe_invoice_pdf" "text",
    "invoice_number" "text" NOT NULL,
    "status" "text" NOT NULL,
    "subtotal" integer NOT NULL,
    "tax" integer DEFAULT 0,
    "total" integer NOT NULL,
    "amount_paid" integer DEFAULT 0,
    "amount_due" integer NOT NULL,
    "line_items" "jsonb" NOT NULL,
    "period_start" timestamp with time zone NOT NULL,
    "period_end" timestamp with time zone NOT NULL,
    "due_date" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "invoices_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'open'::"text", 'paid'::"text", 'void'::"text", 'uncollectible'::"text"])))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


COMMENT ON TABLE "public"."invoices" IS 'Records all financial transactions and invoice history';



CREATE TABLE IF NOT EXISTS "public"."monthly_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "month" "text" NOT NULL,
    "screenshot_count" integer DEFAULT 0,
    "storage_bytes" bigint DEFAULT 0,
    "bandwidth_bytes" bigint DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."monthly_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stripe_payment_method_id" "text" NOT NULL,
    "card_brand" "text",
    "card_last4" "text",
    "card_exp_month" integer,
    "card_exp_year" integer,
    "billing_address" "jsonb",
    "is_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payment_methods" OWNER TO "postgres";


COMMENT ON TABLE "public"."payment_methods" IS 'Stores tokenized payment method references (no raw card data)';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "plan" "text" DEFAULT 'free'::"text",
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "downgraded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "profiles_plan_check" CHECK (("plan" = ANY (ARRAY['free'::"text", 'pro'::"text", 'team'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."screenshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "short_id" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "original_filename" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "width" integer NOT NULL,
    "height" integer NOT NULL,
    "mime_type" "text" DEFAULT 'image/png'::"text",
    "expires_at" timestamp with time zone,
    "views" integer DEFAULT 0,
    "is_public" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "file_hash" "text" DEFAULT ''::"text" NOT NULL,
    "sharing_mode" "text" DEFAULT 'public'::"text" NOT NULL,
    "password_hash" "text",
    "thumbnail_path" "text",
    "optimized_path" "text",
    "processing_status" "text" DEFAULT 'pending'::"text",
    "processing_error" "text",
    CONSTRAINT "password_required_for_protected" CHECK (((("sharing_mode" = 'password'::"text") AND ("password_hash" IS NOT NULL)) OR ("sharing_mode" <> 'password'::"text"))),
    CONSTRAINT "valid_processing_status" CHECK (("processing_status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "valid_sharing_mode" CHECK (("sharing_mode" = ANY (ARRAY['public'::"text", 'private'::"text", 'password'::"text"])))
);


ALTER TABLE "public"."screenshots" OWNER TO "postgres";


COMMENT ON COLUMN "public"."screenshots"."file_hash" IS 'SHA-256 hash of file content for duplicate detection';



COMMENT ON COLUMN "public"."screenshots"."sharing_mode" IS 'Access control mode: public, private, or password';



COMMENT ON COLUMN "public"."screenshots"."password_hash" IS 'Bcrypt hashed password for password-protected screenshots';



COMMENT ON COLUMN "public"."screenshots"."processing_status" IS 'Status of image optimization processing';



CREATE TABLE IF NOT EXISTS "public"."stripe_customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "default_payment_method_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stripe_customers" OWNER TO "postgres";


COMMENT ON TABLE "public"."stripe_customers" IS 'Maps Supabase users to Stripe Customer objects for billing operations';



CREATE TABLE IF NOT EXISTS "public"."stripe_events" (
    "id" "text" NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stripe_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."stripe_events" IS 'Idempotency tracking for Stripe webhooks. Only accessed via service role. RLS disabled as no user data is stored and table is only used for internal infrastructure.';



CREATE TABLE IF NOT EXISTS "public"."subscription_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subscription_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "previous_plan" "text",
    "new_plan" "text",
    "previous_status" "text",
    "new_status" "text",
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "subscription_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['created'::"text", 'trial_started'::"text", 'trial_converted'::"text", 'trial_canceled'::"text", 'upgraded'::"text", 'downgraded'::"text", 'canceled'::"text", 'reactivated'::"text", 'payment_succeeded'::"text", 'payment_failed'::"text", 'suspended'::"text", 'resumed'::"text"])))
);


ALTER TABLE "public"."subscription_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."subscription_events" IS 'Audit log of all subscription lifecycle changes';



CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stripe_subscription_id" "text" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "stripe_price_id" "text" NOT NULL,
    "plan_type" "text" NOT NULL,
    "billing_cycle" "text" NOT NULL,
    "status" "text" NOT NULL,
    "current_period_start" timestamp with time zone NOT NULL,
    "current_period_end" timestamp with time zone NOT NULL,
    "trial_end" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false,
    "canceled_at" timestamp with time zone,
    "seat_count" integer,
    "team_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "subscriptions_billing_cycle_check" CHECK (("billing_cycle" = ANY (ARRAY['monthly'::"text", 'annual'::"text"]))),
    CONSTRAINT "subscriptions_plan_type_check" CHECK (("plan_type" = ANY (ARRAY['free'::"text", 'pro'::"text", 'team'::"text"]))),
    CONSTRAINT "subscriptions_seat_count_check" CHECK ((("seat_count" IS NULL) OR ("seat_count" >= 3))),
    CONSTRAINT "subscriptions_status_check" CHECK (("status" = ANY (ARRAY['trialing'::"text", 'active'::"text", 'past_due'::"text", 'canceled'::"text", 'suspended'::"text"]))),
    CONSTRAINT "valid_team_subscription" CHECK (((("plan_type" = 'team'::"text") AND ("seat_count" IS NOT NULL) AND ("team_id" IS NOT NULL)) OR (("plan_type" <> 'team'::"text") AND ("seat_count" IS NULL) AND ("team_id" IS NULL))))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


COMMENT ON TABLE "public"."subscriptions" IS 'Tracks active and historical subscriptions linked to user profiles';



CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "invitation_token" "text",
    "invitation_expires_at" timestamp with time zone,
    "invited_at" timestamp with time zone DEFAULT "now"(),
    "joined_at" timestamp with time zone,
    "removed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "team_members_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'member'::"text"]))),
    CONSTRAINT "team_members_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'removed'::"text"])))
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."team_members" IS 'Tracks team membership and invitation status';



CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "admin_user_id" "uuid" NOT NULL,
    "subscription_id" "uuid",
    "seat_count" integer NOT NULL,
    "filled_seats" integer DEFAULT 1,
    "billing_email" "text",
    "company_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "teams_check" CHECK ((("filled_seats" >= 1) AND ("filled_seats" <= "seat_count"))),
    CONSTRAINT "teams_seat_count_check" CHECK (("seat_count" >= 3))
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


COMMENT ON TABLE "public"."teams" IS 'Represents team subscriptions with multi-user management';



CREATE TABLE IF NOT EXISTS "public"."upload_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "filename" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "mime_type" "text" NOT NULL,
    "upload_status" "text" DEFAULT 'pending'::"text",
    "bytes_uploaded" bigint DEFAULT 0,
    "retry_count" integer DEFAULT 0,
    "error_message" "text",
    "signed_url" "text",
    "signed_url_expires_at" timestamp with time zone,
    "screenshot_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_upload_status" CHECK (("upload_status" = ANY (ARRAY['pending'::"text", 'uploading'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."upload_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."upload_sessions" IS 'Tracks upload session state for resumable uploads and progress monitoring';



COMMENT ON COLUMN "public"."upload_sessions"."upload_status" IS 'Current state: pending, uploading, processing, completed, failed';



COMMENT ON COLUMN "public"."upload_sessions"."retry_count" IS 'Number of automatic retry attempts (max 3)';



COMMENT ON COLUMN "public"."upload_sessions"."signed_url" IS 'Temporary Supabase signed upload URL';



COMMENT ON COLUMN "public"."upload_sessions"."screenshot_id" IS 'Links to final screenshot record after completion';



CREATE TABLE IF NOT EXISTS "public"."usage_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "period_start" timestamp with time zone NOT NULL,
    "period_end" timestamp with time zone NOT NULL,
    "screenshot_count" integer DEFAULT 0,
    "storage_bytes" bigint DEFAULT 0,
    "bandwidth_bytes" bigint DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."usage_records" OWNER TO "postgres";


COMMENT ON TABLE "public"."usage_records" IS 'Tracks resource consumption against plan quotas per billing period';



CREATE TABLE IF NOT EXISTS "public"."view_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "screenshot_id" "uuid" NOT NULL,
    "viewed_at" timestamp with time zone DEFAULT "now"(),
    "ip_hash" "text" NOT NULL,
    "country" "text",
    "is_authenticated" boolean DEFAULT false,
    "is_owner" boolean DEFAULT false,
    "user_agent_hash" "text"
);


ALTER TABLE "public"."view_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."view_events" IS 'Privacy-compliant view tracking for screenshot analytics';



COMMENT ON COLUMN "public"."view_events"."ip_hash" IS 'SHA-256 hashed IP address for privacy compliance (GDPR)';



COMMENT ON COLUMN "public"."view_events"."country" IS 'Two-letter country code from IP geolocation';



COMMENT ON COLUMN "public"."view_events"."is_owner" IS 'True if viewer is screenshot owner (excluded from public analytics)';



COMMENT ON COLUMN "public"."view_events"."user_agent_hash" IS 'Hashed user agent for bot detection';



ALTER TABLE ONLY "public"."auth_events"
    ADD CONSTRAINT "auth_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_balances"
    ADD CONSTRAINT "credit_balances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_balances"
    ADD CONSTRAINT "credit_balances_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."daily_view_stats"
    ADD CONSTRAINT "daily_view_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_view_stats"
    ADD CONSTRAINT "daily_view_stats_screenshot_id_date_key" UNIQUE ("screenshot_id", "date");



ALTER TABLE ONLY "public"."dunning_attempts"
    ADD CONSTRAINT "dunning_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dunning_attempts"
    ADD CONSTRAINT "dunning_attempts_subscription_id_attempt_number_key" UNIQUE ("subscription_id", "attempt_number");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_stripe_invoice_id_key" UNIQUE ("stripe_invoice_id");



ALTER TABLE ONLY "public"."monthly_usage"
    ADD CONSTRAINT "monthly_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monthly_usage"
    ADD CONSTRAINT "monthly_usage_user_id_month_key" UNIQUE ("user_id", "month");



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_stripe_payment_method_id_key" UNIQUE ("stripe_payment_method_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."screenshots"
    ADD CONSTRAINT "screenshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."screenshots"
    ADD CONSTRAINT "screenshots_short_id_key" UNIQUE ("short_id");



ALTER TABLE ONLY "public"."stripe_customers"
    ADD CONSTRAINT "stripe_customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_customers"
    ADD CONSTRAINT "stripe_customers_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "public"."stripe_customers"
    ADD CONSTRAINT "stripe_customers_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."stripe_events"
    ADD CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_events"
    ADD CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_invitation_token_key" UNIQUE ("invitation_token");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_user_id_key" UNIQUE ("team_id", "user_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_subscription_id_key" UNIQUE ("subscription_id");



ALTER TABLE ONLY "public"."upload_sessions"
    ADD CONSTRAINT "upload_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usage_records"
    ADD CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usage_records"
    ADD CONSTRAINT "usage_records_user_id_period_start_key" UNIQUE ("user_id", "period_start");



ALTER TABLE ONLY "public"."view_events"
    ADD CONSTRAINT "view_events_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_auth_events_created" ON "public"."auth_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_auth_events_email" ON "public"."auth_events" USING "btree" ("email") WHERE ("email" IS NOT NULL);



CREATE INDEX "idx_auth_events_ip" ON "public"."auth_events" USING "btree" ("ip_address");



CREATE INDEX "idx_auth_events_rate_limit" ON "public"."auth_events" USING "btree" ("event_type", "email", "created_at") WHERE ("event_type" = ANY (ARRAY['login_failure'::"text", 'password_reset'::"text", 'magic_link'::"text", 'verification_resend'::"text"]));



CREATE INDEX "idx_auth_events_type" ON "public"."auth_events" USING "btree" ("event_type");



CREATE INDEX "idx_auth_events_user" ON "public"."auth_events" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_credit_balances_expiring" ON "public"."credit_balances" USING "btree" ("expires_at") WHERE ("expires_at" IS NOT NULL);



CREATE INDEX "idx_credit_balances_user" ON "public"."credit_balances" USING "btree" ("user_id");



CREATE INDEX "idx_daily_stats_screenshot" ON "public"."daily_view_stats" USING "btree" ("screenshot_id", "date" DESC);



CREATE INDEX "idx_dunning_attempts_next_retry" ON "public"."dunning_attempts" USING "btree" ("next_retry_date") WHERE ("payment_result" = 'failed'::"text");



CREATE INDEX "idx_dunning_attempts_subscription" ON "public"."dunning_attempts" USING "btree" ("subscription_id");



CREATE INDEX "idx_invoices_status" ON "public"."invoices" USING "btree" ("status");



CREATE INDEX "idx_invoices_stripe" ON "public"."invoices" USING "btree" ("stripe_invoice_id");



CREATE INDEX "idx_invoices_subscription" ON "public"."invoices" USING "btree" ("subscription_id");



CREATE INDEX "idx_invoices_user" ON "public"."invoices" USING "btree" ("user_id");



CREATE INDEX "idx_monthly_usage_user_month" ON "public"."monthly_usage" USING "btree" ("user_id", "month");



CREATE INDEX "idx_payment_methods_default" ON "public"."payment_methods" USING "btree" ("user_id", "is_default") WHERE ("is_default" = true);



CREATE INDEX "idx_payment_methods_user" ON "public"."payment_methods" USING "btree" ("user_id");



CREATE INDEX "idx_profiles_stripe_customer" ON "public"."profiles" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_screenshots_expires" ON "public"."screenshots" USING "btree" ("expires_at") WHERE ("expires_at" IS NOT NULL);



CREATE INDEX "idx_screenshots_file_hash" ON "public"."screenshots" USING "btree" ("user_id", "file_hash");



CREATE INDEX "idx_screenshots_short_id" ON "public"."screenshots" USING "btree" ("short_id");



CREATE INDEX "idx_screenshots_user_created" ON "public"."screenshots" USING "btree" ("user_id", "created_at" DESC);



COMMENT ON INDEX "public"."idx_screenshots_user_created" IS 'Composite index for efficient user screenshot queries ordered by creation date. Replaces duplicate idx_screenshots_created_at.';



CREATE INDEX "idx_stripe_customers_user" ON "public"."stripe_customers" USING "btree" ("user_id");



CREATE INDEX "idx_subscription_events_subscription" ON "public"."subscription_events" USING "btree" ("subscription_id", "created_at" DESC);



CREATE INDEX "idx_subscription_events_type" ON "public"."subscription_events" USING "btree" ("event_type", "created_at" DESC);



CREATE INDEX "idx_subscription_events_user" ON "public"."subscription_events" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_subscriptions_status" ON "public"."subscriptions" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['active'::"text", 'trialing'::"text", 'past_due'::"text"]));



CREATE INDEX "idx_subscriptions_stripe_customer" ON "public"."subscriptions" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_subscriptions_team_id" ON "public"."subscriptions" USING "btree" ("team_id");



CREATE INDEX "idx_subscriptions_trial_end" ON "public"."subscriptions" USING "btree" ("trial_end") WHERE ("trial_end" IS NOT NULL);



CREATE INDEX "idx_subscriptions_user" ON "public"."subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_team_members_invitation" ON "public"."team_members" USING "btree" ("invitation_token") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_team_members_status" ON "public"."team_members" USING "btree" ("team_id", "status") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_team_members_team" ON "public"."team_members" USING "btree" ("team_id");



CREATE INDEX "idx_team_members_user" ON "public"."team_members" USING "btree" ("user_id");



CREATE INDEX "idx_teams_admin" ON "public"."teams" USING "btree" ("admin_user_id");



CREATE INDEX "idx_teams_subscription" ON "public"."teams" USING "btree" ("subscription_id");



CREATE INDEX "idx_upload_sessions_screenshot" ON "public"."upload_sessions" USING "btree" ("screenshot_id") WHERE ("screenshot_id" IS NOT NULL);



COMMENT ON INDEX "public"."idx_upload_sessions_screenshot" IS 'Performance optimization: Index foreign key for efficient JOINs between upload_sessions and screenshots';



CREATE INDEX "idx_upload_sessions_status" ON "public"."upload_sessions" USING "btree" ("upload_status") WHERE ("upload_status" = ANY (ARRAY['pending'::"text", 'uploading'::"text"]));



CREATE INDEX "idx_upload_sessions_user" ON "public"."upload_sessions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_usage_records_period" ON "public"."usage_records" USING "btree" ("user_id", "period_start", "period_end");



CREATE INDEX "idx_usage_records_user" ON "public"."usage_records" USING "btree" ("user_id");



CREATE INDEX "idx_view_events_date" ON "public"."view_events" USING "btree" ("viewed_at" DESC);



CREATE INDEX "idx_view_events_screenshot" ON "public"."view_events" USING "btree" ("screenshot_id", "viewed_at" DESC);



CREATE OR REPLACE TRIGGER "sync_profile_plan_insert" AFTER INSERT ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."sync_profile_plan"();



CREATE OR REPLACE TRIGGER "sync_profile_plan_update" AFTER UPDATE OF "status", "plan_type" ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."sync_profile_plan"();



CREATE OR REPLACE TRIGGER "sync_team_filled_seats_delete" AFTER DELETE ON "public"."team_members" FOR EACH ROW EXECUTE FUNCTION "public"."sync_team_filled_seats"();



CREATE OR REPLACE TRIGGER "sync_team_filled_seats_insert" AFTER INSERT ON "public"."team_members" FOR EACH ROW EXECUTE FUNCTION "public"."sync_team_filled_seats"();



CREATE OR REPLACE TRIGGER "sync_team_filled_seats_update" AFTER UPDATE OF "status" ON "public"."team_members" FOR EACH ROW EXECUTE FUNCTION "public"."sync_team_filled_seats"();



CREATE OR REPLACE TRIGGER "trigger_check_quota" BEFORE INSERT ON "public"."screenshots" FOR EACH ROW EXECUTE FUNCTION "public"."check_upload_quota"();



CREATE OR REPLACE TRIGGER "trigger_increment_views" AFTER INSERT ON "public"."view_events" FOR EACH ROW EXECUTE FUNCTION "public"."increment_view_count"();



CREATE OR REPLACE TRIGGER "trigger_update_screenshots_timestamp" BEFORE UPDATE ON "public"."screenshots" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_upload_sessions_timestamp" BEFORE UPDATE ON "public"."upload_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_usage_on_delete" AFTER DELETE ON "public"."screenshots" FOR EACH ROW EXECUTE FUNCTION "public"."update_monthly_usage_on_delete"();



CREATE OR REPLACE TRIGGER "trigger_update_usage_on_insert" AFTER INSERT ON "public"."screenshots" FOR EACH ROW EXECUTE FUNCTION "public"."update_monthly_usage_on_insert"();



CREATE OR REPLACE TRIGGER "update_credit_balances_updated_at" BEFORE UPDATE ON "public"."credit_balances" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_dunning_attempts_updated_at" BEFORE UPDATE ON "public"."dunning_attempts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_invoices_updated_at" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_payment_methods_updated_at" BEFORE UPDATE ON "public"."payment_methods" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_screenshots_updated_at" BEFORE UPDATE ON "public"."screenshots" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_stripe_customers_updated_at" BEFORE UPDATE ON "public"."stripe_customers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_subscriptions_updated_at" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_team_members_updated_at" BEFORE UPDATE ON "public"."team_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_teams_updated_at" BEFORE UPDATE ON "public"."teams" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_usage_records_updated_at" BEFORE UPDATE ON "public"."usage_records" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "public"."auth_events"
    ADD CONSTRAINT "auth_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."credit_balances"
    ADD CONSTRAINT "credit_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_view_stats"
    ADD CONSTRAINT "daily_view_stats_screenshot_id_fkey" FOREIGN KEY ("screenshot_id") REFERENCES "public"."screenshots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dunning_attempts"
    ADD CONSTRAINT "dunning_attempts_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "fk_profiles_auth_users" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "fk_subscriptions_team" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "fk_teams_subscription" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."monthly_usage"
    ADD CONSTRAINT "monthly_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_methods"
    ADD CONSTRAINT "payment_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."screenshots"
    ADD CONSTRAINT "screenshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stripe_customers"
    ADD CONSTRAINT "stripe_customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscription_events"
    ADD CONSTRAINT "subscription_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscription_events"
    ADD CONSTRAINT "subscription_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."upload_sessions"
    ADD CONSTRAINT "upload_sessions_screenshot_id_fkey" FOREIGN KEY ("screenshot_id") REFERENCES "public"."screenshots"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."upload_sessions"
    ADD CONSTRAINT "upload_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usage_records"
    ADD CONSTRAINT "usage_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."view_events"
    ADD CONSTRAINT "view_events_screenshot_id_fkey" FOREIGN KEY ("screenshot_id") REFERENCES "public"."screenshots"("id") ON DELETE CASCADE;



CREATE POLICY "Screenshots viewable" ON "public"."screenshots" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR (("is_public" = true) AND ("sharing_mode" = 'public'::"text") AND (("expires_at" IS NULL) OR ("expires_at" > "now"())))));



COMMENT ON POLICY "Screenshots viewable" ON "public"."screenshots" IS 'Consolidated policy: Users can view their own screenshots OR anyone can view public non-expired screenshots. Replaces "Public screenshots viewable" and "Users can view own screenshots" for better performance.';



CREATE POLICY "Service can insert profiles" ON "public"."profiles" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service role for teams insert" ON "public"."teams" FOR INSERT WITH CHECK (((( SELECT "auth"."jwt"() AS "jwt") ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Service role insert views" ON "public"."view_events" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service role only" ON "public"."auth_events" USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));



CREATE POLICY "System can insert usage records" ON "public"."monthly_usage" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can update usage records" ON "public"."monthly_usage" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Team admin can manage team" ON "public"."teams" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "admin_user_id"));



CREATE POLICY "Team members can view team membership" ON "public"."team_members" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."teams"
  WHERE (("teams"."id" = "team_members"."team_id") AND (("teams"."admin_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("team_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Team members can view their team" ON "public"."teams" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "admin_user_id") OR (EXISTS ( SELECT 1
   FROM "public"."team_members"
  WHERE (("team_members"."team_id" = "teams"."id") AND ("team_members"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("team_members"."status" = 'active'::"text"))))));



CREATE POLICY "Users can delete own screenshots" ON "public"."screenshots" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert own screenshots" ON "public"."screenshots" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can update own screenshots" ON "public"."screenshots" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own Stripe customer" ON "public"."stripe_customers" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own credit balance" ON "public"."credit_balances" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own dunning attempts" ON "public"."dunning_attempts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."subscriptions"
  WHERE (("subscriptions"."id" = "dunning_attempts"."subscription_id") AND ("subscriptions"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can view own invoices" ON "public"."invoices" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own payment methods" ON "public"."payment_methods" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can view own subscription events" ON "public"."subscription_events" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own subscriptions" ON "public"."subscriptions" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own usage" ON "public"."monthly_usage" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own usage records" ON "public"."usage_records" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage own upload sessions" ON "public"."upload_sessions" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users view own screenshot analytics" ON "public"."view_events" FOR SELECT USING (("screenshot_id" IN ( SELECT "screenshots"."id"
   FROM "public"."screenshots"
  WHERE ("screenshots"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Users view own screenshot stats" ON "public"."daily_view_stats" FOR SELECT USING (("screenshot_id" IN ( SELECT "screenshots"."id"
   FROM "public"."screenshots"
  WHERE ("screenshots"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."auth_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."credit_balances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_view_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dunning_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."monthly_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_methods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."screenshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."upload_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."usage_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."view_events" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";








GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."check_upload_quota"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_upload_quota"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_upload_quota"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_upload_quota"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_upload_quota"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_upload_quota"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user_data"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_data"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_data"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_view_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_view_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_view_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."invoke_cleanup_edge_function"() TO "anon";
GRANT ALL ON FUNCTION "public"."invoke_cleanup_edge_function"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."invoke_cleanup_edge_function"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_profile_plan"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_profile_plan"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_profile_plan"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_team_filled_seats"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_team_filled_seats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_team_filled_seats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_monthly_usage_on_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_monthly_usage_on_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_monthly_usage_on_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_monthly_usage_on_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_monthly_usage_on_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_monthly_usage_on_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_user_password"("user_email" "text", "user_password" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_user_password"("user_email" "text", "user_password" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_user_password"("user_email" "text", "user_password" "text") TO "service_role";
























GRANT ALL ON TABLE "public"."auth_events" TO "anon";
GRANT ALL ON TABLE "public"."auth_events" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_events" TO "service_role";



GRANT ALL ON TABLE "public"."credit_balances" TO "anon";
GRANT ALL ON TABLE "public"."credit_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_balances" TO "service_role";



GRANT ALL ON TABLE "public"."daily_view_stats" TO "anon";
GRANT ALL ON TABLE "public"."daily_view_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_view_stats" TO "service_role";



GRANT ALL ON TABLE "public"."dunning_attempts" TO "anon";
GRANT ALL ON TABLE "public"."dunning_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."dunning_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."monthly_usage" TO "anon";
GRANT ALL ON TABLE "public"."monthly_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."monthly_usage" TO "service_role";



GRANT ALL ON TABLE "public"."payment_methods" TO "anon";
GRANT ALL ON TABLE "public"."payment_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_methods" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."screenshots" TO "anon";
GRANT ALL ON TABLE "public"."screenshots" TO "authenticated";
GRANT ALL ON TABLE "public"."screenshots" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_customers" TO "anon";
GRANT ALL ON TABLE "public"."stripe_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_customers" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_events" TO "anon";
GRANT ALL ON TABLE "public"."stripe_events" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_events" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_events" TO "anon";
GRANT ALL ON TABLE "public"."subscription_events" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_events" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."upload_sessions" TO "anon";
GRANT ALL ON TABLE "public"."upload_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."upload_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."usage_records" TO "anon";
GRANT ALL ON TABLE "public"."usage_records" TO "authenticated";
GRANT ALL ON TABLE "public"."usage_records" TO "service_role";



GRANT ALL ON TABLE "public"."view_events" TO "anon";
GRANT ALL ON TABLE "public"."view_events" TO "authenticated";
GRANT ALL ON TABLE "public"."view_events" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































RESET ALL;
