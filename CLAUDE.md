# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

snappd is a lightning-fast screenshot sharing platform built with Next.js 15 App Router, Supabase, and Stripe. The codebase follows an API-first architecture with RESTful endpoints, implementing a freemium model (10 free screenshots/month, unlimited for pro users).

**Current Status**: MVP Complete - API backend fully implemented with 15 endpoints, comprehensive test coverage, and production-ready infrastructure.

## Development Commands

### Setup
```bash
npm install                    # Install dependencies
cp .env.example .env.local    # Copy environment variables
# Edit .env.local with Supabase and Stripe credentials
```

### Development
```bash
npm run dev                    # Start Next.js dev server (http://localhost:3000)
npm run build                  # Production build
npm start                      # Start production server
npm run lint                   # Run ESLint
```

### Testing
```bash
# Unit tests (Vitest)
npm test                       # Run unit tests in watch mode
npm run test:unit              # Alias for npm test
npm run test:coverage          # Generate coverage report

# Contract tests (Playwright - API endpoint tests)
npm run test:contract          # Run API contract tests (requires dev server)

# Integration tests (Playwright - end-to-end workflows)
npm run test:integration       # Run integration tests

# Run all test suites
npm run test:all               # Unit + Contract + Integration
```

**Testing Notes**:
- Contract tests require the dev server to be running (`npm run dev`)
- Tests run sequentially (workers: 1) to avoid Supabase rate limits
- All API routes follow TDD - tests were written before implementation
- Test files are organized by type: `tests/unit/`, `tests/contract/`, `tests/integration/`

## Architecture

### API-First Design Pattern

All API routes follow this standardized structure:

```typescript
// src/app/api/[feature]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createUserClient, getUserIdFromToken } from '@/lib/supabase';
import { validateRequest, [schema]Schema } from '@/lib/validation';
import { handleApiError, UnauthorizedError } from '@/lib/errors';

export async function GET/POST/PATCH/DELETE(request: NextRequest) {
  try {
    // 1. Extract and validate auth token
    const authHeader = request.headers.get('authorization');
    const accessToken = authHeader?.replace('Bearer ', '');
    if (!accessToken) throw new UnauthorizedError();

    const userId = await getUserIdFromToken(accessToken);
    if (!userId) throw new UnauthorizedError();

    // 2. Parse and validate request (body or query params)
    const data = await request.json(); // or searchParams
    const validated = validateRequest([schema]Schema, data);

    // 3. Create user-context Supabase client (respects RLS)
    const supabase = createUserClient(accessToken);

    // 4. Execute business logic with database queries
    const { data, error } = await supabase.from('table').select();

    // 5. Return standardized response
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
```

**Key Patterns**:
- **Authentication**: Always use `getUserIdFromToken()` to validate JWT tokens
- **RLS Enforcement**: Use `createUserClient(token)` for user operations, `supabaseAdmin` only for admin tasks (webhooks, usage tracking)
- **Validation**: All inputs validated with Zod schemas in `@/lib/validation`
- **Error Handling**: Throw custom errors (`UnauthorizedError`, `ValidationError`, etc.) - `handleApiError()` converts to JSON responses

### Library-First Architecture

All reusable logic is extracted to `/src/lib/`:

- **[supabase.ts](src/lib/supabase.ts)** - Supabase client management
  - `supabaseAdmin`: Service role client (bypasses RLS) - use sparingly
  - `createUserClient(token)`: User-context client (respects RLS policies)
  - `getUserIdFromToken(token)`: Extract user ID from JWT

- **[validation.ts](src/lib/validation.ts)** - Zod schemas for request/response validation
  - All schemas export TypeScript types (`SignupRequest`, `UploadScreenshotRequest`, etc.)
  - `validateRequest(schema, data)`: Throws `ValidationError` with field-level errors
  - Constants: `ALLOWED_MIME_TYPES`, `MAX_FILE_SIZE` (10MB), `MAX_FILENAME_LENGTH` (255)

- **[errors.ts](src/lib/errors.ts)** - Custom error classes
  - All extend `ApiError` with `statusCode`, `code`, and optional `details`
  - `handleApiError(error)`: Converts any error to standardized JSON response
  - Never expose stack traces in production - error messages are sanitized

