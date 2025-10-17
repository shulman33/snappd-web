# Quickstart: snappd API Backend

**Version**: 1.0.0  
**Last Updated**: 2025-10-17  
**Estimated Setup Time**: 30 minutes

## Overview

This guide walks you through setting up the snappd API backend locally and making your first API calls. You'll create a Supabase project, configure Stripe, deploy database migrations, and test the authentication and screenshot upload workflow.

---

## Prerequisites

- **Node.js**: 18.x or later
- **npm**: 9.x or later
- **Supabase Account**: Free tier at [supabase.com](https://supabase.com)
- **Stripe Account**: Test mode at [stripe.com](https://stripe.com)
- **Vercel Account** (optional): For deployment at [vercel.com](https://vercel.com)

---

## Step 1: Clone and Install Dependencies

```bash
# Clone repository
git clone https://github.com/yourusername/snappd-web.git
cd snappd-web

# Install dependencies
npm install

# Install dev dependencies for testing
npm install --save-dev vitest playwright @playwright/test
```

**Expected Dependencies**:
- `next@15.5.5`
- `@supabase/supabase-js`
- `stripe`
- `zod`
- `nanoid`
- `@upstash/ratelimit` (for rate limiting)
- `@upstash/redis` (for rate limiting)

---

## Step 2: Create Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in:
   - **Name**: snappd-dev
   - **Database Password**: Generate strong password (save it!)
   - **Region**: Choose closest to you
4. Wait ~2 minutes for project provisioning

### Get Supabase Credentials

Once created, navigate to **Settings → API**:

- **Project URL**: `https://xxxxx.supabase.co`
- **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **service_role key** (secret): `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

## Step 3: Create Stripe Account and Get Keys

1. Go to [dashboard.stripe.com/register](https://dashboard.stripe.com/register)
2. Complete signup
3. Navigate to **Developers → API Keys**
4. Copy:
   - **Publishable key** (test mode): `pk_test_...`
   - **Secret key** (test mode): `sk_test_...`

### Create Stripe Product and Price

```bash
# Use Stripe CLI or Dashboard to create product
stripe products create \
  --name "snappd Pro" \
  --description "Unlimited screenshots, no expiration"

# Create price for $9/month
stripe prices create \
  --product prod_xxxxx \
  --unit-amount 900 \
  --currency usd \
  --recurring[interval]=month
```

Save the **Price ID**: `price_xxxxx`

### Set Up Webhook Endpoint

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local dev
stripe listen --forward-to http://localhost:3000/api/billing/webhook
```

Save the **Webhook Signing Secret**: `whsec_xxxxx`

---

## Step 4: Configure Environment Variables

Create `.env.local` in project root:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_xxxxx

# Vercel KV (for rate limiting) - Optional for local dev
# If not set, rate limiting will be skipped in development
KV_REST_API_URL=https://xxxxx.kv.vercel-storage.com
KV_REST_API_TOKEN=xxxxx

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Security Note**: Never commit `.env.local` to Git. It's in `.gitignore` by default.

---

## Step 5: Run Database Migrations

### Option A: Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Login
supabase login

# Link to your project
supabase link --project-ref xxxxx

# Run migrations
supabase db push
```

### Option B: Manual SQL Execution

1. Go to Supabase Dashboard → **SQL Editor**
2. Copy contents of `supabase/migrations/20251017000000_initial_schema.sql`
3. Paste and click "Run"

### Verify Migration

```sql
-- Run in SQL Editor to verify tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Expected output: profiles, screenshots, monthly_usage, stripe_events
```

---

## Step 6: Configure Supabase Storage

1. Go to Supabase Dashboard → **Storage**
2. Click "New Bucket"
3. Create bucket:
   - **Name**: `screenshots`
   - **Public**: ✅ (enable public access)
   - **File size limit**: 10 MB
   - **Allowed MIME types**: `image/png, image/jpeg, image/gif, image/webp`

### Set Storage Policy

```sql
-- Run in SQL Editor
CREATE POLICY "Authenticated users can upload screenshots"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'screenshots');

CREATE POLICY "Public read access to screenshots"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'screenshots');
```

---

## Step 7: Start Development Server

```bash
# Start Next.js dev server
npm run dev
```

Server will start at **http://localhost:3000**

---

## Step 8: Test API Endpoints

### 8.1 Create User Account

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "full_name": "Test User"
  }'
```

**Expected Response** (201):
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "test@example.com"
  },
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600
  }
}
```

Save the `access_token` for subsequent requests.

### 8.2 Get User Profile

```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response** (200):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "test@example.com",
  "full_name": "Test User",
  "plan": "free",
  "created_at": "2025-10-17T12:00:00Z",
  "updated_at": "2025-10-17T12:00:00Z"
}
```

### 8.3 Get Signed Upload URL

```bash
curl -X POST http://localhost:3000/api/upload/signed-url \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "test-screenshot.png",
    "mime_type": "image/png",
    "file_size": 524288
  }'
