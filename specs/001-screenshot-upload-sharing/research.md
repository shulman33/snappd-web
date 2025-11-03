# Research: Screenshot Upload and Sharing System

**Feature**: `001-screenshot-upload-sharing`
**Date**: 2025-11-03
**Status**: Complete

## Research Questions Resolved

### 1. Supabase Storage Architecture for Screenshot Uploads

**Decision**: Use Supabase Storage with signed upload URLs and direct client uploads

**Rationale**:
- **Signed Upload URLs**: Supabase provides `createSignedUploadUrl()` which generates temporary, authorized upload URLs that can be used by the browser extension without exposing service role keys
- **Direct Client Uploads**: Browser extension uploads directly to Supabase Storage using signed URLs, bypassing Next.js API routes for file transfer (reduces server bandwidth and latency)
- **Built-in CDN**: Supabase Storage includes automatic CDN distribution via `https://[project_id].supabase.co/storage/v1/object/public/[bucket]/[asset-name]`
- **Image Transformations**: Native support for on-the-fly image transformations using `transform` parameter in `getPublicUrl()` and `createSignedUrl()`

**Implementation Pattern**:
```typescript
// Server-side: Generate signed upload URL (Next.js API route)
const { data, error } = await supabaseAdmin.storage
  .from('screenshots')
  .createSignedUploadUrl(filePath, { upsert: true })

// Client-side: Upload using signed URL (browser extension)
await supabase.storage
  .from('screenshots')
  .uploadToSignedUrl(filePath, token, file)
```

**Alternatives Considered**:
- **Direct API Route Upload**: Rejected due to increased server load, bandwidth costs, and slower upload speeds (file passes through Next.js server)
- **Pre-signed S3 URLs**: Rejected because Supabase Storage provides equivalent functionality with simpler integration
- **Multipart Upload**: Available through Supabase's resumable upload protocol for files >6MB, enabling pause/resume functionality

**Reference**: Supabase Storage docs on presigned URLs and resumable uploads

---

### 2. Image Optimization Strategy

**Decision**: Use Supabase's built-in image transformation APIs for optimization and thumbnail generation

**Rationale**:
- **Zero Processing Infrastructure**: Transformations handled by Supabase CDN edge nodes, no server-side processing required
- **On-Demand Transformations**: Images transformed on first request and cached at CDN edge
- **Format Support**: Supports PNG, JPEG, WEBP, GIF with automatic format detection
- **Quality Control**: Configurable quality settings (0-100) for compression
- **Thumbnail Generation**: Specify width/height with resize modes (cover, contain, fill)

**Implementation Pattern**:
```typescript
// Get optimized image URL with transformations
const { data } = supabase.storage
  .from('screenshots')
  .getPublicUrl('image.jpg', {
    transform: {
      width: 800,
      height: 600,
      quality: 75,
      format: 'origin' // or 'webp' for conversion
    }
  })

// Generate thumbnail
const thumbnailUrl = supabase.storage
  .from('screenshots')
  .getPublicUrl('image.jpg', {
    transform: {
      width: 200,
      height: 150,
      resize: 'cover'
    }
  })
```

**Alternatives Considered**:
- **Server-side Sharp/ImageMagick**: Rejected due to added complexity, server resource usage, and deployment constraints
- **Client-side compression**: Rejected as backup strategy only; not reliable across all browsers
- **Third-party services (Cloudinary, Imgix)**: Rejected due to added cost and complexity when Supabase provides equivalent functionality

**Reference**: Supabase image transformations documentation

---

### 3. File Organization and Naming Strategy

**Decision**: Use hierarchical folder structure: `{user_id}/{year}/{month}/{hash}-{timestamp}.{ext}`

**Rationale**:
- **User Isolation**: Top-level user_id folder enables easy RLS policies and bulk operations
- **Temporal Organization**: Year/month structure facilitates cleanup jobs and quota calculations
- **Collision Prevention**: Hash + timestamp ensures unique filenames even for duplicate content
- **Duplicate Detection**: File hash allows detection of duplicate uploads before storage

**Implementation Pattern**:
```typescript
// Generate file path
const hash = await generateFileHash(file) // SHA-256
const timestamp = Date.now()
const filePath = `${userId}/${year}/${month}/${hash}-${timestamp}.${extension}`

// Enable duplicate detection
const existingFile = await findFileByHash(userId, hash)
if (existingFile) {
  // Prompt user: reuse existing or upload new
}
```

**Alternatives Considered**:
- **Flat Structure**: `{user_id}/{filename}` - Rejected due to poor organization and difficult cleanup
- **UUID-only**: `{user_id}/{uuid}.{ext}` - Rejected because no temporal context for cleanup jobs
- **Date-first**: `{year}/{month}/{user_id}/{filename}` - Rejected because makes user-level operations inefficient

