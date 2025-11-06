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

## API Versioning

### URL-Based Versioning Strategy

Snappd uses URL-based API versioning with the `/api/v1/*` prefix for all endpoints. This approach provides:

- **Client Compatibility**: External clients (Chrome extension, SPA) can safely consume versioned endpoints
- **Clear Communication**: Version is explicit and visible in URLs
- **Future-Proof**: Breaking changes can be introduced in v2 without disrupting existing clients
- **Next.js Native**: Leverages App Router's file-system routing naturally

### Current API Version: v1

All API endpoints are currently accessible at `/api/v1/*`:

**Authentication** (11 routes):
- `POST /api/v1/auth/signup` - User registration
- `POST /api/v1/auth/signin` - Email/password authentication
- `POST /api/v1/auth/signout` - Session termination
- `GET /api/v1/auth/callback/google` - OAuth callback
- `POST /api/v1/auth/magic-link` - Passwordless authentication
- `GET /api/v1/auth/magic-link/callback` - Magic link verification
- `POST /api/v1/auth/reset-password` - Password reset request
- `POST /api/v1/auth/reset-password/confirm` - Password reset completion
- `GET /api/v1/auth/verify-email` - Email verification
- `POST /api/v1/auth/verify-email/resend` - Resend verification
- `GET /api/v1/auth/user` - Get current user profile
- `DELETE /api/v1/auth/account` - Account deletion

**User & Quotas** (1 route):
- `GET /api/v1/auth/user/usage` - Monthly usage stats

**Upload** (3 routes):
- `POST /api/v1/upload/init` - Initialize upload session
- `GET /api/v1/upload/[uploadSessionId]/progress` - Progress tracking
- `POST /api/v1/upload/[uploadSessionId]/complete` - Complete upload

**Screenshots** (9 routes):
- `GET /api/v1/screenshots` - List user screenshots
- `DELETE /api/v1/screenshots/[shortId]` - Delete screenshot
- `POST /api/v1/screenshots/bulk-delete` - Bulk deletion
- `GET /api/v1/screenshots/[shortId]/access` - Public access (no auth)
- `POST /api/v1/screenshots/[shortId]/verify-password` - Password verification
- `GET /api/v1/screenshots/[shortId]/url` - Get signed URL
- `GET /api/v1/screenshots/[shortId]/analytics` - View tracking data
- `POST /api/v1/screenshots/[shortId]/track-view` - Record view event

**Total**: 24 versioned API routes

### Versioning Policy

- **Major Versions** (v1 → v2): Breaking changes (response structure, authentication method, error codes)
- **Minor Updates** (within v1): Backward-compatible additions (new endpoints, optional fields)
- **Support Window**: 2 concurrent major versions (e.g., v1 and v2)
- **Deprecation Timeline**: 6-month notice before version sunset

### Migration Notes

All routes were migrated from unversioned `/api/*` to `/api/v1/*` structure on 2025-11-05. Since the API was pre-production, no backward compatibility layer was maintained.

## API Error Handling

### Unified Error Response System

Snappd uses a comprehensive, standardized error handling system across all API routes for consistent error responses and better developer experience.

**Location**: [src/lib/api/errors.ts](src/lib/api/errors.ts), [src/lib/api/response.ts](src/lib/api/response.ts)

#### Error Response Format

All API errors follow this standardized structure:

```typescript
{
  error: string,              // Machine-readable error code (enum-based)
  message: string,            // User-friendly error message
  statusCode: number,         // HTTP status code

  // Optional contextual fields:
  details?: unknown,          // Additional context (dev mode only)
  field?: string,             // For validation errors
  retryable?: boolean,        // Can the client retry?
  retryAfter?: number,        // Seconds to wait (for rate limits)
  quota?: QuotaInfo,          // Quota information
  upgrade?: UpgradeInfo,      // Upgrade prompts for quota errors
  bulkResult?: BulkResult     // Bulk operation partial failures
}
```

#### Error Codes

Comprehensive error code enum covering all domains:

**Auth Errors** (from `AuthErrorCode`):
- `UNAUTHORIZED`, `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`
- `ACCOUNT_LOCKED`, `SESSION_EXPIRED`, `VALIDATION_ERROR`
- `INVALID_TOKEN`, `TOKEN_EXPIRED`, `RATE_LIMIT_EXCEEDED`

**Screenshot Errors**:
- `SCREENSHOT_NOT_FOUND`, `SCREENSHOT_EXPIRED`, `SCREENSHOT_ACCESS_DENIED`
- `SCREENSHOT_INVALID_PASSWORD`, `SCREENSHOT_DELETE_FAILED`

**Upload Errors**:
- `UPLOAD_SESSION_NOT_FOUND`, `UPLOAD_SESSION_EXPIRED`, `UPLOAD_FAILED`
- `UPLOAD_FILE_TOO_LARGE`, `UPLOAD_INVALID_FILE_TYPE`, `UPLOAD_DUPLICATE_DETECTED`