- **[storage.ts](src/lib/storage.ts)** - Supabase Storage utilities
  - `getUploadUrl(path)`: Generate signed upload URL
  - `getPublicUrl(path)`: Get CDN URL for uploaded files
  - `deleteFile(path)`: Delete file from storage

- **[stripe.ts](src/lib/stripe.ts)** - Stripe client and webhook processing
  - `stripe`: Initialized Stripe client
  - `constructWebhookEvent(body, signature)`: Verify webhook signatures

- **[short-id.ts](src/lib/short-id.ts)** - Short URL generation
  - `generateShortId()`: Creates 6-character alphanumeric IDs (nanoid)
  - Implements 3-retry collision handling for uniqueness

- **[rate-limit.ts](src/lib/rate-limit.ts)** - Upstash Redis rate limiting
  - Configured for 10 uploads/min and 100 API requests/min per user

### Data Model & Row-Level Security (RLS)

**Core Principle**: All user data is isolated via Supabase RLS policies. The database schema enforces multi-tenancy at the database level.

**Tables** (see [specs/001-api-backend/data-model.md](specs/001-api-backend/data-model.md)):
- `profiles`: User accounts, plan tier, Stripe IDs, downgrade timestamps
- `screenshots`: Screenshot metadata with expiration dates (30 days for free, null for pro)
- `monthly_usage`: Track uploads per month for free tier limits
- `stripe_events`: Webhook idempotency (prevent duplicate processing)

**RLS Enforcement**:
- Users can only read/write their own data (`auth.uid() = user_id`)
- Screenshots can be publicly viewed if `is_public = true`
- Monthly usage is read-only for users (updated via admin client)

**Important**: Use `createUserClient(token)` for all user-initiated operations. Only use `supabaseAdmin` for:
1. Stripe webhook processing
2. Updating `monthly_usage` (requires bypassing RLS for atomic increments)
3. System-level operations (cleanup jobs, migrations)

### Freemium Plan Logic

**Free Tier Limits**:
- 10 screenshots per month (calendar month, resets on 1st)
- Screenshots expire 30 days after upload
- Grandfathering: Screenshots uploaded before downgrade don't count toward limit

**Grandfathering Implementation** (see [src/app/api/upload/signed-url/route.ts](src/app/api/upload/signed-url/route.ts)):
```typescript
// Only count screenshots uploaded AFTER downgrade timestamp
const screenshotsThisMonth = await supabase
  .from('screenshots')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', userId)
  .gte('created_at', profile.downgraded_at || '1970-01-01') // Grandfather old screenshots
  .gte('created_at', firstDayOfMonth);

if (screenshotsThisMonth.count >= 10) {
  throw new ValidationError('Free tier limit reached (10/month)');
}
```

**Expiration Handling**:
- Calculated at upload time: `created_at + 30 days` for free, `null` for pro
- Enforced in public viewer route ([src/app/api/s/[shortId]/route.ts](src/app/api/s/[shortId]/route.ts))
- Returns `410 Gone` for expired screenshots

### Stripe Integration

**Webhook Events** ([src/app/api/billing/webhook/route.ts](src/app/api/billing/webhook/route.ts)):
- `customer.subscription.created`: Set `plan = 'pro'`, update `stripe_subscription_id`, clear `downgraded_at`
- `customer.subscription.deleted`: Set `plan = 'free'`, set `downgraded_at = NOW()`, clear `stripe_subscription_id`
- `customer.subscription.updated`: Handle plan changes (pro/team)

**Idempotency**: All webhook events are logged in `stripe_events` table with event ID to prevent duplicate processing.

**Checkout Flow**:
1. `POST /api/billing/checkout` creates Stripe checkout session
2. Redirects to Stripe-hosted page
3. Webhook updates user plan on successful payment
4. User redirected to success URL

## Environment Variables

Required for development (see [.env.example](.env.example)):