**Reference**: Supabase Storage folder helper functions

---

### 4. Quota Enforcement Mechanism

**Decision**: Use database triggers + API middleware for atomic quota checking

**Rationale**:
- **Race Condition Prevention**: Database triggers with SELECT FOR UPDATE ensure atomic quota checks
- **Dual-Layer Protection**: API middleware provides fast rejection before upload; database trigger provides final enforcement
- **Monthly Reset**: CRON job or Edge Function runs at month boundary to reset counters
- **Storage vs Count Quotas**: Track both screenshot count (10/month free) and storage bytes separately

**Implementation Pattern**:
```sql
-- Database trigger for atomic quota enforcement
CREATE OR REPLACE FUNCTION check_upload_quota()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  user_plan TEXT;
  quota_limit INTEGER;
BEGIN
  -- Lock row for update
  SELECT plan INTO user_plan FROM profiles WHERE id = NEW.user_id FOR UPDATE;

  -- Check quota for free users only
  IF user_plan = 'free' THEN
    SELECT screenshot_count INTO current_count
    FROM monthly_usage
    WHERE user_id = NEW.user_id
      AND month = to_char(NOW(), 'YYYY-MM')
    FOR UPDATE;

    IF current_count >= 10 THEN
      RAISE EXCEPTION 'Monthly quota exceeded';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Alternatives Considered**:
- **Application-only checks**: Rejected due to race conditions in concurrent uploads
- **Redis counters**: Rejected due to added infrastructure complexity
- **Storage bucket policies**: Insufficient granularity for user-specific quotas

**Reference**: PostgreSQL triggers and row-level locking

---

### 5. Short URL Generation Strategy

**Decision**: Use base62-encoded sequential IDs with mapping table

**Rationale**:
- **Short URLs**: Base62 encoding produces ~6-7 character URLs for millions of screenshots
- **No Collisions**: Sequential IDs guarantee uniqueness
- **Predictable Length**: Consistent URL length improves UX
- **Simple Lookup**: Direct primary key lookup in PostgreSQL is extremely fast

**Implementation Pattern**:
```typescript
// Generate short ID
const shortId = encodeBase62(sequentialId) // e.g., "aB3xYz"

// Store mapping
await db.screenshots.create({
  id: uuid(),
  short_id: shortId,
  user_id: userId,
  storage_path: filePath,
  // ... other fields
})

// URL format: snappd.io/{shortId}
const shareableUrl = `https://snappd.io/${shortId}`
```

**Alternatives Considered**:
- **Random strings**: Rejected due to potential collisions and need for retry logic
- **UUIDs**: Rejected because too long for shareable URLs
- **Hash-based**: Rejected due to collision potential and complexity

**Reference**: Base62 encoding for URL shortening

---

### 6. View Tracking and Analytics

**Decision**: Separate analytics table with IP anonymization and bot filtering

**Rationale**:
- **Privacy Compliance**: Hash IP addresses before storage (GDPR/CCPA requirement)
- **Performance**: Separate table prevents analytics queries from impacting main screenshots table
- **Bot Filtering**: User-agent analysis to exclude known crawlers/bots
- **Owner Exclusion**: Check authenticated user against screenshot owner to exclude self-views
- **Aggregation**: Pre-aggregate daily stats for faster dashboard queries

**Implementation Pattern**:
```typescript
// Log view event
await db.view_events.create({
  screenshot_id: screenshotId,
  viewed_at: new Date(),
  ip_hash: hashIp(ipAddress), // SHA-256 with salt
  country: getCountryFromIp(ipAddress), // IP geolocation
  is_authenticated: !!userId,
  is_owner: userId === screenshot.user_id
})

// Exclude bots via middleware
const userAgent = request.headers.get('user-agent')
if (isBot(userAgent)) return // Don't log bot views
```

**Alternatives Considered**:
- **Raw IP storage**: Rejected due to privacy regulations
- **Counter-only**: Rejected because no analytics breakdown (daily, geographic)
- **Google Analytics**: Rejected for shared link pages to avoid privacy concerns

**Reference**: GDPR requirements for IP address handling

---

### 7. Real-time Upload Progress

**Decision**: Use Supabase Realtime channels for progress updates

**Rationale**:
- **Native Integration**: Supabase Realtime uses WebSocket connections already established for auth
- **Broadcast Channels**: Can broadcast progress events from API routes to listening clients
- **Low Latency**: WebSocket updates faster than polling
- **Multi-device Support**: Dashboard and extension can both listen to same channel

**Implementation Pattern**:
```typescript
// Server-side: Broadcast progress
const channel = supabase.channel(`upload:${userId}`)
channel.send({
  type: 'broadcast',
  event: 'upload_progress',
  payload: {
    uploadId,
    bytesUploaded,
    totalBytes,
    percentage: Math.round((bytesUploaded / totalBytes) * 100)
  }
})