```

**Expected Response** (200):
```json
{
  "upload_url": "https://xxxxx.supabase.co/storage/v1/object/upload/sign/screenshots/...",
  "storage_path": "550e8400-e29b-41d4-a716-446655440000/1729180800_abc123.png",
  "expires_in": 300
}
```

### 8.4 Upload Screenshot (Direct to Storage)

```bash
# Use the upload_url from previous response
curl -X PUT "UPLOAD_URL_FROM_PREVIOUS_RESPONSE" \
  -H "Content-Type: image/png" \
  --data-binary "@/path/to/test-image.png"
```

### 8.5 Create Screenshot Record

```bash
curl -X POST http://localhost:3000/api/screenshots \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "test-screenshot.png",
    "mime_type": "image/png",
    "file_size": 524288,
    "width": 1920,
    "height": 1080,
    "storage_path": "STORAGE_PATH_FROM_SIGNED_URL_RESPONSE"
  }'
```

**Expected Response** (201):
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "short_id": "abc123",
  "original_filename": "test-screenshot.png",
  "file_size": 524288,
  "width": 1920,
  "height": 1080,
  "mime_type": "image/png",
  "public_url": "https://snappd.app/s/abc123",
  "storage_url": "https://xxxxx.supabase.co/storage/v1/object/public/screenshots/...",
  "expires_at": "2025-11-16T12:00:00Z",
  "views": 0,
  "is_public": true,
  "created_at": "2025-10-17T12:00:00Z",
  "updated_at": "2025-10-17T12:00:00Z"
}
```

### 8.6 View Public Screenshot

```bash
curl http://localhost:3000/api/s/abc123
```

**Expected Response** (200):
```json
{
  "short_id": "abc123",
  "original_filename": "test-screenshot.png",
  "width": 1920,
  "height": 1080,
  "storage_url": "https://xxxxx.supabase.co/storage/v1/object/public/screenshots/...",
  "views": 1,
  "created_at": "2025-10-17T12:00:00Z",
  "seo_metadata": {
    "title": "Screenshot - test-screenshot.png",
    "description": "Shared via snappd",
    "image": "https://xxxxx.supabase.co/storage/v1/object/public/screenshots/..."
  }
}
```

### 8.7 Check Usage Stats

```bash
curl http://localhost:3000/api/usage \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response** (200):
```json
{
  "month": "2025-10",
  "screenshot_count": 1,
  "screenshot_limit": 10,
  "storage_bytes": 524288,
  "storage_mb": 0.5,
  "bandwidth_bytes": 524288,
  "bandwidth_mb": 0.5,
  "plan": "free",
  "limit_status": {
    "at_limit": false,
    "remaining": 9,
    "resets_at": "2025-11-01T00:00:00Z"
  },
  "upgrade_prompt": {
    "show_prompt": false,
    "message": "You've used 1 of 10 free screenshots this month.",
    "cta_text": "Upgrade to Pro - $9/month",
    "urgency_level": "low"
  }
}
```

---

## Step 9: Run Tests (TDD)

### Unit Tests

```bash
# Run Vitest tests
npm run test

