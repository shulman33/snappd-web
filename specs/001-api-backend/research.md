# Research: Core API Backend

**Phase**: 0 (Outline & Research)  
**Date**: 2025-10-17  
**Status**: Complete

## Overview

This document captures research findings and technical decisions for the snappd API backend implementation. All technical unknowns from the planning phase have been resolved with rationale and alternatives considered.

---

## 1. Authentication Strategy

### Decision: Supabase Auth with OAuth Providers

**Rationale**:
- Built-in support for email/password, Google OAuth, and GitHub OAuth (FR-007)
- Automatic JWT token management and session handling
- Row-level security (RLS) integration with PostgreSQL via `auth.uid()`
- No custom auth infrastructure needed (aligns with constitution's zero-ops principle)
- GDPR-compliant user data handling out of the box

**Alternatives Considered**:
- **NextAuth.js**: Popular but requires custom session storage and more configuration. Supabase Auth provides deeper PostgreSQL integration.
- **Auth0**: Third-party SaaS adds another vendor dependency and cost. Supabase Auth is included.
- **Custom JWT**: High development cost, security risks, no benefit over Supabase Auth.

**Implementation Notes**:
- Use `@supabase/ssr` for server-side auth in API routes
- Client initialization: `createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)` for admin operations
- User context: `createClient(supabaseUrl, anonKey, { cookies })` for row-level security

**References**:
- Supabase Auth docs: https://supabase.com/docs/guides/auth
- Next.js integration: https://supabase.com/docs/guides/auth/server-side/nextjs

---

## 2. File Upload Strategy

### Decision: Direct Upload to Supabase Storage with Signed URLs

**Rationale**:
- Supabase Storage provides CDN distribution automatically (FR-003)
- Signed URLs allow browser extensions to upload directly without proxying through API
- Supports CORS for browser extension origins (FR-018)
- Automatic HTTPS and global edge distribution
- Storage buckets integrate with RLS policies for access control (FR-014)

**Alternatives Considered**:
- **Cloudinary**: Third-party service adds vendor dependency and cost. Supabase Storage is included and integrates with auth.
- **AWS S3 Direct Upload**: Requires managing AWS credentials, S3 buckets, and CloudFront CDN separately. More complex.
- **Base64 in API Route**: 10MB files would exceed API route payload limits and add latency. Not viable.

**Implementation Notes**:
- Bucket: `screenshots` (public read, authenticated write)
- File path format: `{user_id}/{upload_timestamp}_{nanoid()}.{ext}`
- MIME type validation before signed URL generation (FR-016)
- Generate signed upload URLs with 5-minute expiration
- Store final `storage_path` in database after successful upload

**References**:
- Supabase Storage docs: https://supabase.com/docs/guides/storage
- Signed URLs: https://supabase.com/docs/guides/storage/uploads/signed-upload-urls

---

## 3. Short URL ID Generation

### Decision: nanoid with Retry-on-Collision

**Rationale**:
- `nanoid(6)` generates URL-safe 6-character IDs (62^6 = ~56B combinations)
- Cryptographically secure random generation (better than sequential counters)
- Collision probability negligible but handled via 3-retry logic (Clarification #2)
- Library-first: Extract to `/lib/short-id.ts` for reusability

**Alternatives Considered**:
- **UUID**: 36 characters too long for shareable URLs. User requirement is short format.
- **Sequential Base62**: Predictable IDs enable enumeration attacks. Random is more secure.
- **hashids**: Deterministic encoding of sequential IDs. Still enumerable and less secure than random.

**Implementation Notes**:
```typescript
// /lib/short-id.ts
import { nanoid } from 'nanoid';

export async function generateUniqueShortId(
  checkExists: (id: string) => Promise<boolean>,
  maxRetries = 3
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const id = nanoid(6);
    if (!(await checkExists(id))) return id;
  }
  throw new Error('Failed to generate unique short ID after max retries');
}
```

**References**:
- nanoid docs: https://github.com/ai/nanoid
- Collision probability calculator: https://zelark.github.io/nano-id-cc/

---

## 4. Rate Limiting Strategy

### Decision: Vercel Edge Functions with KV Store

**Rationale**:
- Vercel KV (Redis) provides fast, distributed rate limit counters
- Edge functions execute globally close to users (low latency)
- Constitution requirement: 10 uploads/min/user, 100 API requests/min/user (FR-017)
- Token bucket algorithm for smooth rate limiting (no sudden blocks)

**Alternatives Considered**:
- **upstash/ratelimit**: Vercel-recommended package built on Vercel KV. Will use this.
- **In-Memory Rate Limiting**: Doesn't scale across serverless function instances. Not viable.
- **Supabase Functions**: Adds latency (extra network hop). Vercel Edge is co-located with API routes.

**Implementation Notes**:
```typescript
// /lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export const uploadRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 uploads per minute
  analytics: true,
});

export const apiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
  analytics: true,
});
```

**References**:
- upstash/ratelimit: https://github.com/upstash/ratelimit
- Vercel KV: https://vercel.com/docs/storage/vercel-kv

---

## 5. Request/Response Validation

### Decision: Zod Schemas with Type Inference

**Rationale**:
- Type-safe validation with TypeScript inference (no duplicate type definitions)
- Detailed error messages for user-friendly API responses (FR-025)
- Constitution requirement: Input validation and sanitization
- Works seamlessly with Next.js API routes

**Alternatives Considered**:
- **joi**: Less TypeScript integration. Zod is TypeScript-first.
- **yup**: Similar to joi. Zod has better type inference.
- **Manual validation**: Error-prone and verbose. Not maintainable.

**Implementation Notes**:
```typescript
// /lib/validation.ts
import { z } from 'zod';

export const uploadScreenshotSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/gif', 'image/webp']),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024), // 10MB
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export type UploadScreenshotRequest = z.infer<typeof uploadScreenshotSchema>;
```

**References**:
- Zod docs: https://zod.dev/
- Next.js validation pattern: https://nextjs.org/docs/app/building-your-application/routing/route-handlers#request-body-validation

---

## 6. Stripe Webhook Handling

### Decision: Idempotent Processing with Event ID Storage

**Rationale**:
- Stripe can retry webhooks, causing duplicate processing (FR-010)
- Store processed event IDs in `stripe_events` table to detect duplicates
- Verify webhook signatures before processing (security requirement)
- Handle subscription lifecycle: `customer.subscription.created`, `updated`, `deleted`, `payment_failed`

**Alternatives Considered**:
- **No idempotency check**: Risk of duplicate charges or double-downgrades. Not acceptable.
- **Redis-based deduplication**: Requires TTL management. PostgreSQL is simpler and permanent audit trail.

**Implementation Notes**:
```typescript
// /app/api/billing/webhook/route.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')!;
  const body = await request.text();
  
  // Verify signature
  const event = stripe.webhooks.constructEvent(
    body,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
  
  // Check idempotency
  const { data: existing } = await supabase
    .from('stripe_events')
    .select('id')
    .eq('id', event.id)
    .single();
  
  if (existing) {
    return new Response('Event already processed', { status: 200 });
  }
  
  // Process event...
  
  // Store event ID
  await supabase.from('stripe_events').insert({ id: event.id });
  
  return new Response('Success', { status: 200 });
}
```

**References**:
- Stripe webhooks: https://stripe.com/docs/webhooks
- Webhook signatures: https://stripe.com/docs/webhooks/signatures
- Idempotency: https://stripe.com/docs/webhooks/best-practices#duplicate-events

---

## 7. Monthly Usage Tracking

### Decision: Calendar Month Reset with Scheduled Function

**Rationale**:
- Clarification #1: All users reset on 1st of month (calendar-based)
- Use `monthly_usage` table with composite unique key `(user_id, month)`
- Month format: `'2025-10'` for easy querying and grouping
- Increment counters on screenshot upload, check against plan limits before allowing upload

**Alternatives Considered**:
- **User-specific anniversary dates**: Complex to track and reset. Calendar month is simpler (per clarification).
- **No tracking table**: Query screenshots table directly. Too slow for real-time limit checks.

**Implementation Notes**:
```typescript
// Check usage before upload
const currentMonth = new Date().toISOString().slice(0, 7); // '2025-10'
const { data: usage } = await supabase
  .from('monthly_usage')
  .select('screenshot_count')
  .eq('user_id', userId)
  .eq('month', currentMonth)
  .single();

if (userPlan === 'free' && usage?.screenshot_count >= 10) {
  return new Response('Monthly limit reached', { status: 429 });
}

// Increment after successful upload (upsert)
await supabase.from('monthly_usage').upsert({
  user_id: userId,
  month: currentMonth,
  screenshot_count: (usage?.screenshot_count || 0) + 1,
  storage_bytes: (usage?.storage_bytes || 0) + fileSize,
});
```

**References**:
- Supabase upsert: https://supabase.com/docs/reference/javascript/upsert

---

## 8. Screenshot Expiration Handling

### Decision: Database Timestamp with Cleanup Job

**Rationale**:
- Clarification #5: Expiration starts from individual upload date (30 days per screenshot)
- Set `expires_at = upload_timestamp + 30 days` for free tier, `NULL` for pro tier
- Public viewer endpoint checks `expires_at < NOW()` and returns 410 Gone (FR-022)
- Periodic cleanup job (Supabase cron or Vercel cron) deletes expired files and rows

**Alternatives Considered**:
- **TTL in storage**: Supabase Storage doesn't support object lifecycle policies yet. Manual cleanup required.
- **No cleanup**: Storage costs accumulate. Need periodic deletion.

**Implementation Notes**:
```typescript
// On upload for free tier users
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 30);

await supabase.from('screenshots').insert({
  user_id: userId,
  expires_at: userPlan === 'free' ? expiresAt.toISOString() : null,
  // ...other fields
});

// In public viewer route
const { data: screenshot } = await supabase
  .from('screenshots')
  .select('*')
  .eq('short_id', shortId)
  .single();

if (screenshot.expires_at && new Date(screenshot.expires_at) < new Date()) {
  return new Response('Screenshot expired', { status: 410 });
}
```

**References**:
- Vercel Cron: https://vercel.com/docs/cron-jobs

---

## 9. MIME Type Validation

### Decision: Server-Side Validation Before Storage

**Rationale**:
- Clarification #4: MIME type validation only (fast, sufficient for MVP)
- Check `Content-Type` header and validate file signature (magic bytes) for common images
- Reject non-image uploads before generating signed URL
- Constitution: Speed is critical; full antivirus adds latency

**Alternatives Considered**:
- **Client-side only**: Easily bypassed. Must validate server-side.
- **Full antivirus (ClamAV)**: Adds 2-5 seconds per scan. Violates 10-second upload target.
- **Magic bytes only**: Content-Type header spoofing. Use both for defense in depth.

**Implementation Notes**:
```typescript
// /lib/storage.ts
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];

export function validateMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

export function validateFileSignature(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return true;
  }
  
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return true;
  }
  
  // GIF: 47 49 46
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return true;
  }
  
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return true;
  }
  
  return false;
}
```

**References**:
- File signatures list: https://en.wikipedia.org/wiki/List_of_file_signatures

---

## 10. Pro Tier Downgrade Handling

### Decision: Grandfather Existing Screenshots

**Rationale**:
- Clarification #3: Existing screenshots remain accessible, new uploads limited
- Add `is_grandfathered` boolean or check `created_at < downgrade_timestamp`
- Monthly usage counter only counts non-grandfathered screenshots
- Encourages re-upgrade without data loss (conversion optimization)

**Alternatives Considered**:
- **Delete excess**: User frustration, data loss, poor UX.
- **Archive oldest**: Complex business logic, still partial data loss.

**Implementation Notes**:
```typescript
// On downgrade (Stripe webhook: subscription.deleted or payment_failed)
const downgradeTimestamp = new Date().toISOString();

await supabase.from('profiles').update({
  plan: 'free',
  downgraded_at: downgradeTimestamp, // New column
}).eq('id', userId);

// When checking monthly limits
const { count } = await supabase
  .from('screenshots')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId)
  .gte('created_at', profile.downgraded_at || '1970-01-01') // Only count post-downgrade uploads
  .gte('created_at', currentMonthStart); // Only count current month

if (count >= 10) {
  return new Response('Monthly limit reached', { status: 429 });
}
```

**References**:
- SaaS downgrade patterns: https://www.priceintelligently.com/blog/freemium-pricing-downgrade-strategy

---

## Summary

All technical unknowns resolved. Stack decisions align with:
- ✅ Constitution requirements (Next.js, Supabase, Vercel, TypeScript)
- ✅ Performance targets (<10s workflow, <200ms API, MIME-only validation)
- ✅ Freemium conversion (grandfathering, clear tier limits)
- ✅ Security requirements (RLS, rate limiting, MIME validation, webhook verification)
- ✅ Clarifications from /speckit.clarify session (calendar month, retry collisions, grandfathering, MIME-only, upload date expiration)

Ready for Phase 1: Data model definition and API contract generation.

