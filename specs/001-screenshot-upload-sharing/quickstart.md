# Quickstart: Screenshot Upload and Sharing Implementation

**Feature**: `001-screenshot-upload-sharing`
**Date**: 2025-11-03
**Audience**: Developers implementing this feature

## Overview

This guide provides a step-by-step implementation path for the screenshot upload and sharing system. Follow the phases in order to build incrementally, with each phase delivering testable, working functionality.

---

## Prerequisites

### Environment Setup

1. **Supabase Project** (already configured)
   - Project ID: `iitxfjhnywekstxagump`
   - API URL: `https://iitxfjhnywekstxagump.supabase.co`
   - Service role key: Available in `.env.local`

2. **Required Environment Variables**
   ```bash
   # .env.local
   NEXT_PUBLIC_SUPABASE_URL=https://iitxfjhnywekstxagump.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

   # For rate limiting (optional in dev)
   UPSTASH_REDIS_REST_URL=<url>
   UPSTASH_REDIS_REST_TOKEN=<token>
   ```

3. **Dependencies to Install**
   ```bash
   npm install @supabase/supabase-js@latest bcryptjs @upstash/ratelimit @upstash/redis
   npm install -D @types/bcryptjs
   ```

---

## Implementation Phases

### Phase 1: Database Setup (Day 1)

**Goal**: Create database schema with RLS policies and triggers

#### 1.1 Run Database Migrations

```bash
# Create migration file
supabase migration new screenshot_upload_schema

# Edit the migration file with SQL from data-model.md
# File: supabase/migrations/<timestamp>_screenshot_upload_schema.sql
```

**Migration Content**:
```sql
-- Add new columns to screenshots table
ALTER TABLE screenshots
ADD COLUMN file_hash TEXT NOT NULL DEFAULT '',
ADD COLUMN sharing_mode TEXT NOT NULL DEFAULT 'public',
ADD COLUMN password_hash TEXT,
ADD COLUMN thumbnail_path TEXT,
ADD COLUMN optimized_path TEXT,
ADD COLUMN processing_status TEXT DEFAULT 'pending',
ADD COLUMN processing_error TEXT;

-- Add constraints
ALTER TABLE screenshots
ADD CONSTRAINT valid_sharing_mode CHECK (sharing_mode IN ('public', 'private', 'password')),
ADD CONSTRAINT valid_processing_status CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
ADD CONSTRAINT password_required_for_protected CHECK (
  (sharing_mode = 'password' AND password_hash IS NOT NULL) OR
  (sharing_mode != 'password')
);

-- Create indexes
CREATE INDEX idx_screenshots_file_hash ON screenshots(user_id, file_hash);

-- Create view_events table
CREATE TABLE view_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screenshot_id UUID NOT NULL REFERENCES screenshots(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_hash TEXT NOT NULL,
  country TEXT,
  is_authenticated BOOLEAN DEFAULT false,
  is_owner BOOLEAN DEFAULT false,
  user_agent_hash TEXT
);

CREATE INDEX idx_view_events_screenshot ON view_events(screenshot_id, viewed_at DESC);

-- Enable RLS
ALTER TABLE view_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own screenshot analytics"
ON view_events FOR SELECT
USING (
  screenshot_id IN (
    SELECT id FROM screenshots WHERE user_id = auth.uid()
  )
);

-- Create other tables (daily_view_stats, upload_sessions) ...
-- (Copy from data-model.md)
```

```bash
# Apply migration
supabase db push

# Or for production
supabase migration up
```

#### 1.2 Create Database Triggers

```sql
-- Copy triggers from data-model.md
-- Run via Supabase SQL Editor or migration
```

#### 1.3 Verify Setup

```bash
# Test quota trigger
psql $DATABASE_URL -c "
  INSERT INTO screenshots (user_id, short_id, storage_path, original_filename, file_size, width, height, mime_type, file_hash)
  VALUES ('test-user-id', 'test123', 'test/path.png', 'test.png', 1024, 100, 100, 'image/png', 'hash123');
"

# Check monthly_usage was updated
```

**Success Criteria**:
- ✅ All tables created
- ✅ RLS policies active
- ✅ Triggers firing correctly
- ✅ Indexes in place

---

### Phase 2: Core Upload API (Days 2-3)

**Goal**: Implement signed URL generation and upload completion

#### 2.1 Create Library Module for Upload Logic

```bash
mkdir -p lib/uploads
touch lib/uploads/index.ts lib/uploads/types.ts lib/uploads/storage.ts
```