```bash
# Supabase (get from Supabase dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...  # Public key (safe for client)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...      # Secret key (server-only)

# Stripe (get from Stripe dashboard)
STRIPE_SECRET_KEY=sk_test_...             # Test mode secret key
STRIPE_WEBHOOK_SECRET=whsec_...           # For webhook signature verification
STRIPE_PRICE_ID=price_...                 # Pro plan price ID

# Vercel KV (optional in dev - rate limiting will be disabled)
KV_REST_API_URL=https://xxxxx.kv.vercel-storage.com
KV_REST_API_TOKEN=xxxxx

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Used for share URLs
```

**Setup Instructions**: See [specs/001-api-backend/quickstart.md](specs/001-api-backend/quickstart.md) for detailed Supabase and Stripe configuration.

## Code Quality Standards

These standards are enforced via the Cursor rules ([.cursor/rules/senior-fe-dev.mdc](.cursor/rules/senior-fe-dev.mdc)):

1. **Library-First**: Extract all business logic to `/lib` - no duplicate code in routes
2. **Type Safety**: Use Zod schemas for runtime validation + TypeScript types for compile-time safety
3. **Error Handling**: Always use custom error classes - never throw raw Error objects
4. **Early Returns**: Prefer early returns over nested if/else for readability
5. **Descriptive Naming**: Use full words (`createUserClient`, not `createClient`)
6. **Test-Driven Development**: Write tests before implementation (all endpoints have contract tests)
7. **No TODOs**: All code must be fully implemented - no placeholders

## Common Workflows

### Adding a New API Endpoint

1. **Write Contract Test** (`tests/contract/[feature].test.ts`)
   ```typescript
   import { test, expect } from '@playwright/test';

   test('POST /api/new-endpoint returns 200', async ({ request }) => {
     const response = await request.post('/api/new-endpoint', {
       headers: { 'Authorization': `Bearer ${token}` },
       data: { field: 'value' },
     });
     expect(response.status()).toBe(200);
   });
   ```

2. **Create Zod Schema** (`src/lib/validation.ts`)
   ```typescript
   export const newFeatureSchema = z.object({
     field: z.string().min(1),
   });
   export type NewFeatureRequest = z.infer<typeof newFeatureSchema>;
   ```

3. **Implement Route** (`src/app/api/new-endpoint/route.ts`)
   - Follow the API-First Design Pattern (see above)
   - Use `validateRequest()`, `createUserClient()`, `handleApiError()`

4. **Run Tests**: `npm run test:contract`

### Debugging Test Failures

- **Rate Limit Errors**: Tests run sequentially to avoid limits - check Playwright config
- **Auth Errors**: Ensure test user exists in Supabase - check `tests/setup.ts`
- **Database Errors**: Verify RLS policies allow the operation - use `supabaseAdmin` carefully
- **Webhook Errors**: Use Stripe CLI for local testing: `stripe listen --forward-to localhost:3000/api/billing/webhook`

### Running Single Test File

```bash
# Unit tests
npx vitest run tests/unit/short-id.test.ts

# Contract tests
npx playwright test tests/contract/auth-signup.test.ts
```

## Important Constraints

- **File Size Limit**: 10MB max (`MAX_FILE_SIZE` in validation.ts)
- **MIME Types**: Only `image/png`, `image/jpeg`, `image/gif`, `image/webp`
- **Short ID Format**: 6-character alphanumeric (nanoid) with 3-retry collision handling
- **Rate Limits**: 10 uploads/min/user, 100 API requests/min/user (enforced via Upstash Redis)
- **Screenshot Expiration**: 30 days for free tier (non-negotiable for storage costs)

## Documentation

- **[API.md](./API.md)** - Full API reference with request/response examples
- **[specs/001-api-backend/spec.md](./specs/001-api-backend/spec.md)** - Original feature specification
- **[specs/001-api-backend/data-model.md](./specs/001-api-backend/data-model.md)** - Database schema and RLS policies
- **[specs/001-api-backend/quickstart.md](./specs/001-api-backend/quickstart.md)** - Detailed setup guide
- **[specs/001-api-backend/plan.md](./specs/001-api-backend/plan.md)** - Implementation plan and architecture decisions
