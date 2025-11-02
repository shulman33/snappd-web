# Authentication System Developer Quickstart

**Feature**: Comprehensive Authentication System
**Last Updated**: 2025-11-02

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Supabase Configuration](#supabase-configuration)
4. [OAuth Provider Setup](#oauth-provider-setup)
5. [Rate Limiting Setup](#rate-limiting-setup)
6. [Database Migrations](#database-migrations)
7. [Running the Development Server](#running-the-development-server)
8. [Testing](#testing)
9. [Common Development Tasks](#common-development-tasks)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- **Node.js**: 20.x or later
- **npm**: 10.x or later (or pnpm/yarn equivalent)
- **Git**: For version control
- **Supabase Account**: [supabase.com](https://supabase.com)
- **Vercel Account** (optional): For deployment and KV Redis

### Required Knowledge
- TypeScript fundamentals
- Next.js 15 App Router
- React Server Components vs Client Components
- Basic understanding of authentication concepts

---

## Environment Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-org/snappd-web.git
cd snappd-web
git checkout 005-auth-system
```

### 2. Install Dependencies
```bash
npm install

# Install additional auth-specific packages
npm install @supabase/supabase-js @supabase/ssr zod @upstash/ratelimit @vercel/kv stripe
npm install -D @types/node
```

### 3. Create Environment File
```bash
cp .env.example .env.local
```

### 4. Configure Environment Variables
Edit `.env.local` with your credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://iitxfjhnywekstxagump.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# OAuth Providers
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Upstash Redis (Rate Limiting)
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# Stripe (Optional for local development)
STRIPE_SECRET_KEY=sk_test_your_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

---

## Supabase Configuration

### 1. Access Supabase Dashboard
Navigate to: https://supabase.com/dashboard/project/iitxfjhnywekstxagump

### 2. Get API Keys
1. Go to **Settings** → **API**
2. Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
3. Copy **anon** **public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Copy **service_role** key (keep secret!) → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Configure Auth Settings
1. Go to **Authentication** → **Settings**
2. Set **Site URL**: `http://localhost:3000`
3. Add **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/github`

### 4. Enable Email Confirmations
1. Go to **Authentication** → **Settings** → **Email**
2. Enable **Confirm email**
3. Customize email templates (optional)

### 5. Configure Email Provider (Development)
For development, use Supabase's built-in SMTP:
- Emails will be logged in **Authentication** → **Logs**
- Check for confirmation links in logs

For production, configure a custom SMTP provider (SendGrid, AWS SES, etc.)

---

## OAuth Provider Setup

### Google OAuth

#### 1. Create Google Cloud Project
1. Go to https://console.cloud.google.com
2. Create new project or select existing
3. Enable **Google+ API**

#### 2. Create OAuth Credentials
1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Name: `Snappd Web (Development)`
5. **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://iitxfjhnywekstxagump.supabase.co/auth/v1/callback`

#### 3. Configure in Supabase
1. Go to **Authentication** → **Providers**
2. Enable **Google**
3. Paste **Client ID** and **Client Secret**
4. Click **Save**

#### 4. Add to .env.local
```env
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

### GitHub OAuth

#### 1. Create GitHub OAuth App
1. Go to https://github.com/settings/developers
2. Click **New OAuth App**
3. Fill in:
   - **Application name**: `Snappd Web (Development)`
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`

#### 2. Get Credentials
1. Copy **Client ID**
2. Generate **Client Secret**
3. Save both securely

#### 3. Configure in Supabase
1. Go to **Authentication** → **Providers**
2. Enable **GitHub**
3. Paste **Client ID** and **Client Secret**
4. Click **Save**

#### 4. Add to .env.local
```env
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

---

## Rate Limiting Setup

### Option 1: Vercel KV (Recommended for Production)

#### 1. Create Vercel KV Database
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Link project
vercel link

# Create KV database
vercel kv create
```

#### 2. Copy Environment Variables
Vercel will output environment variables. Copy them to `.env.local`:
```env
KV_URL=...
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
KV_REST_API_READ_ONLY_TOKEN=...
```

#### 3. Pull Environment Variables
```bash
vercel env pull .env.local
```

### Option 2: Upstash Redis (Alternative)

#### 1. Create Upstash Account
Sign up at: https://console.upstash.com

#### 2. Create Redis Database
1. Click **Create Database**
2. Name: `snappd-rate-limit`
3. Region: Choose closest to your users
4. Type: **Regional** (free tier available)

#### 3. Get Credentials
1. Navigate to your database
2. Copy **REST URL** and **REST Token**

#### 4. Add to .env.local
```env
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
```

### Option 3: Local Redis (Development Only)

```bash
# Install Redis (macOS)
brew install redis

# Start Redis
redis-server

# Use local URL
UPSTASH_REDIS_REST_URL=redis://localhost:6379
UPSTASH_REDIS_REST_TOKEN=not_needed_for_local
```

**Note**: Local Redis won't work with Vercel Edge Functions. Use Upstash/Vercel KV for deployment.

---

## Database Migrations

### 1. Install Supabase CLI
```bash
npm install -g supabase
```

### 2. Link to Project
```bash
supabase link --project-ref iitxfjhnywekstxagump
```

### 3. Run Migrations
```bash
# Apply all pending migrations
supabase db push

# Or apply specific migration
supabase db push --migration-id 20251102_auth_system
```

### 4. Verify Migrations
```bash
# Check migration status
supabase migration list

# View database schema
supabase db diff
```

### Required Migrations

**Migration**: `20251102_add_auth_events_table.sql`
```sql
-- Create auth_events table for audit logging
CREATE TABLE auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  ip_address INET NOT NULL,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_auth_events_type ON auth_events(event_type);
CREATE INDEX idx_auth_events_user ON auth_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_auth_events_email ON auth_events(email) WHERE email IS NOT NULL;
CREATE INDEX idx_auth_events_ip ON auth_events(ip_address);
CREATE INDEX idx_auth_events_created ON auth_events(created_at DESC);
CREATE INDEX idx_auth_events_rate_limit
  ON auth_events(event_type, email, created_at)
  WHERE event_type IN ('login_failure', 'password_reset', 'magic_link', 'verification_resend');

-- RLS
ALTER TABLE auth_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON auth_events USING (auth.role() = 'service_role');
```

**Migration**: `20251102_add_profile_trigger.sql`
```sql
-- Trigger to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, plan, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'free',
    NOW(),
    NOW()
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Failed to create profile for user %: %', NEW.id, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

---

## Running the Development Server

### 1. Start Development Server
```bash
npm run dev
```

Access at: http://localhost:3000

### 2. Verify Environment
Open http://localhost:3000/api/auth/health (if health check exists)

### 3. Check Logs
```bash
# Watch auth logs in Supabase
supabase functions logs --tail

# Or view in dashboard
# https://supabase.com/dashboard/project/iitxfjhnywekstxagump/auth/logs
```

---

## Testing

### Run Unit Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test src/lib/schemas/auth.test.ts

# Run with coverage
npm test -- --coverage
```

### Run Integration Tests
```bash
# Requires test database
npm run test:integration
```

### Run E2E Tests
```bash
# Install Playwright
npx playwright install

# Run E2E tests
npm run test:e2e

# Run specific E2E test
npx playwright test tests/e2e/auth/signup.spec.ts

# Debug mode
npx playwright test --debug
```

### Manual API Testing

#### Test Signup
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234!",
    "fullName": "Test User"
  }'
```

#### Test Signin
```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234!"
  }' \
  -c cookies.txt
```

#### Test Get User
```bash
curl -X GET http://localhost:3000/api/auth/user \
  -b cookies.txt
```

---

## Common Development Tasks

### Generate TypeScript Types from Database
```bash
# Generate types from Supabase schema
supabase gen types typescript --project-id iitxfjhnywekstxagump > src/types/supabase.ts
```

### Reset Local Database
```bash
supabase db reset
```

### View Real-time Auth Events
```bash
# In Supabase dashboard:
# Authentication → Logs → Real-time logs
```

### Test Email Templates
1. Trigger signup/reset password
2. Check Supabase logs for email content
3. Copy verification/reset URL
4. Test in browser

### Debug Rate Limiting
```bash
# Check Redis keys
redis-cli KEYS "ratelimit:*"

# View rate limit data
redis-cli GET "ratelimit:ip:127.0.0.1"
```

---

## Troubleshooting

### Issue: "Invalid API key"
**Solution**: Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` matches Supabase dashboard.

### Issue: "CORS error on OAuth callback"
**Solution**:
1. Check redirect URI in Google/GitHub OAuth app matches exactly
2. Verify redirect URI added to Supabase auth settings
3. Ensure `NEXT_PUBLIC_APP_URL` is set correctly

### Issue: "Rate limit not working"
**Solution**:
1. Verify Upstash/Vercel KV credentials
2. Check middleware is running: `console.log` in `middleware.ts`
3. Ensure `@upstash/ratelimit` is installed

### Issue: "Profile not created after signup"
**Solution**:
1. Check trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`
2. View trigger function: `\df handle_new_user` in psql
3. Check Supabase logs for errors

### Issue: "Session not persisting"
**Solution**:
1. Verify cookies are being set: Check browser DevTools → Application → Cookies
2. Check `middleware.ts` is calling `updateSession()`
3. Ensure `HttpOnly`, `Secure`, `SameSite` flags are correct

### Issue: "Email not sending"
**Solution**:
1. Check **Authentication** → **Settings** → **Email** is configured
2. For development, check Supabase logs for email content
3. For production, verify SMTP credentials

### Need Help?
- Check [research.md](./research.md) for implementation patterns
- Review [data-model.md](./data-model.md) for database schema
- See [contracts/](./contracts/) for API specifications
- Join #auth-system channel in project Discord/Slack

---

## Next Steps

1. ✅ Complete environment setup
2. ✅ Run database migrations
3. ✅ Test signup/signin flows manually
4. → Implement API routes (see [plan.md](./plan.md))
5. → Write unit tests (TDD approach)
6. → Implement UI components (separate feature)
7. → Deploy to Vercel staging environment

**Ready to start implementing!** Refer to `plan.md` for the full implementation roadmap and `tasks.md` for step-by-step implementation tasks.