# Run with coverage
npm run test:coverage
```

**Example test** (`tests/unit/short-id.test.ts`):
```typescript
import { describe, it, expect } from 'vitest';
import { generateUniqueShortId } from '@/lib/short-id';

describe('Short ID Generation', () => {
  it('should generate 6-character ID', async () => {
    const id = await generateUniqueShortId(async () => false);
    expect(id).toHaveLength(6);
  });

  it('should retry on collision and succeed', async () => {
    let attempts = 0;
    const id = await generateUniqueShortId(async () => {
      attempts++;
      return attempts < 2; // First attempt collides, second succeeds
    });
    expect(id).toHaveLength(6);
    expect(attempts).toBe(2);
  });

  it('should throw after max retries', async () => {
    await expect(
      generateUniqueShortId(async () => true, 3)
    ).rejects.toThrow('Failed to generate unique short ID');
  });
});
```

### Contract Tests

```bash
# Run Playwright API tests
npm run test:contract
```

**Example contract test** (`tests/contract/auth.test.ts`):
```typescript
import { test, expect } from '@playwright/test';

test('POST /api/auth/signup - creates user and returns session', async ({ request }) => {
  const response = await request.post('/api/auth/signup', {
    data: {
      email: `test-${Date.now()}@example.com`,
      password: 'SecurePass123!',
      full_name: 'Test User',
    },
  });

  expect(response.status()).toBe(201);
  
  const body = await response.json();
  expect(body.user).toHaveProperty('id');
  expect(body.user).toHaveProperty('email');
  expect(body.session).toHaveProperty('access_token');
});
```

---

## Step 10: Deploy to Vercel

### Install Vercel CLI

```bash
npm install -g vercel
```

### Deploy

```bash
# Login
vercel login

# Deploy
vercel

# Set environment variables in Vercel Dashboard
# Go to Project Settings → Environment Variables
# Add all variables from .env.local
```

### Configure Stripe Webhook for Production

1. Go to Stripe Dashboard → **Developers → Webhooks**
2. Click "Add endpoint"
3. **Endpoint URL**: `https://your-app.vercel.app/api/billing/webhook`
4. **Events to send**: 
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Copy **Signing secret** and add to Vercel environment variables as `STRIPE_WEBHOOK_SECRET`

---

## Troubleshooting

### Issue: "Supabase connection failed"

**Solution**: Check your `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`

### Issue: "Rate limit exceeded" in development

**Solution**: Set `NODE_ENV=development` to skip rate limiting, or configure Vercel KV

### Issue: "Screenshot upload returns 413"

**Solution**: Check file size is under 10MB. Verify Supabase Storage bucket settings.

### Issue: "Stripe webhook signature verification failed"

**Solution**: Ensure `STRIPE_WEBHOOK_SECRET` matches the secret from `stripe listen` or Stripe Dashboard

### Issue: "RLS policy prevents access"

**Solution**: Verify you're passing `Authorization: Bearer <token>` header in requests

---

## API Reference

Full API documentation is available in:
- `contracts/auth.yaml` - Authentication endpoints
- `contracts/screenshots.yaml` - Screenshot management
- `contracts/billing.yaml` - Stripe integration
- `contracts/usage.yaml` - Usage tracking

View in Swagger UI: [swagger.io/tools/swagger-editor](https://editor.swagger.io/) (paste YAML contents)

---

## Next Steps

1. **Implement Frontend**: Build React components using shadcn/ui for dashboard
2. **Add Email Notifications**: Integrate Supabase Edge Functions for usage alerts
3. **Implement Analytics**: Add Vercel Analytics for performance monitoring
4. **Browser Extension**: Create Chrome/Firefox extension using API endpoints
5. **Mobile App**: Future iOS/Android apps using same API

---

## Support

- **Documentation**: `/specs/001-api-backend/`
- **Issues**: GitHub Issues
- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Stripe Docs**: [stripe.com/docs/api](https://stripe.com/docs/api)
- **Next.js Docs**: [nextjs.org/docs](https://nextjs.org/docs)

---

**Happy coding!** 🚀