**File: `lib/uploads/types.ts`**
```typescript
export interface InitUploadRequest {
  filename: string
  fileSize: number
  mimeType: string
  sharingMode?: 'public' | 'private' | 'password'
  password?: string
  expiresIn?: number | null
}

export interface InitUploadResponse {
  uploadSessionId: string
  signedUrl: string
  token: string
  filePath: string
  expiresAt: string
}

export interface CompleteUploadRequest {
  uploadSessionId: string
}

export interface CompleteUploadResponse {
  screenshotId: string
  shortId: string
  shareUrl: string
  status: 'processing' | 'completed'
}
```

**File: `lib/uploads/storage.ts`**
```typescript
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function generateFilePath(
  userId: string,
  filename: string
): Promise<{ path: string; hash: string }> {
  // Generate file hash (will be replaced with actual file hash later)
  const hash = crypto.randomBytes(16).toString('hex').substring(0, 8)
  const timestamp = Date.now()
  const extension = filename.split('.').pop()

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')

  const path = `${userId}/${year}/${month}/${hash}-${timestamp}.${extension}`

  return { path, hash }
}

export async function createSignedUploadUrl(
  filePath: string
): Promise<{ signedUrl: string; token: string }> {
  const { data, error } = await supabaseAdmin.storage
    .from('screenshots')
    .createSignedUploadUrl(filePath, { upsert: true })

  if (error) throw error

  return {
    signedUrl: data.signedUrl,
    token: data.token
  }
}
```

#### 2.2 Create Upload API Routes

**File: `app/api/upload/init/route.ts`**
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { generateFilePath, createSignedUploadUrl } from '@/lib/uploads/storage'
import type { InitUploadRequest, InitUploadResponse } from '@/lib/uploads/types'

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookies().get(name)?.value
          }
        }
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse request
    const body: InitUploadRequest = await request.json()

    // Validate
    if (!body.filename || !body.fileSize || !body.mimeType) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check file size
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    if (body.fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'FILE_TOO_LARGE', message: 'File size exceeds 10MB limit' },
        { status: 413 }
      )
    }

    // Check quota (will throw if exceeded due to trigger)
    const { path, hash } = await generateFilePath(user.id, body.filename)
    const { signedUrl, token } = await createSignedUploadUrl(path)

    // Create upload session
    const { data: session, error: sessionError } = await supabase
      .from('upload_sessions')
      .insert({
        user_id: user.id,
        filename: body.filename,
        file_size: body.fileSize,
        mime_type: body.mimeType,
        upload_status: 'pending',
        signed_url: signedUrl,
        signed_url_expires_at: new Date(Date.now() + 3600 * 1000).toISOString()
      })
      .select()
      .single()

    if (sessionError) throw sessionError

    const response: InitUploadResponse = {
      uploadSessionId: session.id,
      signedUrl,
      token,
      filePath: path,
      expiresAt: session.signed_url_expires_at
    }

    return NextResponse.json(response)

  } catch (error: any) {
    // Handle quota exceeded error from trigger
    if (error.message?.includes('quota exceeded')) {
      return NextResponse.json(
        {
          error: 'QUOTA_EXCEEDED',
          message: "You've reached your monthly limit. Upgrade to Pro for unlimited uploads."
        },
        { status: 403 }
      )
    }

    console.error('Upload init error:', error)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to initialize upload' },
      { status: 500 }
    )
  }
}
```

**File: `app/api/upload/[uploadSessionId]/complete/route.ts`**
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { encodeBase62 } from '@/lib/uploads/encoding'

export async function POST(
  request: NextRequest,
  { params }: { params: { uploadSessionId: string } }
) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookies().get(name)?.value
          }
        }
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    // Get upload session
    const { data: session, error: sessionError } = await supabase
      .from('upload_sessions')
      .select('*')
      .eq('id', params.uploadSessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    }

    // Generate short ID (use sequential counter in production)
    const shortId = encodeBase62(Date.now())

    // Create screenshot record
    const { data: screenshot, error: screenshotError } = await supabase
      .from('screenshots')
      .insert({
        user_id: user.id,
        short_id: shortId,
        storage_path: session.filename, // Use actual path from session
        original_filename: session.filename,
        file_size: session.file_size,
        width: 0, // Will be extracted during processing
        height: 0,
        mime_type: session.mime_type,
        file_hash: 'pending', // Will be computed during processing
        processing_status: 'processing'
      })
      .select()
      .single()

    if (screenshotError) throw screenshotError

    // Update upload session
    await supabase
      .from('upload_sessions')
      .update({
        upload_status: 'completed',
        screenshot_id: screenshot.id
      })
      .eq('id', session.id)

    // TODO: Trigger image processing (Phase 3)

    return NextResponse.json({
      screenshotId: screenshot.id,
      shortId,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/${shortId}`,
      status: 'processing'
    })

  } catch (error) {
    console.error('Complete upload error:', error)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
```

**File: `lib/uploads/encoding.ts`**
```typescript
const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export function encodeBase62(num: number): string {
  if (num === 0) return BASE62_ALPHABET[0]

  let result = ''
  while (num > 0) {
    result = BASE62_ALPHABET[num % 62] + result
    num = Math.floor(num / 62)
  }
  return result
}

export function decodeBase62(str: string): number {
  let result = 0
  for (let i = 0; i < str.length; i++) {
    result = result * 62 + BASE62_ALPHABET.indexOf(str[i])
  }
  return result
}
```

#### 2.3 Test Upload Flow

```bash
# Create test file
curl -X POST http://localhost:3000/api/upload/init \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "test.png",
    "fileSize": 1024,
    "mimeType": "image/png"
  }'

