# Snappd Web - Project Documentation

## Supabase Backend Setup

### Project Information
- **Project Name**: shulman33's Project
- **Project ID**: `iitxfjhnywekstxagump`
- **Region**: us-east-1
- **Status**: ACTIVE_HEALTHY
- **Database Version**: PostgreSQL 17.6.1.021
- **API URL**: https://iitxfjhnywekstxagump.supabase.co
- **Created**: 2025-10-15

### Database Schema

#### Tables

**profiles** (634 rows, RLS enabled)
- `id` (uuid, PK) - Foreign key to auth.users
- `email` (text)
- `full_name` (text, nullable)
- `plan` (text) - Options: 'free', 'pro', 'team' (default: 'free')
- `stripe_customer_id` (text, unique, nullable)
- `stripe_subscription_id` (text, unique, nullable)
- `downgraded_at` (timestamptz, nullable)
- `created_at` (timestamptz, default: now())
- `updated_at` (timestamptz, default: now())

**screenshots** (1 row, RLS enabled)
- `id` (uuid, PK, default: gen_random_uuid())
- `user_id` (uuid, FK -> profiles.id)
- `short_id` (text, unique)
- `storage_path` (text)
- `original_filename` (text)
- `file_size` (bigint)
- `width` (integer)
- `height` (integer)
- `mime_type` (text, default: 'image/png')
- `expires_at` (timestamptz, nullable)
- `views` (integer, default: 0)
- `is_public` (boolean, default: true)
- `created_at` (timestamptz, default: now())
- `updated_at` (timestamptz, default: now())

**monthly_usage** (0 rows, RLS enabled)
- `id` (uuid, PK, default: gen_random_uuid())
- `user_id` (uuid, FK -> profiles.id)
- `month` (text)
- `screenshot_count` (integer, default: 0)
- `storage_bytes` (bigint, default: 0)
- `bandwidth_bytes` (bigint, default: 0)
- `created_at` (timestamptz, default: now())

**stripe_events** (0 rows, RLS disabled)
- `id` (text, PK) - Stripe event ID for idempotency
- `processed_at` (timestamptz, default: now())
- Note: RLS disabled by design - system table for webhook idempotency tracking only

### Storage Buckets

**screenshots**
- Public: Yes
- File size limit: 10 MB (10485760 bytes)
- Allowed MIME types: image/png, image/jpeg, image/jpg, image/webp, image/gif

### Installed Extensions

- `pg_graphql` (1.5.11) - GraphQL support
- `supabase_vault` (0.3.1) - Vault extension for secrets
- `pgcrypto` (1.3) - Cryptographic functions
- `pg_stat_statements` (1.11) - SQL statistics tracking
- `uuid-ossp` (1.1) - UUID generation
- `plpgsql` (1.0) - Procedural language

### Migrations

1. `20251020205404_initial_schema` - Initial database schema
2. `20251020225252_add_profiles_insert_policy` - Added RLS policy for profiles
3. `disable_rls_on_stripe_events` - Disabled RLS on stripe_events (idempotency table)

### Edge Functions

No edge functions currently deployed.

### Security Advisories

**Active Warnings:**
1. **Function Search Path Mutable**: `public.handle_new_user` function has mutable search_path
   - Recommendation: Set search_path parameter on function
   - [Learn more](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)

2. **Auth - Leaked Password Protection**: Currently disabled
   - Recommendation: Enable HaveIBeenPwned.org integration for enhanced security
   - [Learn more](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

**Expected Warnings (Acceptable):**
1. **RLS Disabled in Public**: `stripe_events` table has RLS disabled
   - This is intentional - table is for webhook idempotency tracking only
   - Only accessed via service role, contains no user data
   - [Learn more](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public)

### Performance Advisories

**Unused Indexes:**
1. `idx_screenshots_expires` on screenshots table - Never used
2. `idx_profiles_stripe_customer` on profiles table - Never used
   - Consider removing if truly unused to improve write performance

## Architecture Notes

This is a screenshot sharing application with:
- User management with tiered pricing (free/pro/team)
- Stripe integration for payments
- Screenshot upload and storage with metadata tracking
- Usage tracking per user/month
- Public/private screenshot sharing with view counts

## Active Technologies
- TypeScript 5.x with Next.js 15.5.5 (App Router), React 19.1.0 (005-auth-system)
- PostgreSQL via Supabase (existing instance: iitxfjhnywekstxagump) (005-auth-system)

## Recent Changes
- 005-auth-system: Added TypeScript 5.x with Next.js 15.5.5 (App Router), React 19.1.0
