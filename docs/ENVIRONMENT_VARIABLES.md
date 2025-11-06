# Environment Variables Guide

This document explains where to find and how to configure each environment variable for the Snappd project.

## Quick Start

1. Copy the example file to create your local environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Follow the sections below to fill in your actual values

3. **Never commit `.env.local` to version control** - it's already in `.gitignore`

---

## Next.js Configuration

### `NEXT_PUBLIC_BASE_URL`
**Required**: Yes
**Where to get it**: This is your application's base URL
- **Development**: `http://localhost:3000`
- **Production**: Your deployed URL (e.g., `https://snappd.app`)

### `NODE_ENV`
**Required**: Auto-set by Next.js
**Where to get it**: Set automatically by Next.js
- `development` - when running `npm run dev`
- `production` - when running `npm run build` and `npm start`
- `test` - when running tests

---

## Supabase Configuration

All Supabase credentials can be found in your [Supabase Dashboard](https://supabase.com/dashboard).

### `NEXT_PUBLIC_SUPABASE_URL`
**Required**: Yes
**Where to get it**:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project (Project ID: `iitxfjhnywekstxagump`)
3. Navigate to **Settings** → **API**
4. Copy the **Project URL** (e.g., `https://iitxfjhnywekstxagump.supabase.co`)

**Note**: This is safe to expose to client-side code.

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
**Required**: Yes
**Where to get it**:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy the **Project API keys** → **anon** / **public** key

**Note**: This key is safe to use in client-side code because it's protected by Row Level Security (RLS) policies on your database.

### `SUPABASE_SERVICE_ROLE_KEY`
**Required**: Only for server-side operations that bypass RLS
**Where to get it**:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy the **Project API keys** → **service_role** key
5. Click "Reveal" to see the full key

**⚠️ CRITICAL WARNING**:
- **NEVER** expose this key in client-side code
- **NEVER** commit this to version control
- This key bypasses ALL Row Level Security policies
- Only use for trusted server-side operations

### `DATABASE_URL`
**Required**: Optional (only if you need direct database access)
**Where to get it**:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **Database**
4. Scroll to **Connection string** → **URI**
5. Copy the connection string

**Format**: `postgresql://postgres:[YOUR-PASSWORD]@db.your-project.supabase.co:5432/postgres`

**Note**: Replace `[YOUR-PASSWORD]` with your database password (set during project creation).

---

## Stripe Configuration

All Stripe credentials can be found in your [Stripe Dashboard](https://dashboard.stripe.com).

### `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
**Required**: Yes (for payment processing)
**Where to get it**:
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **API keys**
3. Copy the **Publishable key**
   - For development: Use **Test mode** key (starts with `pk_test_`)
   - For production: Use **Live mode** key (starts with `pk_live_`)

**Note**: This is safe to expose in client-side code.

### `STRIPE_SECRET_KEY`
**Required**: Yes (for server-side payment operations)
**Where to get it**:
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **API keys**
3. Click "Reveal test key" or "Reveal live key"
4. Copy the **Secret key**
   - For development: Use **Test mode** key (starts with `sk_test_`)
   - For production: Use **Live mode** key (starts with `sk_live_`)

**⚠️ CRITICAL WARNING**:
- **NEVER** expose this key in client-side code
- **NEVER** commit this to version control
- This key has full access to your Stripe account

### `STRIPE_WEBHOOK_SECRET`
**Required**: Yes (for webhook verification)
**Where to get it**:
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **Webhooks**
3. Click **Add endpoint** (or select existing endpoint)
4. For development:
   - Use Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
   - Copy the webhook signing secret from the CLI output
5. For production:
   - Enter your webhook URL: `https://yourdomain.com/api/webhooks/stripe`
   - Select events to listen for (e.g., `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`)
   - After creating, click the endpoint to reveal the **Signing secret**

**Format**: Starts with `whsec_`

### Stripe Price IDs

These are the product price IDs for your subscription plans. You need to create products in Stripe first.

**How to create and get Price IDs**:

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Products** → **Add product**
3. Create each subscription tier:

#### Pro Plan Monthly (`STRIPE_PRICE_ID_PRO_MONTHLY`)
- Name: "Pro Plan"
- Pricing: Recurring → Monthly
- Price: Your pro tier monthly price
- Copy the **Price ID** (starts with `price_`)

#### Pro Plan Yearly (`STRIPE_PRICE_ID_PRO_YEARLY`)
- Use the same product as above
- Add a new price: Recurring → Yearly
- Price: Your pro tier yearly price
- Copy the **Price ID**

#### Team Plan Monthly (`STRIPE_PRICE_ID_TEAM_MONTHLY`)
- Create a new product: "Team Plan"
- Pricing: Recurring → Monthly
- Price: Your team tier monthly price
- Copy the **Price ID**

#### Team Plan Yearly (`STRIPE_PRICE_ID_TEAM_YEARLY`)
- Use the Team Plan product
- Add a new price: Recurring → Yearly
- Price: Your team tier yearly price
- Copy the **Price ID**

**Note**: Test mode and Live mode have separate Price IDs. Use test Price IDs during development.

---

## OAuth Provider Configuration

Configure OAuth providers for social authentication via Supabase Auth.

### Google OAuth

**Where to get credentials**:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Application type: **Web application**
6. Authorized redirect URIs: Add your Supabase callback URL
   - Format: `https://your-project.supabase.co/auth/v1/callback`
   - For your project: `https://iitxfjhnywekstxagump.supabase.co/auth/v1/callback`
7. Copy the **Client ID** and **Client Secret**

**Configure in Supabase**:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Google** and enable it
5. Paste your **Client ID** and **Client Secret**
6. Save

### GitHub OAuth

**Where to get credentials**:
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in details:
   - Application name: "Snappd"
   - Homepage URL: `https://snappd.app` (or your domain)
   - Authorization callback URL: `https://iitxfjhnywekstxagump.supabase.co/auth/v1/callback`
4. Click **Register application**
5. Copy the **Client ID**
6. Click **Generate a new client secret** and copy it

**Configure in Supabase**:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **GitHub** and enable it
5. Paste your **Client ID** and **Client Secret**
6. Save

---

## Email Service Configuration

### SendGrid (Recommended)

Snappd uses SendGrid for transactional email delivery. This provides better deliverability, analytics, and customization compared to default SMTP providers.

#### `SENDGRID_API_KEY`
**Required**: Yes
**Where to get it**:
1. Go to [SendGrid](https://sendgrid.com)
2. Sign up for a free account (100 emails/day free tier)
3. Navigate to **Settings** → **API Keys**
4. Click **Create API Key**
5. Name: "Snappd Production" (or "Snappd Development")
6. Permissions: Select **Full Access** (or **Restricted Access** with Mail Send enabled)
7. Click **Create & View**
8. Copy the key (starts with `SG.`)

**⚠️ CRITICAL WARNING**:
- Save this key immediately - you won't be able to see it again
- **NEVER** expose this key in client-side code
- **NEVER** commit this to version control
- Use different API keys for development and production

#### `SENDGRID_FROM_EMAIL`
**Required**: Yes
**Default**: `noreply@snappd.app`
**Where to configure**:
1. Go to [SendGrid Dashboard](https://app.sendgrid.com)
2. Navigate to **Settings** → **Sender Authentication**
3. Choose one of two options:

**Option A: Single Sender Verification (Recommended for development)**
- Click **Verify a Single Sender**
- Enter your email address (e.g., `noreply@yourdomain.com`)
- Fill in sender details (name, address)
- Click **Create**
- Check your email and click the verification link
- Use this verified email address as `SENDGRID_FROM_EMAIL`

**Option B: Domain Authentication (Recommended for production)**
- Click **Authenticate Your Domain**
- Enter your domain (e.g., `snappd.app`)
- Follow DNS configuration steps
- After verification, you can use any email from that domain

**Example values**:
- Development: `dev@youremail.com` (single sender)
- Production: `noreply@snappd.app` (authenticated domain)

#### `SENDGRID_FROM_NAME`
**Required**: No
**Default**: `Snappd`
**Example**: `"Snappd"` or `"Snappd Team"`

This is the sender name that appears in the "From" field of emails.

### Configure Supabase to Use SendGrid SMTP

To route Supabase Auth emails through SendGrid:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project (`iitxfjhnywekstxagump`)
3. Navigate to **Project Settings** → **Authentication**
4. Scroll to **SMTP Settings**
5. Click **Enable Custom SMTP**
6. Enter the following:
   - **Host**: `smtp.sendgrid.net`
   - **Port**: `587`
   - **Username**: `apikey` (exactly as written)
   - **Password**: Your SendGrid API Key (the value from `SENDGRID_API_KEY`)
   - **Sender email**: Same as `SENDGRID_FROM_EMAIL`
   - **Sender name**: Same as `SENDGRID_FROM_NAME`
7. Click **Save**

**Testing SMTP Configuration**:
1. In Supabase Dashboard → **Authentication** → **Email Templates**
2. Click **Send test email**
3. Enter your email address
4. Check if you receive the test email
5. Verify in SendGrid Dashboard → **Activity** that the email was processed

### SendGrid Email Templates (Optional)

For custom-branded emails, you can create dynamic templates in SendGrid:

1. Go to [SendGrid Dashboard](https://app.sendgrid.com)
2. Navigate to **Email API** → **Dynamic Templates**
3. Click **Create a Dynamic Template**
4. Create templates for:
   - Email Verification
   - Password Reset
   - Magic Link
   - Welcome Email

Each template gets a Template ID (format: `d-xxxxxxxxxxxxx`). You can reference these IDs in your application code for custom email designs.

### Alternative: Resend (Not Currently Integrated)

**Where to get it**:
1. Go to [Resend](https://resend.com)
2. Sign up or log in
3. Navigate to **API Keys**
4. Click **Create API Key**
5. Copy the key (starts with `re_`)

**Note**: Resend integration is not currently implemented. Use SendGrid instead.

---

## Analytics & Monitoring (Optional)

### Vercel Analytics

**Where to get it**:
1. Deploy your project to [Vercel](https://vercel.com)
2. Go to your project dashboard
3. Navigate to **Analytics** tab
4. Enable analytics
5. Copy the Analytics ID from settings

### Sentry (Error Tracking)

**Where to get it**:
1. Go to [Sentry](https://sentry.io)
2. Create a new project
3. Select **Next.js** as platform
4. Copy the **DSN** (Data Source Name)
5. Format: `https://[key]@[org].ingest.sentry.io/[project]`

### Google Analytics

**Where to get it**:
1. Go to [Google Analytics](https://analytics.google.com)
2. Create a new property
3. Select **Web** platform
4. Copy the **Measurement ID** (starts with `G-`)

---

## Rate Limiting & Security (Optional)

### Upstash Redis

**Where to get it**:
1. Go to [Upstash Console](https://console.upstash.com)
2. Create a new Redis database
3. Select region (choose one close to your deployment)
4. After creation, go to **Details** tab
5. Copy the **REST URL** and **REST Token**

**Use case**: Implement rate limiting for API routes, authentication attempts, and webhook handling.

---

## Development Tools

### `DEBUG`
**Required**: No
**Default**: `false`
**Values**: `true` or `false`

Set to `true` to enable detailed console logging during development.

### `SKIP_EMAIL_VERIFICATION`
**Required**: No
**Default**: `false`
**Values**: `true` or `false`

Set to `true` to skip email verification during development for faster testing. **Never use in production**.

---

## Security Best Practices

1. ✅ **Never commit `.env.local` to version control**
2. ✅ **Use test/development keys for local development**
3. ✅ **Rotate secrets regularly in production**
4. ✅ **Use different credentials for development and production**
5. ✅ **Store production secrets in your hosting platform's environment variables**
   - For Vercel: Project Settings → Environment Variables
   - For other platforms: Use their respective secret management
6. ✅ **Never share secrets via email, Slack, or other communication channels**
7. ✅ **Use `NEXT_PUBLIC_` prefix only for values that are safe to expose to the browser**

---

## Deployment Checklist

Before deploying to production:

- [ ] All required environment variables are set
- [ ] Using production API keys (not test keys)
- [ ] `NEXT_PUBLIC_BASE_URL` points to production domain
- [ ] Stripe webhook endpoint is configured for production URL
- [ ] OAuth redirect URIs include production domain
- [ ] Email service is configured and tested
- [ ] Database backups are enabled
- [ ] Secrets are stored in hosting platform's environment variable manager
- [ ] Test all authentication flows in production environment

---

## Troubleshooting

### "Invalid API key" errors
- Double-check that you're using the correct key for your environment (test vs. live)
- Ensure there are no extra spaces or line breaks when copying keys
- Verify the key hasn't been revoked in the Stripe or Supabase dashboard

### OAuth redirect errors
- Verify redirect URIs match exactly in OAuth provider settings
- Ensure Supabase callback URL is added to authorized redirect URIs
- Check that your domain is properly configured

### Webhook verification failures
- Ensure `STRIPE_WEBHOOK_SECRET` matches the endpoint secret
- Verify your webhook endpoint is publicly accessible
- Check Stripe Dashboard → Webhooks → Recent events for error details

### Supabase connection issues
- Verify project URL and keys are correct
- Check that your Supabase project is active (not paused)
- Ensure RLS policies are properly configured

---

## Need Help?

- **Supabase**: [Documentation](https://supabase.com/docs) | [Discord](https://discord.supabase.com)
- **Stripe**: [Documentation](https://stripe.com/docs) | [Support](https://support.stripe.com)
- **Next.js**: [Documentation](https://nextjs.org/docs) | [GitHub Discussions](https://github.com/vercel/next.js/discussions)