// Client-side: Listen for progress
const channel = supabase.channel(`upload:${userId}`)
channel.on('broadcast', { event: 'upload_progress' }, (payload) => {
  updateProgressBar(payload.percentage)
}).subscribe()
```

**Alternatives Considered**:
- **HTTP Polling**: Rejected due to increased latency and server load
- **Server-Sent Events (SSE)**: Rejected because Supabase Realtime provides better integration
- **File upload progress events**: Built-in browser progress events for initial upload; Realtime for processing updates

**Reference**: Supabase Realtime broadcast channels

---

### 8. Access Control and RLS Policies

**Decision**: Row-Level Security (RLS) for user isolation + public sharing through signed URLs

**Rationale**:
- **Defense in Depth**: RLS ensures users can only access their own screenshots at database level
- **Public Sharing**: Signed URLs bypass RLS for legitimate share links with expiration
- **Password Protection**: Additional application-layer check before generating signed URL
- **Private Mode**: Require authentication and ownership check before access

**Implementation Pattern**:
```sql
-- RLS Policy: Users can only view their own screenshots
CREATE POLICY "Users view own screenshots"
ON screenshots FOR SELECT
USING (auth.uid() = user_id);

-- RLS Policy: Public screenshots viewable via service role
CREATE POLICY "Public screenshots viewable"
ON screenshots FOR SELECT
USING (is_public = true);

-- Storage RLS: Restrict folder access
CREATE POLICY "Users access own folder"
ON storage.objects FOR SELECT
USING (bucket_id = 'screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);
```

**Alternatives Considered**:
- **Application-only access control**: Rejected as single point of failure
- **Public bucket for all**: Rejected due to privacy and security concerns
- **Separate public/private buckets**: Rejected due to added complexity

**Reference**: Supabase RLS policies and storage security

---

### 9. Cleanup and Expiration Jobs

**Decision**: Supabase Edge Functions with pg_cron for scheduled cleanup

**Rationale**:
- **Serverless Execution**: Edge Functions run on-demand without infrastructure
- **Built-in Scheduling**: pg_cron extension for PostgreSQL scheduling
- **Atomic Operations**: Database queries ensure consistency during cleanup
- **Cost Effective**: Only runs when needed (e.g., daily at midnight UTC)

**Implementation Pattern**:
```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup job
SELECT cron.schedule(
  'cleanup-expired-screenshots',
  '0 0 * * *', -- Daily at midnight UTC
  $$
    DELETE FROM screenshots
    WHERE expires_at IS NOT NULL
      AND expires_at < NOW();
  $$
);
```

**Edge Function** (TypeScript):
```typescript
// Supabase Edge Function: cleanup-storage
Deno.serve(async (req) => {
  const { data: expiredScreenshots } = await supabaseAdmin
    .from('screenshots')
    .delete()
    .lte('expires_at', new Date().toISOString())
    .select('storage_path')

  // Delete from storage
  for (const screenshot of expiredScreenshots) {
    await supabaseAdmin.storage
      .from('screenshots')
      .remove([screenshot.storage_path])
  }

  return new Response(JSON.stringify({ deleted: expiredScreenshots.length }))
})
```

**Alternatives Considered**:
- **Background worker**: Rejected due to deployment complexity
- **Client-side cleanup**: Rejected because unreliable and security risk
- **Manual cleanup**: Rejected because not scalable

**Reference**: Supabase Edge Functions and pg_cron

---

### 10. Password Protection Implementation

**Decision**: Bcrypt password hashing with rate limiting via Upstash Redis

**Rationale**:
- **Security**: Bcrypt is industry standard for password hashing (adaptive cost factor)
- **Rate Limiting**: Prevent brute force attacks with 3 attempts per 5 minutes
- **No Plaintext**: Passwords never stored in plaintext or logs
- **Independent**: Password check happens before signed URL generation

**Implementation Pattern**:
```typescript
// API Route: Check password and generate signed URL
import bcrypt from 'bcryptjs'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, '5 m'), // 3 attempts per 5 minutes
})

