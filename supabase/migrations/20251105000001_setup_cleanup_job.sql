-- Migration: Setup cleanup job for expired screenshots
-- This migration installs pg_cron and pg_net, then creates a scheduled job to invoke
-- the cleanup-expired Edge Function which handles both database and storage cleanup

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Store project URL in Vault for secure access
-- Note: service_role_key should be added manually via SQL Editor for security
DO $$
BEGIN
  -- Only create project_url secret if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'project_url') THEN
    PERFORM vault.create_secret('https://iitxfjhnywekstxagump.supabase.co', 'project_url');
  END IF;

  -- Check if service_role_key exists, warn if not
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'service_role_key') THEN
    RAISE NOTICE 'IMPORTANT: Run this command to add service_role_key to vault:';
    RAISE NOTICE 'SELECT vault.create_secret(''YOUR_SERVICE_ROLE_KEY'', ''service_role_key'');';
  END IF;
END $$;

-- Create a SQL function that invokes the Edge Function via HTTP POST
-- This function is called by pg_cron
CREATE OR REPLACE FUNCTION invoke_cleanup_edge_function()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
  SELECT net.http_post(
    url := project_url || '/functions/v1/cleanup-expired',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'timestamp', now()::text
    ),
    timeout_milliseconds := 30000 -- 30 second timeout for cleanup operation
  ) INTO request_id;

  RAISE NOTICE 'Cleanup Edge Function invoked with request_id: %', request_id;
END;
$$;

-- Add comment to explain the function
COMMENT ON FUNCTION invoke_cleanup_edge_function() IS
'Invokes the cleanup-expired Edge Function via HTTP POST to handle expired screenshot cleanup including storage files.';

-- Schedule the cleanup job to run daily at 2:00 AM UTC
-- This ensures low-traffic time for database and storage operations
SELECT cron.schedule(
  'invoke-cleanup-edge-function',
  '0 2 * * *', -- Every day at 2:00 AM UTC
  'SELECT invoke_cleanup_edge_function();'
);

-- Add comments explaining the setup
COMMENT ON EXTENSION pg_cron IS
'Cron-based job scheduler for PostgreSQL. Used to schedule daily cleanup of expired screenshots via Edge Function.';

COMMENT ON EXTENSION pg_net IS
'Async HTTP client for PostgreSQL. Used by pg_cron to invoke cleanup Edge Function.';
