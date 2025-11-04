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

## Email Service Configuration

### SendGrid Integration

**Provider**: SendGrid via SMTP and SDK
**Location**: `src/lib/email/sendgrid.ts`
**Package**: `@sendgrid/mail` (installed)

#### Configuration

Snappd uses SendGrid for all transactional email delivery:

1. **Supabase Auth Emails** (via SMTP):
   - Email verification (signup)
   - Password reset
   - Magic link authentication
   - Configured in Supabase Dashboard → Project Settings → Authentication → SMTP Settings
   - SMTP Host: `smtp.sendgrid.net:587`
   - Username: `apikey`
   - Password: `SENDGRID_API_KEY`

2. **Custom Application Emails** (via SDK):
   - Welcome emails
   - Screenshot sharing notifications
   - Custom transactional emails
   - Sent via `SendGridEmailService` utility class

#### Environment Variables

Required environment variables (see [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md)):
- `SENDGRID_API_KEY` - SendGrid API key (starts with `SG.`)
- `SENDGRID_FROM_EMAIL` - Verified sender email address
- `SENDGRID_FROM_NAME` - Sender name (default: "Snappd")

#### Email Service API

The `SendGridEmailService` class provides methods for:

```typescript
// Send generic email
SendGridEmailService.send(options)

// Send with retry logic
SendGridEmailService.sendWithRetry(options, maxAttempts, delays)

// Transactional email helpers
SendGridEmailService.sendEmailVerification(to, data, templateId?)
SendGridEmailService.sendPasswordReset(to, data, templateId?)
SendGridEmailService.sendMagicLink(to, data, templateId?)
SendGridEmailService.sendWelcomeEmail(to, data, templateId?)
SendGridEmailService.sendScreenshotShared(to, data, templateId?)
```

#### Email Templates

**Current**: Inline HTML templates (default)
**Optional**: SendGrid Dynamic Templates (configure template IDs)

To use SendGrid Dynamic Templates:
1. Create templates in SendGrid Dashboard → Email API → Dynamic Templates
2. Pass template ID to email service methods
3. Provide `dynamicTemplateData` with template variables

#### Features

- ✅ Retry logic with exponential backoff (3 attempts: 0ms, 2min, 5min)
- ✅ Error handling and logging
- ✅ Rate limiting (inherited from existing auth routes)
- ✅ Email categorization for analytics
- ✅ Custom template variables
- ✅ Responsive HTML email templates
- ✅ Plain text fallback

#### Testing

Test email delivery:
1. Configure SendGrid SMTP in Supabase Dashboard
2. Trigger email via auth flow (signup, password reset, etc.)
3. Verify delivery in SendGrid Dashboard → Activity
4. Check email inbox for proper rendering

## Architecture Notes

This is a screenshot sharing application with:
- User management with tiered pricing (free/pro/team)
- Stripe integration for payments
- Screenshot upload and storage with metadata tracking
- Usage tracking per user/month
- Public/private screenshot sharing with view counts
- SendGrid email service for transactional emails

## Active Technologies
- TypeScript 5.x with Next.js 15.5.5 (App Router), React 19.1.0 (005-auth-system)
- PostgreSQL via Supabase (existing instance: iitxfjhnywekstxagump) (005-auth-system)
- SendGrid for email delivery (@sendgrid/mail)

## Recent Changes
- 005-auth-system: Added TypeScript 5.x with Next.js 15.5.5 (App Router), React 19.1.0
- Email integration: Added SendGrid email service with SMTP configuration and SDK utilities
