# Quickstart Guide: Subscription Billing Implementation

**Feature**: `006-subscription-billing`
**Target**: Developers implementing the subscription billing system
**Time to Complete**: ~30 minutes for local setup

## Prerequisites

- ✅ Snappd development environment running (Next.js 15, Supabase)
- ✅ Stripe account created ([https://dashboard.stripe.com](https://dashboard.stripe.com))
- ✅ Node.js 20+ installed
- ✅ PostgreSQL 17+ via Supabase

## Step 1: Stripe Setup (10 minutes)

### 1.1 Create Stripe Products

```bash
# Navigate to Stripe Dashboard → Products
# Or use Stripe CLI:

stripe products create \
  --name="Snappd Pro (Monthly)" \
  --description="Unlimited uploads, password protection, extended retention"

stripe prices create \
  --product=prod_XXX \
  --unit-amount=900 \
  --currency=usd \
  --recurring[interval]=month \
  --recurring[trial_period_days]=14

# Repeat for Pro Annual, Team Monthly, Team Annual
```

**Required Products & Prices**:

| Product | Price | Interval | Trial | Price ID (save for env) |
|---------|-------|----------|-------|-------------------------|
| Pro Monthly | $9.00 | month | 14 days | `price_pro_monthly` |
| Pro Annual | $90.00 | year | 14 days | `price_pro_annual` |
| Team Monthly (per seat) | $9.00 | month | 14 days | `price_team_monthly` |
| Team Annual (per seat) | $90.00 | year | 14 days | `price_team_annual` |

### 1.2 Configure Stripe Settings

1. **Enable Tax Calculation**:
   - Navigate to: Settings → Tax → Enable Stripe Tax
   - Add US sales tax nexus addresses if applicable

2. **Configure Customer Portal**:
   - Navigate to: Settings → Customer portal
   - Enable: Update payment methods, View invoices, Cancel subscriptions

3. **Set up Webhooks** (after deploying to production):
   - Navigate to: Developers → Webhooks → Add endpoint
   - URL: `https://your-domain.com/api/v1/billing/webhook`
   - Events to listen for:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `customer.subscription.trial_will_end`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
     - `invoice.finalized`

### 1.3 Get API Keys

```bash
# Get from: Developers → API keys
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...  # After creating webhook endpoint
```

## Step 2: Database Migration (5 minutes)

### 2.1 Create Supabase Migration

```bash
# Create new migration file
cd /Users/samshulman/Coding/My-Software-Projects/snappd-web
npx supabase migration new subscription_billing

# Copy schema from data-model.md to migration file
# File location: supabase/migrations/XXXXXX_subscription_billing.sql
```

### 2.2 Apply Migration

```bash
# Local development
npx supabase db push

# Production (after testing)
npx supabase db push --project-ref <project-id>
```

### 2.3 Verify Tables

```sql
-- Run in Supabase SQL Editor
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'subscriptions',
  'stripe_customers',
  'payment_methods',
  'teams',
  'team_members',
  'usage_records',
  'invoices',
  'credit_balances',
  'subscription_events',
  'dunning_attempts',
  'stripe_events'
);
-- Should return all 11 tables
```

## Step 3: Environment Configuration (5 minutes)

### 3.1 Update `.env.local`

```bash
# Add to existing .env.local

# Stripe Keys
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (from Step 1.1)
NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL=price_...
NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_TEAM_ANNUAL=price_...

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3.2 Validate Configuration

```bash
# Run configuration check
npm run billing:check-config

# Expected output:
# ✅ Stripe secret key configured
# ✅ Stripe publishable key configured
# ✅ All price IDs configured
# ✅ Webhook secret configured
# ✅ App URL configured
```

## Step 4: Install Dependencies (2 minutes)

```bash
# Install Stripe SDK
npm install stripe @stripe/stripe-js

# Verify installation
npm list stripe @stripe/stripe-js
```

## Step 5: Local Development Testing (8 minutes)

### 5.1 Start Stripe CLI

```bash
# Install Stripe CLI (if not already installed)
# macOS:
brew install stripe/stripe-brew/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/v1/billing/webhook
# Copy the webhook signing secret (whsec_...) to .env.local
```

### 5.2 Start Development Server

```bash
npm run dev
# Server should start on http://localhost:3000
```

### 5.3 Test Billing Flow

**Test Scenario: Pro Plan Upgrade**

1. **Navigate to Pricing Page**:
   ```bash
   open http://localhost:3000/pricing
   ```

2. **Click "Upgrade to Pro"**:
   - Select monthly billing
   - Should redirect to Stripe Checkout

3. **Use Test Card**:
   ```
   Card: 4242 4242 4242 4242
   Exp: Any future date
   CVC: Any 3 digits
   ZIP: Any 5 digits
   ```

4. **Complete Payment**:
   - Should redirect to success page
   - Check console for webhook events
   - Verify subscription in database:
     ```sql
     SELECT * FROM subscriptions WHERE user_id = '...';
     ```

5. **Verify Upload Quota**:
   - Navigate to upload page
   - Should show "Unlimited uploads" instead of "8/10 remaining"

### 5.4 Test Team Flow

1. **Create Team**:
   ```bash
   curl -X POST http://localhost:3000/api/v1/billing/teams \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Team",
       "seatCount": 3,
       "billingCycle": "monthly"
     }'
   ```

2. **Invite Member**:
   ```bash
   curl -X POST http://localhost:3000/api/v1/billing/teams/TEAM_ID/members \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com"}'
   ```

3. **Check Email**:
   - Open local email catcher (Mailhog/MailDev)
   - Should see team invitation email

## Common Issues & Troubleshooting

### Issue: "Stripe key not found"
**Solution**:
```bash
# Verify .env.local is in project root
ls -la .env.local

# Restart dev server
npm run dev
```

### Issue: "Webhook signature verification failed"
**Solution**:
```bash
# Make sure Stripe CLI is running
stripe listen --forward-to localhost:3000/api/v1/billing/webhook

# Copy the new webhook secret to .env.local
STRIPE_WEBHOOK_SECRET=whsec_...

# Restart dev server
```

### Issue: "Subscription not created in database"
**Solution**:
```bash
# Check webhook logs
tail -f logs/webhook.log

# Check Stripe CLI output for errors
# Verify database connection:
psql $DATABASE_URL -c "SELECT COUNT(*) FROM subscriptions;"
```

### Issue: "RLS policy prevents subscription read"
**Solution**:
```sql
-- Verify RLS policies are created
SELECT * FROM pg_policies WHERE tablename = 'subscriptions';

-- Test as user
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "USER_ID"}';
SELECT * FROM subscriptions WHERE user_id = 'USER_ID';
```

## Next Steps

After completing local setup:

1. ✅ **Implement API Routes**: Follow `tasks.md` for implementation order
2. ✅ **Write Tests**: Create integration tests for billing flows
3. ✅ **Deploy Staging**: Test full flow in staging environment
4. ✅ **Production Setup**:
   - Switch to live Stripe keys
   - Configure production webhook endpoint
   - Enable Stripe Tax in production mode
   - Test with real payment (refund immediately)

## Testing Checklist

Before marking this feature complete:

- [ ] Free user can upgrade to Pro (monthly/annual)
- [ ] Pro user receives 14-day trial (no charge until trial ends)
- [ ] User can create Team subscription (3+ seats)
- [ ] Team admin can invite members
- [ ] Team member can accept invitation
- [ ] Team admin can remove members (prorated credit applied)
- [ ] Free user hits upload quota (blocked at 10 uploads)
- [ ] Pro user has unlimited uploads
- [ ] User can cancel subscription (end of period)
- [ ] User can cancel immediately (refund processed)
- [ ] Payment failure triggers dunning emails
- [ ] Failed payment retries on Day 3, 7, 14
- [ ] Subscription suspended after 14 days of failure
- [ ] User can update payment method via Customer Portal
- [ ] Invoices generated and emailed for all transactions
- [ ] Tax calculated for applicable jurisdictions
- [ ] Webhooks process events with idempotency
- [ ] RLS policies enforce access control

## Resources

- **Stripe Documentation**: [https://stripe.com/docs/billing](https://stripe.com/docs/billing)
- **Stripe Testing**: [https://stripe.com/docs/testing](https://stripe.com/docs/testing)
- **Supabase RLS**: [https://supabase.com/docs/guides/auth/row-level-security](https://supabase.com/docs/guides/auth/row-level-security)
- **Feature Spec**: `specs/006-subscription-billing/spec.md`
- **Data Model**: `specs/006-subscription-billing/data-model.md`
- **API Contracts**: `specs/006-subscription-billing/contracts/billing-api.yaml`

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review `research.md` for Stripe best practices
3. Consult Stripe Dashboard → Logs for webhook errors
4. Check Supabase Dashboard → Logs for database errors