# Should return uploadSessionId and signedUrl
```

**Success Criteria**:
- ✅ `/api/upload/init` returns signed URL
- ✅ Quota checked before upload
- ✅ Upload session created in database
- ✅ Can complete upload and get short ID

---

### Phase 3: Share Link Viewing (Day 4)

**Goal**: Implement public screenshot viewing with access control

#### 3.1 Create Share Page

**File: `app/[shortId]/page.tsx`**
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import Image from 'next/image'

export default async function SharePage({ params }: { params: { shortId: string } }) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookies().get(name)?.value
        }
      }
    }
  )

  // Fetch screenshot
  const { data: screenshot, error } = await supabase
    .from('screenshots')
    .select('*')
    .eq('short_id', params.shortId)
    .single()

  if (error || !screenshot) {
    notFound()
  }

  // Check expiration
  if (screenshot.expires_at && new Date(screenshot.expires_at) < new Date()) {
    return <ExpiredView screenshot={screenshot} />
  }

  // Check access control
  if (screenshot.sharing_mode === 'password') {
    return <PasswordProtectedView shortId={params.shortId} />
  }

  if (screenshot.sharing_mode === 'private') {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return <LoginRequired />
    }
  }

  // Get signed URL for image
  const { data: urlData } = await supabase.storage
    .from('screenshots')
    .createSignedUrl(screenshot.storage_path, 3600)

  // Track view (client-side)
  return (
    <div>
      <Image
        src={urlData?.signedUrl || ''}
        alt={screenshot.original_filename}
        width={screenshot.width}
        height={screenshot.height}
      />
      <ViewTracker shortId={params.shortId} />
    </div>
  )
}
```

#### 3.2 Create View Tracking API

**File: `app/api/share/[shortId]/track/route.ts`**
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: { shortId: string } }
) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // Service role to bypass RLS
    )

    // Get screenshot
    const { data: screenshot } = await supabase
      .from('screenshots')
      .select('id, user_id')
      .eq('short_id', params.shortId)
      .single()

    if (!screenshot) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
    }

    // Get viewer info
    const { data: { user } } = await supabase.auth.getUser()
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown'
    const userAgent = request.headers.get('user-agent') || ''

    // Hash IP for privacy
    const ipHash = crypto
      .createHash('sha256')
      .update(ipAddress + process.env.IP_SALT)
      .digest('hex')

    // Check if viewer is owner
    const isOwner = user?.id === screenshot.user_id

    // Log view event
    await supabase.from('view_events').insert({
      screenshot_id: screenshot.id,
      ip_hash: ipHash,
      country: getCountryFromIp(ipAddress), // Implement using Vercel geolocation
      is_authenticated: !!user,
      is_owner: isOwner
    })

    return new NextResponse(null, { status: 204 })

  } catch (error) {
    console.error('Track view error:', error)
    return new NextResponse(null, { status: 204 }) // Fail silently
  }
}

