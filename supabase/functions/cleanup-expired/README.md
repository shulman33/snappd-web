# Cleanup Expired Screenshots - Edge Function

## Overview

This Edge Function automatically cleans up expired screenshots from both the database and Supabase Storage. It is designed to be invoked by a `pg_cron` scheduled job that runs daily at 2:00 AM UTC.

## Features

- Queries database for screenshots with `expires_at < now()`
- Deletes storage files from the `screenshots` bucket
- Deletes database records (triggers automatically update `monthly_usage`)
- Returns detailed results including count of deleted items and any errors
- Requires service role authorization for security

## Setup Requirements

### 1. Database Migration

The migration `20251105000001_setup_cleanup_job.sql` has already been applied, which:
- Enables `pg_cron` and `pg_net` extensions
- Creates the `invoke_cleanup_edge_function()` SQL function
- Schedules a daily cron job at 2:00 AM UTC
- Stores `project_url` in Supabase Vault

### 2. Add Service Role Key to Vault

**IMPORTANT**: You must manually add the service role key to the vault for the cron job to work:

```sql
-- Run this in the Supabase SQL Editor
SELECT vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'service_role_key');
```

To get your service role key:
1. Go to Supabase Dashboard → Project Settings → API
2. Copy the `service_role` key (keep this secret!)
3. Run the SQL command above, replacing `YOUR_SERVICE_ROLE_KEY` with the actual key

### 3. Edge Function Deployment

The Edge Function has been deployed and is active at:
- Function ID: `39f07de5-188b-48e9-9cf0-d91bc7705f7c`
- Name: `cleanup-expired`
- Status: `ACTIVE`
- URL: `https://iitxfjhnywekstxagump.supabase.co/functions/v1/cleanup-expired`

## How It Works

### Scheduled Execution (Automatic)

1. **Daily at 2:00 AM UTC**, `pg_cron` executes: `SELECT invoke_cleanup_edge_function();`
2. The SQL function retrieves credentials from Vault (`project_url`, `service_role_key`)
3. Uses `pg_net.http_post()` to invoke this Edge Function
4. Edge Function queries for expired screenshots
5. Deletes storage files first
6. Deletes database records (triggers update `monthly_usage`)
7. Returns cleanup results

### Manual Invocation

You can manually trigger cleanup using:

```bash
# Using curl with service role key
curl -X POST \
  https://iitxfjhnywekstxagump.supabase.co/functions/v1/cleanup-expired \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"timestamp": "2025-11-05T12:00:00Z"}'
```

Or via SQL:

```sql
-- Invoke immediately (doesn't wait for 2:00 AM)
SELECT invoke_cleanup_edge_function();
```

## Response Format

Success response (200):

```json
{
  "success": true,
  "deletedCount": 5,
  "deletedFiles": 5,
  "errors": [],
  "timestamp": "2025-11-05T02:00:00.000Z"
}
```

With partial errors:

```json
{
  "success": true,
  "deletedCount": 5,
  "deletedFiles": 4,
  "errors": [
    "Storage deletion failed for abc123: File not found"
  ],
  "timestamp": "2025-11-05T02:00:00.000Z"
}
```

Error response (401, 500):

```json
{
  "success": false,
  "error": "Missing or invalid authorization",
  "timestamp": "2025-11-05T02:00:00.000Z"
}
```

## Monitoring

### Check Cron Job Status

```sql
-- View scheduled jobs
SELECT * FROM cron.job WHERE jobname = 'invoke-cleanup-edge-function';

-- View job run history
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'invoke-cleanup-edge-function')
ORDER BY start_time DESC
LIMIT 10;
```

### Check HTTP Requests

```sql
-- View recent HTTP requests made by pg_net
SELECT * FROM net._http_response
ORDER BY created DESC
LIMIT 10;
```

### View Edge Function Logs

1. Go to Supabase Dashboard → Edge Functions → cleanup-expired
2. Click "Logs" to see execution history and output
3. Look for the `x-deno-execution-id` header to trace specific invocations

## Testing

### Create Test Data

```sql
-- Insert an already-expired screenshot for testing
INSERT INTO screenshots (
  user_id,
  short_id,
  storage_path,
  original_filename,
  file_size,
  width,
  height,
  expires_at
)
SELECT
  id,
  'test_expired',
  'test/expired.png',
  'expired.png',
  1024,
  800,
  600,
  now() - interval '1 hour'
FROM profiles
LIMIT 1;
```

### Trigger Manual Cleanup

```sql
-- Manually invoke the cleanup function
SELECT invoke_cleanup_edge_function();

-- Check if the expired screenshot was deleted
SELECT * FROM screenshots WHERE short_id = 'test_expired';
-- Should return no rows
```

## Troubleshooting

### Cleanup Job Not Running

1. **Check if cron job is active:**
   ```sql
   SELECT active FROM cron.job WHERE jobname = 'invoke-cleanup-edge-function';
   ```

2. **Check if secrets are configured:**
   ```sql
   SELECT name FROM vault.decrypted_secrets;
   -- Should include: 'project_url' and 'service_role_key'
   ```

3. **Check recent job runs:**
   ```sql
   SELECT * FROM cron.job_run_details
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'invoke-cleanup-edge-function')
   ORDER BY start_time DESC
   LIMIT 5;
   ```

### Edge Function Errors

1. Check the Edge Function logs in the Supabase Dashboard
2. Verify the service role key is correct
3. Check if the `screenshots` storage bucket exists and is accessible

### Storage Files Not Deleted

- The Edge Function only deletes files that exist in storage
- If a file is missing, it logs an error but continues with other deletions
- Check the response `errors` array for details

## Security Considerations

- **Service Role Key**: Only store in Vault, never commit to code
- **Authentication**: Edge Function requires Bearer token (service role or anon key)
- **Authorization**: Only service role key should be used for cleanup operations
- **Rate Limiting**: No rate limiting on Edge Function (scheduled once daily)
- **Audit Trail**: All operations logged via Edge Function logs and pg_net

## Performance

- **Batch Size**: Processes all expired screenshots in one invocation
- **Timeout**: 30 seconds for HTTP request (configurable in migration)
- **Concurrency**: Edge Function processes screenshots sequentially
- **Database Load**: Minimal - single query + single batch delete
- **Storage Load**: One API call per file

## Future Improvements

- Add metrics/monitoring integration (e.g., DataDog, Sentry)
- Implement batch deletion for storage files (currently one-by-one)
- Add dry-run mode for testing
- Email notifications for cleanup failures
- Configurable schedule (currently hardcoded to 2:00 AM UTC)