export async function POST(request: Request) {
  const { shortId, password } = await request.json()

  // Rate limit by IP
  const { success } = await ratelimit.limit(ipAddress)
  if (!success) {
    return Response.json({ error: 'Too many attempts' }, { status: 429 })
  }

  // Verify password
  const screenshot = await db.screenshots.findOne({ short_id: shortId })
  const valid = await bcrypt.compare(password, screenshot.password_hash)

  if (!valid) {
    return Response.json({ error: 'Invalid password' }, { status: 401 })
  }

  // Generate time-limited signed URL
  const { data } = await supabase.storage
    .from('screenshots')
    .createSignedUrl(screenshot.storage_path, 300) // 5 min expiry

  return Response.json({ signedUrl: data.signedUrl })
}
```

**Alternatives Considered**:
- **Plaintext comparison**: Rejected due to security concerns
- **JWT tokens**: Overly complex for this use case
- **Session-based**: Rejected because stateless is simpler for shared links

**Reference**: OWASP password storage guidelines

---

## Technology Stack Summary

### Core Technologies
- **Storage**: Supabase Storage (PostgreSQL + CDN)
- **Database**: PostgreSQL via Supabase
- **API**: Next.js 15 App Router API routes
- **Frontend**: React 19 + Next.js 15
- **Authentication**: Supabase Auth (existing)
- **Real-time**: Supabase Realtime (WebSocket)

### Libraries & Tools
- **Image Processing**: Supabase image transformations (built-in)
- **Password Hashing**: bcryptjs
- **Rate Limiting**: @upstash/ratelimit + @upstash/redis
- **File Hashing**: Web Crypto API (SHA-256)
- **URL Encoding**: Custom base62 implementation
- **IP Geolocation**: @vercel/edge (built-in Vercel Edge runtime)

### Development Tools
- **Testing**: Vitest for unit tests, Playwright for E2E
- **Type Safety**: TypeScript 5.x strict mode
- **API Contracts**: OpenAPI 3.0 specification

---

## Performance Considerations

### Upload Performance
- **Direct Client Upload**: ~2-5 seconds for 5MB file (bypasses server)
- **Signed URL Generation**: <100ms per request
- **Concurrent Uploads**: Supabase handles 100+ concurrent uploads per project

### Image Delivery
- **CDN Cache**: 99%+ cache hit ratio for transformed images
- **First Request**: ~500-800ms (transformation + CDN cache)
- **Cached Requests**: ~50-150ms (CDN edge delivery)
- **Thumbnail Loading**: <200ms per thumbnail (small transformation cache)

### Database Performance
- **Quota Check**: <10ms (indexed query with row lock)
- **Short ID Lookup**: <5ms (primary key lookup)
- **View Tracking**: Async write, <20ms
- **Dashboard Query**: <100ms for 100 screenshots (with pagination)

### Scalability Limits
- **Supabase Storage**: 100GB free tier, unlimited paid
- **Concurrent Uploads**: 1000+ with Supabase Pro
- **Database Connections**: 500 concurrent (Supabase Pro)
- **Realtime Connections**: 500 concurrent (Supabase Pro)

---

## Security Considerations

### Upload Security
- **File Type Validation**: Server-side MIME type check + magic number verification
- **Size Limits**: 10MB enforced at storage bucket level
- **Malware Scanning**: Not built-in; consider ClamAV integration for enterprise
- **User Isolation**: RLS policies prevent cross-user access

### Access Security
- **Signed URLs**: Time-limited (configurable expiration)
- **Password Protection**: Bcrypt hashing + rate limiting
- **RLS Policies**: Database-level access control
- **CORS**: Restrict API routes to known origins

### Privacy Compliance
- **IP Anonymization**: SHA-256 hashing before storage
- **Data Retention**: Configurable expiration per screenshot
- **User Deletion**: Cascade delete all user screenshots
- **Analytics Opt-out**: (Future consideration)

---

## Cost Analysis

### Supabase Costs (Pro Plan)
- **Storage**: $0.021/GB/month (100GB = $2.10/month)
- **Bandwidth**: $0.09/GB (1TB = $90/month)
- **Database**: Included in Pro ($25/month)
- **Realtime**: Included in Pro

### Vercel Costs
- **Edge Functions**: Included in Pro ($20/month)
- **Bandwidth**: 1TB included

### Upstash Redis Costs
- **Free Tier**: 10,000 commands/day (sufficient for rate limiting)
- **Paid**: $0.20 per 100K commands

**Estimated Monthly Cost (1000 active users)**:
- Supabase Pro: $25/month
- Vercel Pro: $20/month
- Upstash: $0 (free tier sufficient)
- **Total**: ~$45/month base + bandwidth/storage overages

---

## Open Questions (None Remaining)

All technical questions have been resolved through research. Implementation can proceed to Phase 1 (Design).