**Quota Errors**:
- `QUOTA_EXCEEDED`, `STORAGE_LIMIT_EXCEEDED`, `BANDWIDTH_LIMIT_EXCEEDED`
- `MONTHLY_UPLOAD_LIMIT_EXCEEDED`

**Storage Errors**:
- `STORAGE_ERROR`, `STORAGE_UPLOAD_FAILED`, `STORAGE_DELETE_FAILED`

**Database Errors**:
- `DATABASE_ERROR`, `DATABASE_CONNECTION_ERROR`, `DATABASE_QUERY_ERROR`

**Generic Errors**:
- `INTERNAL_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `BAD_REQUEST`

#### Usage Examples

```typescript
import { ApiErrorHandler, ApiErrorCode } from '@/lib/api/errors'
import { ApiResponse } from '@/lib/api/response'

// Return standardized errors:
return ApiErrorHandler.unauthorized(
  ApiErrorCode.UNAUTHORIZED,
  'Authentication required'
)

return ApiErrorHandler.notFound(
  ApiErrorCode.SCREENSHOT_NOT_FOUND,
  'Screenshot not found'
)

return ApiErrorHandler.quotaExceeded(
  ApiErrorCode.MONTHLY_UPLOAD_LIMIT_EXCEEDED,
  'Monthly upload quota exceeded',
  { current: 100, limit: 100, unit: 'uploads' },
  { message: 'Upgrade to Pro', plan: 'pro', url: '/pricing' }
)

