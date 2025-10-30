# snappd - Lightning-Fast Screenshot Sharing

**Version**: 1.0.0  
**Status**: MVP Complete ✅  
**Tech Stack**: Next.js 15, Supabase, Stripe, TypeScript

## Overview

snappd is a modern screenshot sharing platform with a focus on speed and simplicity. Upload screenshots, get shareable links instantly, and manage your screenshot library with powerful search and filtering.

## Features

### ✅ Core Features (MVP)
- 🚀 **Lightning-fast uploads**: <10 second upload-to-share workflow
- 🔗 **Short shareable URLs**: `snappd.app/s/abc123`
- 👁️ **View tracking**: Monitor screenshot engagement
- 🔒 **Secure authentication**: Email/password with Supabase Auth
- 💳 **Freemium pricing**: 10 screenshots/month (free) or unlimited (pro)
- 📊 **Usage analytics**: Track uploads, storage, and bandwidth
- 🗑️ **GDPR compliance**: Full account deletion

### 🛠️ Technical Features
- **API-first architecture**: RESTful API with 15 endpoints
- **Row-level security (RLS)**: Multi-tenant data isolation
- **Rate limiting**: Prevent abuse with Upstash Redis
- **Image optimization**: WebP conversion with Sharp
- **CDN delivery**: Supabase Storage with global edge network
- **Webhook handling**: Stripe subscription lifecycle management

## Quick Start

### Prerequisites
- Node.js 18+
- Supabase account (free tier)
- Stripe account (test mode)
- Vercel account (optional, for deployment)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/snappd-web.git
cd snappd-web

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Run database migrations
# See specs/001-api-backend/quickstart.md for Supabase setup

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the API.

### Testing

```bash
# Run unit tests
npm test

# Run contract tests (API endpoints)
npm run test:contract

# Run with coverage
npm run test:coverage
```

## Documentation

- **[API Documentation](./API.md)** - Complete API reference
- **[Quick Start Guide](./specs/001-api-backend/quickstart.md)** - Detailed setup instructions
- **[Data Model](./specs/001-api-backend/data-model.md)** - Database schema
- **[OpenAPI Contracts](./specs/001-api-backend/contracts/)** - API specifications
- **[Technical Plan](./specs/001-api-backend/plan.md)** - Architecture decisions

## Project Structure

```
snappd-web/
├── src/
│   ├── app/api/          # API routes (Next.js App Router)
│   │   ├── auth/         # Authentication endpoints
│   │   ├── screenshots/  # Screenshot management
│   │   ├── billing/      # Stripe integration
│   │   ├── usage/        # Usage tracking
│   │   └── s/[shortId]/  # Public viewer
│   ├── lib/              # Shared utilities
│   │   ├── supabase.ts   # Database client
│   │   ├── stripe.ts     # Payment client
│   │   ├── validation.ts # Zod schemas
│   │   ├── storage.ts    # File upload utilities
│   │   ├── rate-limit.ts # Rate limiting
│   │   ├── short-id.ts   # URL generation
│   │   └── errors.ts     # Error handling
│   └── types/            # TypeScript definitions
├── tests/                # Test suites
│   ├── contract/         # API endpoint tests
│   ├── integration/      # Workflow tests
│   └── unit/             # Library tests
├── supabase/
│   └── migrations/       # Database migrations
└── specs/                # Feature specifications

```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create account
- `GET /api/auth/me` - Get profile
- `PATCH /api/auth/me` - Update profile
- `POST /api/auth/delete` - Delete account

### Screenshots
- `POST /api/upload/signed-url` - Get upload URL
- `POST /api/screenshots` - Create screenshot metadata
- `GET /api/screenshots` - List screenshots (paginated)
- `GET /api/screenshots/[id]` - Get screenshot
- `PATCH /api/screenshots/[id]` - Update screenshot
- `DELETE /api/screenshots/[id]` - Delete screenshot
- `GET /api/screenshots/[id]/download` - Download screenshot
- `GET /api/s/[shortId]` - Public viewer (no auth)

### Billing & Usage
- `POST /api/billing/checkout` - Start upgrade flow
- `GET /api/billing/portal` - Manage subscription
- `POST /api/billing/webhook` - Stripe webhooks
- `GET /api/usage` - Current month stats
- `GET /api/usage/history` - Historical stats

## Environment Variables

Required environment variables (see `.env.example`):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_PRICE_ID=price_xxxxx

# Vercel KV (optional in development)
KV_REST_API_URL=https://xxxxx.kv.vercel-storage.com
KV_REST_API_TOKEN=xxxxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Configure environment variables in Vercel Dashboard
# Set up Stripe webhook endpoint: https://your-app.vercel.app/api/billing/webhook
```

### Manual Deployment

1. Build the application: `npm run build`
2. Configure environment variables
3. Run migrations: `supabase db push`
4. Start server: `npm start`

## Performance

- **API Response Time**: <200ms (p95)
- **Upload Time**: <10s for 10MB files
- **CDN Delivery**: Global edge network
- **Rate Limits**: 10 uploads/min, 100 API requests/min

## Tech Stack

- **Framework**: Next.js 15.5.5 (App Router)
- **Language**: TypeScript 5
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage (CDN)
- **Authentication**: Supabase Auth
- **Payments**: Stripe
- **Rate Limiting**: Upstash Redis (Vercel KV)
- **Validation**: Zod
- **Testing**: Vitest + Playwright
- **Deployment**: Vercel

## Contributing

This is a private project. For questions or issues, contact the maintainer.

## License

Proprietary - All rights reserved

## Support

- **Documentation**: `/specs/001-api-backend/`
- **API Reference**: `/API.md`
- **Issues**: GitHub Issues (private repo)
