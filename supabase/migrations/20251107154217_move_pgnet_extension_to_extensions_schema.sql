-- Move pg_net extension from public schema to extensions schema
-- (Security Advisory: 0014_extension_in_public)
-- Extensions should not reside in the public schema for security reasons

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Drop pg_net from public schema
DROP EXTENSION IF EXISTS pg_net CASCADE;

-- Reinstall pg_net in extensions schema
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions VERSION '0.19.5';

-- Grant usage on extensions schema to necessary roles
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA extensions TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Update invoke_cleanup_edge_function to use the new schema-qualified reference
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
$function$;