// Return standardized success responses:
return ApiResponse.success({ userId: '123' }, 'User created')
return ApiResponse.created({ id: 'abc' }, 'Screenshot uploaded')
return ApiResponse.paginated(items, { page: 1, pageSize: 20, total: 50 })
```

#### HTTP Status Codes

Consistent status code mappings:
- **200**: Success
- **201**: Resource created
- **204**: No content (successful deletion)
- **207**: Multi-Status (bulk operations with partial failures)
- **400**: Bad request / validation error
- **401**: Unauthorized / not authenticated
- **403**: Forbidden / permission denied / quota exceeded
- **404**: Not found
- **410**: Gone (expired resource)
- **413**: Payload too large
- **422**: Unprocessable entity
- **429**: Rate limit exceeded
- **500**: Internal server error

#### Special Behaviors

**Bulk Operations (207 Multi-Status)**:
- Routes like `/api/v1/screenshots/bulk-delete` return 207 for partial failures
- Includes detailed `bulkResult` with success/failure breakdown
- Complete success returns 200 with standard success response

**Analytics Rate Limiting (200 on rate limit)**:
- `/api/v1/screenshots/[shortId]/track-view` returns 200 even when rate limited
- Preserves user experience while preventing analytics spam
- Fails silently for analytics errors

**Rate Limit Metadata**:
- Custom `X-RateLimit-*` headers for rate limit info
- `retryAfter` field in response body (seconds)
- Password verification includes attempt limits

#### Migration Status

✅ **Migrated Routes**:
- All `/api/v1/screenshots/*` routes (9 routes)
- All `/api/v1/upload/*` routes (3 routes)
- All `/api/v1/auth/*` routes (11 routes)
- All `/api/v1/auth/user/usage` route (1 route)

✅ **Features**:
- Standardized error codes and messages
- Quota errors with upgrade prompts
- Bulk operation partial failure handling (207 Multi-Status)
- Rate limit metadata with retry information
- Environment-aware error details (dev mode only)

## Request ID Tracking & Centralized Logging

### Overview

Snappd implements comprehensive request ID tracking and centralized logging for better debugging, monitoring, and production observability.

**Location**: [src/lib/logger.ts](src/lib/logger.ts), [src/middleware.ts](src/middleware.ts)

### Request ID System

#### How It Works

1. **Generation**: Middleware generates unique UUID for each request (`req-{uuid}`)
2. **Reuse**: Existing `x-request-id` from load balancers/proxies is preserved
3. **Propagation**: Request ID is injected into:
   - Request headers (available to all route handlers)
   - Response headers (for client-side correlation)
   - All log entries automatically

#### Request ID Format

```
req-550e8400-e29b-41d4-a716-446655440000
```

### Centralized Logger

The `logger` utility provides structured logging with automatic request ID extraction.

#### Basic Usage

```typescript
import { logger } from '@/lib/logger';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  // Info logging
  logger.info('Processing screenshot request', request, {
    shortId: params.shortId
  });

  try {
    // ... route logic
  } catch (error) {
    // Error logging
    logger.error('Failed to process screenshot', request, {
      error,
      shortId: params.shortId
    });
  }
}
```

#### Log Levels

```typescript
logger.debug('Verbose development info', request, metadata);  // DEV only
logger.info('General information', request, metadata);        // Always logged
logger.warn('Non-critical issues', request, metadata);         // Always logged
logger.error('Critical errors', request, metadata);            // Always logged
```

#### Log Output Formats

**Development** (Human-Readable):
```
[req-abc123] [INFO] [GET /api/screenshots/xyz] Processing screenshot request
{
  "shortId": "xyz",
  "userId": "123"
}
```

**Production** (JSON for Log Aggregation):
```json
{
  "timestamp": "2025-11-05T10:30:45.123Z",
  "level": "INFO",
  "requestId": "req-abc123",
  "message": "Processing screenshot request",
  "route": "/api/screenshots/xyz",
  "method": "GET",
  "metadata": {
    "shortId": "xyz",
    "userId": "123"
  }
}
```

### Integration with Error Handling

The unified error handling system automatically includes request IDs in all error logs.

#### Updated Error Handler Usage

```typescript
import { ApiErrorHandler, ApiErrorCode } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  try {
    // ... route logic
  } catch (error) {
    // Automatically logs with request ID
    return ApiErrorHandler.handle(error, {
      request,  // Pass request for automatic request ID extraction
      logContext: {
        route: 'POST /api/upload/init',
        userId: user?.id
      }
    });
  }
}
```

#### Error Creator Methods (with Request ID)

All error creator methods now accept an optional `request` parameter:

```typescript
// 400 Bad Request
return ApiErrorHandler.badRequest(
  ApiErrorCode.VALIDATION_ERROR,
  'Missing required fields',
  details,
  request  // Auto-logs with request ID
);

// 401 Unauthorized
return ApiErrorHandler.unauthorized(
  ApiErrorCode.UNAUTHORIZED,
  'Authentication required',
  undefined,
  request
);

// 404 Not Found
return ApiErrorHandler.notFound(
  ApiErrorCode.SCREENSHOT_NOT_FOUND,
  'Screenshot not found',
  undefined,
  request
);

// 403 Quota Exceeded (with upgrade prompt)
return ApiErrorHandler.quotaExceeded(
  ApiErrorCode.MONTHLY_UPLOAD_LIMIT_EXCEEDED,
  'Monthly upload quota exceeded',
  { current: 100, limit: 100, unit: 'uploads' },
  { message: 'Upgrade to Pro', plan: 'pro', url: '/pricing' },
  request
);
```

### Performance Timing

Measure operation duration with built-in timing utilities:

```typescript
const timer = logger.startTimer();

await someExpensiveOperation();

const duration = timer.end();
logger.info('Operation completed', request, { durationMs: duration });
```

Or use automatic timing wrapper:

```typescript
const result = await logger.withTiming(
  async () => {
    return await fetchScreenshot(id);
  },
  'Fetched screenshot from database',
  request,
  { screenshotId: id }
);
// Automatically logs with duration
```

### Migration Pattern

When updating existing routes, follow this pattern:

**Before:**
```typescript
export async function POST(request: NextRequest) {
  try {
    // ... logic
  } catch (error) {
    console.error('Error in route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**After:**
```typescript
import { logger } from '@/lib/logger';
import { ApiErrorHandler } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  try {
    logger.info('Route started', request);
    // ... logic
    logger.info('Route completed successfully', request, { userId });
  } catch (error) {
    return ApiErrorHandler.handle(error, {
      request,
      logContext: { route: 'POST /api/route' }
    });
  }
}
```

### Benefits

1. **Debugging**: Trace requests across multi-step workflows (upload → storage → database)
2. **Correlation**: Link related logs from a single user action
3. **Monitoring**: Track performance, errors, and bottlenecks per request
4. **Security Audit**: Correlate auth events with specific user sessions
5. **Production Ready**: JSON logs compatible with Datadog, Sentry, CloudWatch, etc.

### Migration Status

✅ **Core Infrastructure**:
- Middleware request ID generation
- Centralized logger utility
- Error handler integration

✅ **Example Routes**:
- `/api/v1/upload/init` - Fully migrated with request correlation

🔄 **Remaining Routes** (follow the same pattern):
- Other upload routes (`/api/v1/upload/[id]/complete`, `/api/v1/upload/[id]/progress`)
- Screenshot routes (`/api/v1/screenshots/*`)
- Auth routes (`/api/v1/auth/*`)

### Best Practices

1. **Always pass request**: Include `request` parameter in logger and error handler calls
2. **Use appropriate log levels**: `debug` for verbose, `info` for important events, `warn` for issues, `error` for failures
3. **Include context**: Add metadata like `userId`, `screenshotId`, etc. for better debugging
4. **Log at boundaries**: Log at entry/exit points and before/after external calls (database, storage)
5. **Avoid sensitive data**: Never log passwords, tokens, or PII in production

## Recent Changes
- 005-auth-system: Added TypeScript 5.x with Next.js 15.5.5 (App Router), React 19.1.0
- Email integration: Added SendGrid email service with SMTP configuration and SDK utilities
- API error handling: Implemented unified error response system with standardized codes, quota handling, and bulk operation support
- Request ID tracking: Implemented request ID generation in middleware and centralized logging system with automatic request correlation
- API versioning: Migrated all 24 API routes to `/api/v1/*` structure with URL-based versioning (2025-11-05)
