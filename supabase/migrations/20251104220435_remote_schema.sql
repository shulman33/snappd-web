


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


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."check_upload_quota"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."check_upload_quota"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_upload_quota"() IS 'Enforces monthly quota limits for free users with row-level locking';



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
    AS $$
BEGIN
  -- Increment view counter atomically
  UPDATE screenshots
  SET views = views + 1
  WHERE id = NEW.screenshot_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_view_count"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_view_count"() IS 'Atomically increments screenshot view count';



CREATE OR REPLACE FUNCTION "public"."update_monthly_usage_on_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."update_monthly_usage_on_delete"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_monthly_usage_on_delete"() IS 'Automatically updates monthly_usage when screenshots are deleted';



CREATE OR REPLACE FUNCTION "public"."update_monthly_usage_on_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."update_monthly_usage_on_insert"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_monthly_usage_on_insert"() IS 'Automatically updates monthly_usage when screenshots are inserted';



CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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



CREATE TABLE IF NOT EXISTS "public"."stripe_events" (
    "id" "text" NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stripe_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."stripe_events" IS 'Idempotency tracking for Stripe webhooks. Only accessed via service role. RLS disabled as no user data is stored and table is only used for internal infrastructure.';



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



ALTER TABLE ONLY "public"."daily_view_stats"
    ADD CONSTRAINT "daily_view_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_view_stats"
    ADD CONSTRAINT "daily_view_stats_screenshot_id_date_key" UNIQUE ("screenshot_id", "date");



ALTER TABLE ONLY "public"."monthly_usage"
    ADD CONSTRAINT "monthly_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monthly_usage"
    ADD CONSTRAINT "monthly_usage_user_id_month_key" UNIQUE ("user_id", "month");



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



ALTER TABLE ONLY "public"."stripe_events"
    ADD CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."upload_sessions"
    ADD CONSTRAINT "upload_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."view_events"
    ADD CONSTRAINT "view_events_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_auth_events_created" ON "public"."auth_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_auth_events_email" ON "public"."auth_events" USING "btree" ("email") WHERE ("email" IS NOT NULL);



CREATE INDEX "idx_auth_events_ip" ON "public"."auth_events" USING "btree" ("ip_address");



CREATE INDEX "idx_auth_events_rate_limit" ON "public"."auth_events" USING "btree" ("event_type", "email", "created_at") WHERE ("event_type" = ANY (ARRAY['login_failure'::"text", 'password_reset'::"text", 'magic_link'::"text", 'verification_resend'::"text"]));



CREATE INDEX "idx_auth_events_type" ON "public"."auth_events" USING "btree" ("event_type");



CREATE INDEX "idx_auth_events_user" ON "public"."auth_events" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_daily_stats_screenshot" ON "public"."daily_view_stats" USING "btree" ("screenshot_id", "date" DESC);



CREATE INDEX "idx_monthly_usage_user_month" ON "public"."monthly_usage" USING "btree" ("user_id", "month");



CREATE INDEX "idx_profiles_stripe_customer" ON "public"."profiles" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_screenshots_expires" ON "public"."screenshots" USING "btree" ("expires_at") WHERE ("expires_at" IS NOT NULL);



CREATE INDEX "idx_screenshots_file_hash" ON "public"."screenshots" USING "btree" ("user_id", "file_hash");



CREATE INDEX "idx_screenshots_short_id" ON "public"."screenshots" USING "btree" ("short_id");



CREATE INDEX "idx_screenshots_user_created" ON "public"."screenshots" USING "btree" ("user_id", "created_at" DESC);



COMMENT ON INDEX "public"."idx_screenshots_user_created" IS 'Composite index for efficient user screenshot queries ordered by creation date. Replaces duplicate idx_screenshots_created_at.';



CREATE INDEX "idx_upload_sessions_screenshot" ON "public"."upload_sessions" USING "btree" ("screenshot_id") WHERE ("screenshot_id" IS NOT NULL);



COMMENT ON INDEX "public"."idx_upload_sessions_screenshot" IS 'Performance optimization: Index foreign key for efficient JOINs between upload_sessions and screenshots';



CREATE INDEX "idx_upload_sessions_status" ON "public"."upload_sessions" USING "btree" ("upload_status") WHERE ("upload_status" = ANY (ARRAY['pending'::"text", 'uploading'::"text"]));



CREATE INDEX "idx_upload_sessions_user" ON "public"."upload_sessions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_view_events_date" ON "public"."view_events" USING "btree" ("viewed_at" DESC);



CREATE INDEX "idx_view_events_screenshot" ON "public"."view_events" USING "btree" ("screenshot_id", "viewed_at" DESC);



CREATE OR REPLACE TRIGGER "trigger_check_quota" BEFORE INSERT ON "public"."screenshots" FOR EACH ROW EXECUTE FUNCTION "public"."check_upload_quota"();



CREATE OR REPLACE TRIGGER "trigger_increment_views" AFTER INSERT ON "public"."view_events" FOR EACH ROW EXECUTE FUNCTION "public"."increment_view_count"();



CREATE OR REPLACE TRIGGER "trigger_update_screenshots_timestamp" BEFORE UPDATE ON "public"."screenshots" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_upload_sessions_timestamp" BEFORE UPDATE ON "public"."upload_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_usage_on_delete" AFTER DELETE ON "public"."screenshots" FOR EACH ROW EXECUTE FUNCTION "public"."update_monthly_usage_on_delete"();



CREATE OR REPLACE TRIGGER "trigger_update_usage_on_insert" AFTER INSERT ON "public"."screenshots" FOR EACH ROW EXECUTE FUNCTION "public"."update_monthly_usage_on_insert"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_screenshots_updated_at" BEFORE UPDATE ON "public"."screenshots" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."auth_events"
    ADD CONSTRAINT "auth_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_view_stats"
    ADD CONSTRAINT "daily_view_stats_screenshot_id_fkey" FOREIGN KEY ("screenshot_id") REFERENCES "public"."screenshots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "fk_profiles_auth_users" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."monthly_usage"
    ADD CONSTRAINT "monthly_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."screenshots"
    ADD CONSTRAINT "screenshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."upload_sessions"
    ADD CONSTRAINT "upload_sessions_screenshot_id_fkey" FOREIGN KEY ("screenshot_id") REFERENCES "public"."screenshots"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."upload_sessions"
    ADD CONSTRAINT "upload_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."view_events"
    ADD CONSTRAINT "view_events_screenshot_id_fkey" FOREIGN KEY ("screenshot_id") REFERENCES "public"."screenshots"("id") ON DELETE CASCADE;



CREATE POLICY "Screenshots viewable" ON "public"."screenshots" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR (("is_public" = true) AND ("sharing_mode" = 'public'::"text") AND (("expires_at" IS NULL) OR ("expires_at" > "now"())))));