function getCountryFromIp(ip: string): string | null {
  // TODO: Implement using Vercel Edge geolocation
  return null
}
```

**Success Criteria**:
- ✅ Public screenshots viewable
- ✅ View tracking works
- ✅ Expired screenshots show message
- ✅ Password protection blocks access

---

### Phase 4: Dashboard UI (Day 5)

**Goal**: Build screenshot management dashboard

#### 4.1 Create Screenshot List Component

**File: `app/dashboard/screenshots/page.tsx`**
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { ScreenshotGrid } from '@/components/screenshots/ScreenshotGrid'

export default async function ScreenshotsPage() {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookies().get(name)?.value
        }
      }
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Fetch user's screenshots
  const { data: screenshots } = await supabase
    .from('screenshots')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div>
      <h1>My Screenshots</h1>
      <ScreenshotGrid screenshots={screenshots || []} />
    </div>
  )
}
```

**Success Criteria**:
- ✅ User can see their screenshots
- ✅ Pagination works
- ✅ Sorting works
- ✅ Bulk delete works

---

### Phase 5: Image Optimization (Day 6)

**Goal**: Implement automatic image optimization using Supabase transformations

#### 5.1 Update Image URLs with Transformations

```typescript
// In share page
const { data: thumbData } = await supabase.storage
  .from('screenshots')
  .getPublicUrl(screenshot.storage_path, {
    transform: {
      width: 200,
      height: 150,
      resize: 'cover',
      quality: 75
    }
  })

// Use thumbData.publicUrl for thumbnail
```

**Success Criteria**:
- ✅ Thumbnails load quickly
- ✅ Full images optimized
- ✅ CDN caching works

---

### Phase 6: Testing (Day 7)

**Goal**: Write comprehensive tests

#### 6.1 Unit Tests

**File: `lib/uploads/__tests__/storage.test.ts`**
```typescript
import { describe, it, expect } from 'vitest'
import { generateFilePath, encodeBase62 } from '../storage'

describe('Upload Storage', () => {
  it('generates valid file paths', async () => {
    const { path } = await generateFilePath('user-123', 'test.png')
    expect(path).toMatch(/^user-123\/\d{4}\/\d{2}\//)
  })

  it('encodes base62 correctly', () => {
    expect(encodeBase62(0)).toBe('0')
    expect(encodeBase62(62)).toBe('10')
    expect(encodeBase62(100)).toBe('1C')
  })
})
```

#### 6.2 Integration Tests

**File: `app/api/upload/__tests__/init.test.ts`**
```typescript
import { describe, it, expect } from 'vitest'
import { POST } from '../init/route'

describe('POST /api/upload/init', () => {
  it('requires authentication', async () => {
    const request = new Request('http://localhost/api/upload/init', {
      method: 'POST',
      body: JSON.stringify({
        filename: 'test.png',
        fileSize: 1024,
        mimeType: 'image/png'
      })
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })
})
```

**Success Criteria**:
- ✅ Unit tests pass
- ✅ Integration tests pass
- ✅ E2E tests pass

---

## Testing Checklist

### Manual Testing

- [ ] Upload screenshot from browser extension
- [ ] View shared link (public)
- [ ] View shared link (password protected)
- [ ] Verify quota enforcement (free user, 10 screenshots)
- [ ] Delete screenshot
- [ ] Bulk delete screenshots
- [ ] Check analytics dashboard
- [ ] Verify expiration works
- [ ] Test with different image formats (PNG, JPEG, WEBP)
- [ ] Test file size limits (reject >10MB)

### Automated Testing

- [ ] Unit tests for upload logic
- [ ] Integration tests for API routes
- [ ] E2E tests for upload flow
- [ ] E2E tests for viewing flow

---

## Deployment Checklist

- [ ] Database migrations applied
- [ ] Environment variables set
- [ ] Storage bucket configured
- [ ] RLS policies active
- [ ] Rate limiting configured
- [ ] CDN caching verified
- [ ] Error tracking setup (Sentry)
- [ ] Performance monitoring setup

---

## Troubleshooting

### Upload fails with 403 Forbidden
- Check Supabase storage RLS policies
- Verify signed URL hasn't expired
- Check user authentication

### Quota not enforced
- Verify database trigger is active
- Check `monthly_usage` table updates
- Review trigger logs in Supabase

### Images not loading
- Check storage bucket is public
- Verify signed URLs are generated correctly
- Check CORS settings

### View tracking not working
- Check RLS policies on `view_events` table
- Verify service role key is set
- Review API route logs

---

## Next Steps

After implementing core functionality:

1. Add browser extension integration
2. Implement real-time progress updates
3. Add password protection UI
4. Build analytics dashboard
5. Optimize performance (caching, CDN)
6. Add email notifications (optional)
7. Implement cleanup jobs (pg_cron)