COMMENT ON POLICY "Screenshots viewable" ON "public"."screenshots" IS 'Consolidated policy: Users can view their own screenshots OR anyone can view public non-expired screenshots. Replaces "Public screenshots viewable" and "Users can view own screenshots" for better performance.';



CREATE POLICY "Service can insert profiles" ON "public"."profiles" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service role insert views" ON "public"."view_events" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service role only" ON "public"."auth_events" USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));



CREATE POLICY "System can insert usage records" ON "public"."monthly_usage" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can update usage records" ON "public"."monthly_usage" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Users can delete own screenshots" ON "public"."screenshots" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert own screenshots" ON "public"."screenshots" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can update own screenshots" ON "public"."screenshots" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can view own usage" ON "public"."monthly_usage" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users manage own upload sessions" ON "public"."upload_sessions" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users view own screenshot analytics" ON "public"."view_events" FOR SELECT USING (("screenshot_id" IN ( SELECT "screenshots"."id"
   FROM "public"."screenshots"
  WHERE ("screenshots"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Users view own screenshot stats" ON "public"."daily_view_stats" FOR SELECT USING (("screenshot_id" IN ( SELECT "screenshots"."id"
   FROM "public"."screenshots"
  WHERE ("screenshots"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."auth_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_view_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."monthly_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."screenshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."upload_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."view_events" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."check_upload_quota"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_upload_quota"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_upload_quota"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user_data"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_data"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_data"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_view_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_view_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_view_count"() TO "service_role";



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



GRANT ALL ON TABLE "public"."daily_view_stats" TO "anon";
GRANT ALL ON TABLE "public"."daily_view_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_view_stats" TO "service_role";



GRANT ALL ON TABLE "public"."monthly_usage" TO "anon";
GRANT ALL ON TABLE "public"."monthly_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."monthly_usage" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."screenshots" TO "anon";
GRANT ALL ON TABLE "public"."screenshots" TO "authenticated";
GRANT ALL ON TABLE "public"."screenshots" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_events" TO "anon";
GRANT ALL ON TABLE "public"."stripe_events" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_events" TO "service_role";



GRANT ALL ON TABLE "public"."upload_sessions" TO "anon";
GRANT ALL ON TABLE "public"."upload_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."upload_sessions" TO "service_role";



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
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();


  create policy "Authenticated users can upload screenshots"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'screenshots'::text));



  create policy "Public read access for screenshots"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'screenshots'::text));



  create policy "Users can delete their own screenshots"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'screenshots'::text) AND (owner = auth.uid())));



  create policy "Users can update their own screenshots"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'screenshots'::text) AND (owner = auth.uid())));



