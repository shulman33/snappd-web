# Stripe Subscription Billing in Next.js - Best Practices Research

**Research Date:** November 5, 2025
**Target:** Next.js 15+ App Router with Stripe Node.js SDK
**Focus:** Production-ready subscription billing with trials, multi-seat teams, and automated dunning

---

## Executive Summary

This document outlines production-ready patterns for implementing Stripe subscription billing in Next.js applications. Key recommendations:

1. **Use Stripe Checkout** for PCI-compliant payment collection
2. **Implement webhook idempotency** with database-backed event tracking
3. **Enable Smart Retries** for automated dunning management
4. **Use Customer Portal** for self-service billing
5. **Configure Stripe Tax** for automatic tax calculation
6. **Enforce minimum seats** at application level for team plans

---

## 1. Stripe API Patterns for Subscriptions

### 1.1 Product & Price Structure

**Decision:** Use separate Price objects for each plan tier (Free, Pro, Team) with quantity-based pricing for team plans.

**Rationale:**
- Stripe's native quantity support enables per-seat billing without custom code
- Separate prices allow different features per tier (trials, billing intervals, etc.)
- Enables easy price changes without affecting existing subscriptions

**Implementation:**

```javascript
// Create products and prices (one-time setup in Stripe Dashboard or via API)
const proProduct = await stripe.products.create({
  name: 'Snappd Pro',
  description: 'Professional screenshot sharing with advanced features',
  metadata: {
    plan: 'pro',
    tier: 'individual'
  }
});

const proMonthlyPrice = await stripe.prices.create({
  product: proProduct.id,
  unit_amount: 999, // $9.99
  currency: 'usd',
  recurring: {
    interval: 'month',
    interval_count: 1,
    usage_type: 'licensed' // For per-seat billing
  },
  metadata: {
    plan: 'pro',
    billing_period: 'monthly'
  }
});

// Team plan with per-seat pricing
const teamProduct = await stripe.products.create({
  name: 'Snappd Team',
  description: 'Team collaboration with shared storage and analytics',
  metadata: {
    plan: 'team',
    tier: 'business',
    min_seats: '3' // Store minimum as metadata
  }
});

const teamMonthlyPrice = await stripe.prices.create({
  product: teamProduct.id,
  unit_amount: 1999, // $19.99 per seat
  currency: 'usd',
  recurring: {
    interval: 'month',
    interval_count: 1,
    usage_type: 'licensed'
  },
  metadata: {
    plan: 'team',
    billing_period: 'monthly',
    min_quantity: '3'
  }
});
```

**Common Pitfalls:**
- Don't hardcode price IDs in code - use environment variables or fetch from Stripe
- Don't use `transform_quantity` for simple per-seat billing (adds complexity)
- Don't create new prices for every subscription - reuse existing price objects

---

### 1.2 Free Trial Implementation (14-Day Requirement)

**Decision:** Use Checkout Session with `trial_period_days: 14` and `trial_settings.end_behavior.missing_payment_method: 'cancel'`.

**Rationale:**
- Checkout collects payment method upfront for seamless conversion after trial
- `cancel` behavior prevents zombie subscriptions without valid payment
- Stripe handles trial tracking and conversion automatically
- Better conversion rates when payment method is collected during signup

**Implementation:**

```javascript
// Next.js API Route: /api/v1/billing/create-checkout
import Stripe from 'stripe';
import { NextRequest } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  const { priceId, userId, email } = await request.json();

  // Create or retrieve Stripe customer
  let customer = await getOrCreateStripeCustomer(userId, email);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customer.id,
    line_items: [
      {
        price: priceId,
        quantity: 1
      }
    ],
    subscription_data: {
      trial_period_days: 14,
      trial_settings: {
        end_behavior: {
          missing_payment_method: 'cancel' // Auto-cancel if no payment method
        }
      },
      metadata: {
        user_id: userId,
        plan: 'pro'
      }
    },
    payment_method_collection: 'always', // Require payment method during trial
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/pricing`,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    metadata: {
      user_id: userId
    }
  });

  return Response.json({ url: session.url });
}
```

**Alternative (No Payment Required During Trial):**

For trials without upfront payment collection:

```javascript
subscription_data: {
  trial_period_days: 14,
  trial_settings: {
    end_behavior: {
      missing_payment_method: 'pause' // Pause subscription if no payment
    }
  }
},
payment_method_collection: 'if_required' // Optional payment collection
```

**Common Pitfalls:**
- Don't use `trial_end` timestamp unless you need custom trial periods per customer
- Don't forget to handle `customer.subscription.trial_will_end` webhook (72h before trial ends)
- Don't allow multiple trials per customer - check subscription history before creating checkout

---

### 1.3 Multi-Seat Team Subscriptions (3-Seat Minimum)

**Decision:** Enforce minimum seats (3) at application level during checkout and subscription updates. Use Stripe's native `quantity` parameter for billing.

**Rationale:**
- Stripe doesn't have native "minimum quantity" enforcement
- Application-level validation provides better UX with clear error messages
- Native quantity billing simplifies proration and invoice calculations
- Customer Portal can be configured to allow seat quantity updates

**Implementation:**

```javascript
// Next.js API Route: /api/v1/billing/create-team-checkout
export async function POST(request: NextRequest) {
  const { priceId, userId, email, seats } = await request.json();

  // ENFORCE MINIMUM SEATS
  const MIN_TEAM_SEATS = 3;
  if (seats < MIN_TEAM_SEATS) {
    return Response.json(
      {
        error: 'INVALID_SEAT_COUNT',
        message: `Team plan requires a minimum of ${MIN_TEAM_SEATS} seats`,
        minimum: MIN_TEAM_SEATS
      },
      { status: 400 }
    );
  }

  let customer = await getOrCreateStripeCustomer(userId, email);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customer.id,
    line_items: [
      {
        price: priceId,
        quantity: seats // Per-seat billing
      }
    ],
    subscription_data: {
      trial_period_days: 14,
      trial_settings: {
        end_behavior: {
          missing_payment_method: 'cancel'
        }
      },
      metadata: {
        user_id: userId,
        plan: 'team',
        initial_seats: seats.toString()
      }
    },
    payment_method_collection: 'always',
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/team/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/pricing`,
    allow_promotion_codes: true
  });

  return Response.json({ url: session.url });
}

// Next.js API Route: /api/v1/billing/update-seats
export async function POST(request: NextRequest) {
  const { subscriptionId, newSeats } = await request.json();

  const MIN_TEAM_SEATS = 3;
  if (newSeats < MIN_TEAM_SEATS) {
    return Response.json(
      {
        error: 'INVALID_SEAT_COUNT',
        message: `Team plan requires a minimum of ${MIN_TEAM_SEATS} seats`,
        minimum: MIN_TEAM_SEATS
      },
      { status: 400 }
    );
  }

  // Retrieve current subscription to get item ID
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const subscriptionItem = subscription.items.data[0];

  // Update subscription quantity (prorates automatically)
  const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: subscriptionItem.id,
        quantity: newSeats
      }
    ],
    proration_behavior: 'create_prorations', // Create prorations for seat changes
    metadata: {
      seats_updated_at: new Date().toISOString(),
      previous_seats: subscriptionItem.quantity.toString(),
      new_seats: newSeats.toString()
    }
  });

  return Response.json({ subscription: updatedSubscription });
}
```

**Customer Portal Configuration:**

Enable self-service seat management in Stripe Dashboard:

1. Go to **Settings > Billing > Customer Portal**
2. Enable **"Customers can update the quantity of their plans"**
3. Set minimum quantity: 3
4. Set maximum quantity: 100 (or your limit)
5. Enable **"Allow promotion codes"**

**Common Pitfalls:**
- Don't use `transform_quantity` for simple minimum seats (adds complexity)
- Don't forget to validate seat count on subscription updates via webhooks
- Don't allow seat reductions below active user count - validate against your database
- Don't forget to update user permissions when seats are reduced

---

### 1.4 Proration Handling for Mid-Cycle Plan Changes

**Decision:** Use Stripe's automatic proration with `proration_behavior: 'create_prorations'` for all subscription changes.

**Rationale:**
- Stripe calculates prorations accurately based on billing cycle
- Automatically generates invoice items for charges/credits
- Transparent to customers via invoices
- Handles edge cases (upgrades, downgrades, seat changes, plan switches)

**Implementation:**

```javascript
// Upgrade from Pro to Team
async function upgradePlanToTeam(userId: string, newPriceId: string, seats: number) {
  const customer = await getStripeCustomerByUserId(userId);
  const subscription = await getCurrentSubscription(customer.id);

  if (!subscription) {
    throw new Error('No active subscription found');
  }

  const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
    items: [
      {
        id: subscription.items.data[0].id,
        price: newPriceId,
        quantity: seats
      }
    ],
    proration_behavior: 'create_prorations', // Generate credit/charge
    billing_cycle_anchor: 'unchanged', // Keep current billing date
    metadata: {
      upgraded_from: subscription.items.data[0].price.id,
      upgraded_at: new Date().toISOString(),
      user_id: userId
    }
  });

  return updatedSubscription;
}

// Downgrade from Team to Pro (immediate with proration)
async function downgradePlan(userId: string, newPriceId: string) {
  const customer = await getStripeCustomerByUserId(userId);
  const subscription = await getCurrentSubscription(customer.id);

  const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
    items: [
      {
        id: subscription.items.data[0].id,
        price: newPriceId,
        quantity: 1 // Single seat for Pro
      }
    ],
    proration_behavior: 'create_prorations',
    billing_cycle_anchor: 'unchanged',
    metadata: {
      downgraded_from: subscription.items.data[0].price.id,
      downgraded_at: new Date().toISOString(),
      user_id: userId
    }
  });

  // Store downgrade timestamp for access revocation logic
  await updateUserPlanAccess(userId, {
    plan: 'pro',
    downgraded_at: new Date(),
    previous_plan: 'team'
  });

  return updatedSubscription;
}

// Schedule downgrade at period end (no proration)
async function scheduleDowngradeAtPeriodEnd(userId: string, newPriceId: string) {
  const customer = await getStripeCustomerByUserId(userId);
  const subscription = await getCurrentSubscription(customer.id);

  const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
    items: [
      {
        id: subscription.items.data[0].id,
        price: newPriceId,
        quantity: 1
      }
    ],
    proration_behavior: 'none', // No proration - change at period end
    billing_cycle_anchor: 'unchanged',
    metadata: {
      scheduled_downgrade_to: newPriceId,
      scheduled_at: new Date().toISOString()
    }
  });

  return updatedSubscription;
}
```

**Proration Display to Users:**

```javascript
// Preview proration before making changes
async function previewSubscriptionChange(subscriptionId: string, newPriceId: string, quantity: number) {
  const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
    subscription: subscriptionId,
    subscription_items: [
      {
        id: (await stripe.subscriptions.retrieve(subscriptionId)).items.data[0].id,
        price: newPriceId,
        quantity: quantity
      }
    ],
    subscription_proration_behavior: 'create_prorations'
  });

  return {
    amountDue: upcomingInvoice.amount_due,
    proratedCredit: upcomingInvoice.lines.data.find(l => l.amount < 0)?.amount || 0,
    proratedCharge: upcomingInvoice.lines.data.find(l => l.amount > 0)?.amount || 0,
    nextBillingDate: new Date(upcomingInvoice.period_end * 1000)
  };
}
```

**Common Pitfalls:**
- Don't use `proration_behavior: 'none'` unless explicitly scheduling changes for period end
- Don't forget to show proration preview to users before plan changes
- Don't allow plan changes during trial period without handling edge cases
- Don't forget to sync plan changes to your database immediately after webhook confirmation

---

### 1.5 Automatic Tax Calculation Setup

**Decision:** Enable Stripe Tax for automatic tax calculation on all subscriptions and invoices.

**Rationale:**
- Stripe Tax handles complex tax rules across jurisdictions automatically
- Automatic registration tracking and compliance reporting
- Integrates seamlessly with subscriptions, prorations, and discounts
- Reduces legal risk and manual tax calculation errors

**Setup Steps:**

1. **Enable Stripe Tax in Dashboard:**
   - Go to **Settings > Tax**
   - Click **"Set up Stripe Tax"**
   - Configure origin address (business location)
   - Register tax jurisdictions where you have nexus

2. **Configure Tax Behavior:**

```javascript
// Update price objects with tax behavior (one-time)
await stripe.prices.update('price_xxx', {
  tax_behavior: 'exclusive' // Tax calculated on top of price
  // or 'inclusive' if price includes tax
});

// Enable automatic tax on checkout sessions
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price: priceId, quantity: 1 }],
  automatic_tax: {
    enabled: true // Stripe Tax automatic calculation
  },
  customer_update: {
    address: 'auto' // Collect address for tax calculation
  },
  // ... other options
});

// Enable automatic tax on subscriptions
const subscription = await stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: priceId }],
  automatic_tax: {
    enabled: true
  }
});
```

3. **Handle Tax-Related Webhooks:**

```javascript
// Listen for invoices that fail tax calculation
switch (event.type) {
  case 'invoice.finalization_failed':
    // Tax calculation failed - customer address invalid/incomplete
    const invoice = event.data.object;
    if (invoice.automatic_tax?.status === 'requires_location_inputs') {
      // Notify customer to update address
      await sendEmailToUpdateAddress(invoice.customer, invoice.id);
    }
    break;
}
```

**Common Pitfalls:**
- Don't enable Stripe Tax without registering in applicable jurisdictions first
- Don't forget to update existing subscriptions to enable automatic tax
- Don't assume all customers have valid addresses - validate on signup
- Don't hardcode tax rates - let Stripe Tax handle it

**Documentation:** [Stripe Tax for Subscriptions](https://docs.stripe.com/tax/subscriptions)

---

## 2. Webhook Implementation

### 2.1 Required Webhook Events

**Decision:** Implement dedicated handlers for these critical subscription lifecycle events:

**Essential Events:**

| Event | Purpose | Priority |
|-------|---------|----------|
| `customer.subscription.created` | Initial subscription activation | Critical |
| `customer.subscription.updated` | Plan changes, seat updates, status changes | Critical |
| `customer.subscription.deleted` | Subscription cancellation/expiration | Critical |
| `invoice.payment_succeeded` | Successful billing, renew access | Critical |
| `invoice.payment_failed` | Failed payment, trigger dunning | Critical |
| `customer.subscription.trial_will_end` | Trial ending soon (72h warning) | High |
| `checkout.session.completed` | Checkout successful, provision access | Critical |

**Optional but Recommended:**

| Event | Purpose | Priority |
|-------|---------|----------|
| `invoice.finalization_failed` | Tax calculation failure | Medium |
| `payment_method.attached` | Customer added payment method | Low |
| `payment_method.detached` | Customer removed payment method | Low |
| `customer.updated` | Customer details changed | Low |

**Implementation:**

```javascript
// Next.js API Route: /api/v1/webhooks/stripe
import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text(); // RAW body required for signature verification
  const signature = headers().get('stripe-signature')!;

  let event: Stripe.Event;

  // SIGNATURE VERIFICATION (critical for security)
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return Response.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  // IDEMPOTENCY CHECK (prevent duplicate processing)
  const eventId = event.id;
  const isProcessed = await checkEventProcessed(eventId);

  if (isProcessed) {
    console.log(`Event ${eventId} already processed, skipping`);
    return Response.json({ received: true });
  }

  // EVENT ROUTING
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.finalization_failed':
        await handleInvoiceFinalizationFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // MARK EVENT AS PROCESSED
    await markEventProcessed(eventId, event.type);

    return Response.json({ received: true });

  } catch (error) {
    console.error(`Error processing webhook ${event.type}:`, error);
    return Response.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
```

**Common Pitfalls:**
- Don't skip signature verification - anyone can POST to your webhook URL
- Don't forget idempotency - Stripe retries webhooks, you'll receive duplicates
- Don't process webhooks synchronously - offload to queue for long operations
- Don't trust event data blindly - fetch fresh data from Stripe API for critical operations

---

### 2.2 Idempotency Patterns

**Decision:** Implement database-backed event tracking with unique constraint on `event_id`.

**Rationale:**
- **25%+ of webhooks are retries** due to network issues, timeouts, and Stripe's delivery guarantees
- Database unique constraint prevents race conditions even with concurrent requests
- Persistent tracking enables audit trail and debugging
- Simple to implement and maintain

**Implementation:**

```sql
-- Migration: Create stripe_events table for idempotency
CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,           -- Stripe event ID (e.g., evt_xxx)
  type TEXT NOT NULL,            -- Event type (e.g., customer.subscription.created)
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  data JSONB,                    -- Store event payload for debugging
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_stripe_events_type ON stripe_events(type);
CREATE INDEX idx_stripe_events_processed_at ON stripe_events(processed_at);
```

```typescript
// lib/stripe/idempotency.ts
import { supabase } from '@/lib/supabase/client';

export async function checkEventProcessed(eventId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('stripe_events')
    .select('id')
    .eq('id', eventId)
    .single();

  return !!data; // Returns true if event exists
}

export async function markEventProcessed(
  eventId: string,
  eventType: string,
  eventData?: any
): Promise<void> {
  const { error } = await supabase
    .from('stripe_events')
    .insert({
      id: eventId,
      type: eventType,
      data: eventData,
      processed_at: new Date().toISOString()
    });

  if (error) {
    // Unique constraint violation = already processed (race condition)
    if (error.code === '23505') {
      console.log(`Event ${eventId} already processed by another request`);
      return;
    }
    throw error;
  }
}
```

**Alternative Pattern: In-Memory Cache + Database**

For high-volume webhooks, add Redis/in-memory cache layer:

```typescript
const eventCache = new Map<string, boolean>();

export async function checkEventProcessed(eventId: string): Promise<boolean> {
  // Check in-memory cache first (fast)
  if (eventCache.has(eventId)) {
    return true;
  }

  // Check database (slower but persistent)
  const isProcessed = await checkEventInDatabase(eventId);

  if (isProcessed) {
    eventCache.set(eventId, true);
  }

  return isProcessed;
}
```

**Common Pitfalls:**
- Don't use timestamps alone for idempotency - events can have same timestamp
- Don't skip idempotency check before processing - race conditions will occur
- Don't delete processed events - keep for audit trail (set retention policy)
- Don't forget to handle database errors gracefully (unique constraint violations are expected)

---

### 2.3 Webhook Signature Verification

**Decision:** Always verify `Stripe-Signature` header using `stripe.webhooks.constructEvent()` with raw request body.

**Rationale:**
- **Critical security requirement** - anyone can POST to your webhook URL without verification
- Stripe calculates signature using raw body - must verify before parsing
- Next.js automatically parses request bodies by default - must disable
- Prevents fraudulent events, data tampering, and replay attacks

**Implementation (Next.js App Router):**

```javascript
// app/api/v1/webhooks/stripe/route.ts
import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  // CRITICAL: Get RAW body as text (not parsed JSON)
  const body = await request.text();

  // Get signature from headers
  const signature = headers().get('stripe-signature');

  if (!signature) {
    console.error('Missing stripe-signature header');
    return Response.json(
      { error: 'Missing signature' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    // Verify signature and construct event
    event = stripe.webhooks.constructEvent(
      body,           // Raw body string
      signature,      // Stripe-Signature header
      webhookSecret,  // Your webhook secret
      300             // Tolerance in seconds (default: 300)
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Webhook signature verification failed: ${errorMessage}`);

    return Response.json(
      { error: `Webhook Error: ${errorMessage}` },
      { status: 400 }
    );
  }

  // Event is verified - safe to process
  console.log(`Verified event: ${event.type} (${event.id})`);

  // ... process event
}

// IMPORTANT: No config export needed in App Router
// Body parsing is handled correctly by default with request.text()
```

**Implementation (Next.js Pages Router - Legacy):**

```javascript
// pages/api/webhooks/stripe.ts
import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { buffer } from 'micro';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// CRITICAL: Disable Next.js body parser to get raw body
export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  // Get raw body as buffer
  const buf = await buffer(req);
  const signature = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error(`Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ... process event

  res.json({ received: true });
}
```

**Getting Webhook Secret:**

1. **Development (Stripe CLI):**
   ```bash
   stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
   # Returns: whsec_xxx (use in .env.local)
   ```

2. **Production (Stripe Dashboard):**
   - Go to **Developers > Webhooks**
   - Click **"Add endpoint"**
   - Enter your webhook URL: `https://yourdomain.com/api/v1/webhooks/stripe`
   - Select events to listen for
   - Copy **Signing secret** (starts with `whsec_`)

**Environment Variables:**

```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Production (.env.production)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx_production
```

**Common Pitfalls:**
- Don't parse request body before verification - signature will fail
- Don't skip signature verification in development - use Stripe CLI for testing
- Don't log raw webhook payloads - may contain sensitive data
- Don't use same webhook secret for dev/production - rotate secrets regularly
- Don't increase tolerance beyond 5 minutes (300 seconds) - allows replay attacks

**Security Checklist:**
- ✅ Verify signature on every webhook request
- ✅ Use HTTPS in production (required by Stripe)
- ✅ Rotate webhook secrets periodically
- ✅ Rate limit webhook endpoint (already implemented in Snappd via middleware)
- ✅ Return 200 quickly - offload processing to queue if needed
- ✅ Log webhook failures for monitoring
- ✅ Use different secrets for test/live mode

---

### 2.4 Retry Handling and Error Recovery

**Decision:** Return HTTP 200 quickly, offload heavy processing to async jobs, implement exponential backoff for Stripe API calls within webhook handlers.

**Rationale:**
- Stripe expects 200 response within 5 seconds or marks webhook as failed
- Retries webhook with exponential backoff: 1h, 2h, 4h, 8h, 16h (up to 3 days)
- Async processing prevents timeout failures
- Idempotent handlers make retries safe

**Implementation:**

```typescript
// app/api/v1/webhooks/stripe/route.ts
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = headers().get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // RETURN 200 IMMEDIATELY - Offload processing
  setImmediate(async () => {
    try {
      await processWebhookEvent(event);
    } catch (error) {
      console.error(`Async webhook processing failed for ${event.id}:`, error);
      // Optional: Send to dead letter queue for manual review
      await logWebhookFailure(event.id, event.type, error);
    }
  });

  return Response.json({ received: true }); // 200 OK
}

// Separate async processing function
async function processWebhookEvent(event: Stripe.Event) {
  // Check idempotency
  const isProcessed = await checkEventProcessed(event.id);
  if (isProcessed) {
    console.log(`Event ${event.id} already processed`);
    return;
  }

  // Route to handlers with error handling
  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
      // ... other handlers
    }

    // Mark as processed
    await markEventProcessed(event.id, event.type, event.data.object);

  } catch (error) {
    console.error(`Error processing ${event.type}:`, error);

    // For critical events, throw to trigger Stripe retry
    if (isCriticalEvent(event.type)) {
      throw error;
    }

    // For non-critical events, log and continue
    await logWebhookError(event.id, event.type, error);
  }
}

// Exponential backoff for Stripe API calls within handlers
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.user_id;

  if (!userId) {
    console.error('Missing user_id in subscription metadata');
    return; // Don't retry - data issue
  }

  // Retry logic for external calls
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      // Update database with subscription data
      await updateUserSubscription(userId, {
        stripe_subscription_id: subscription.id,
        plan: subscription.metadata.plan,
        status: subscription.status,
        current_period_end: new Date(subscription.current_period_end * 1000)
      });

      // Send welcome email
      await sendSubscriptionConfirmationEmail(userId, subscription);

      break; // Success - exit retry loop

    } catch (error) {
      attempt++;

      if (attempt >= maxRetries) {
        console.error(`Failed after ${maxRetries} attempts:`, error);
        throw error; // Trigger Stripe webhook retry
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Retry attempt ${attempt} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Determine if event is critical (should trigger Stripe retry on failure)
function isCriticalEvent(eventType: string): boolean {
  const criticalEvents = [
    'customer.subscription.created',
    'customer.subscription.deleted',
    'invoice.payment_succeeded',
    'invoice.payment_failed'
  ];

  return criticalEvents.includes(eventType);
}

// Log webhook failures for monitoring
async function logWebhookFailure(eventId: string, eventType: string, error: any) {
  await supabase
    .from('webhook_failures')
    .insert({
      event_id: eventId,
      event_type: eventType,
      error_message: error.message,
      error_stack: error.stack,
      failed_at: new Date().toISOString()
    });

  // Optional: Send alert to monitoring service
  // await sendSlackAlert(`Webhook failure: ${eventType} - ${eventId}`);
}
```

**Alternative: Queue-Based Processing (Recommended for Scale)**

For high-volume webhooks, use a job queue:

```typescript
// Using BullMQ or similar
import { Queue } from 'bullmq';

const webhookQueue = new Queue('stripe-webhooks', {
  connection: redisConnection
});

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = headers().get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Add to queue immediately, return 200
  await webhookQueue.add('process-webhook', {
    eventId: event.id,
    eventType: event.type,
    eventData: event.data.object
  }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000 // 2s, 4s, 8s
    },
    removeOnComplete: true,
    removeOnFail: false // Keep failed jobs for debugging
  });

  return Response.json({ received: true });
}

// Separate worker process
webhookQueue.process('process-webhook', async (job) => {
  const { eventId, eventType, eventData } = job.data;

  // Check idempotency
  const isProcessed = await checkEventProcessed(eventId);
  if (isProcessed) {
    return { status: 'already_processed' };
  }

  // Process event
  await processEventByType(eventType, eventData);

  // Mark as processed
  await markEventProcessed(eventId, eventType, eventData);

  return { status: 'processed' };
});
```

**Monitoring Webhook Health:**

```typescript
// Dashboard query to monitor webhook failures
SELECT
  event_type,
  COUNT(*) as failure_count,
  MAX(failed_at) as last_failure
FROM webhook_failures
WHERE failed_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type
ORDER BY failure_count DESC;
```

**Common Pitfalls:**
- Don't perform long operations synchronously in webhook handler - will timeout
- Don't retry all errors - distinguish between transient (retry) and permanent (log and skip)
- Don't forget to monitor webhook failures - silent failures are dangerous
- Don't skip error logging - impossible to debug without context
- Don't retry forever - set max retry limits and dead letter queue

**Best Practices:**
- ✅ Return 200 within 5 seconds
- ✅ Offload heavy processing to async jobs or queue
- ✅ Implement exponential backoff for retries
- ✅ Log all failures with context for debugging
- ✅ Monitor webhook failure rates and alert on spikes
- ✅ Use idempotency to make handlers retry-safe
- ✅ Test webhook handlers with Stripe CLI

---

## 3. Next.js Integration Patterns

### 3.1 Stripe Checkout Implementation

**Decision:** Use server-side Checkout Session creation with client-side redirect. Avoid client-side Stripe.js for subscription creation.

**Rationale:**
- Server-side session creation keeps secret key secure
- Checkout handles PCI compliance, payment collection, SCA, and trial setup
- No custom payment form needed - Stripe's hosted page
- Works seamlessly with trials, tax calculation, and Customer Portal
- Mobile-friendly and localized automatically

**Implementation:**

```typescript
// app/api/v1/billing/create-checkout/route.ts
import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { getCurrentUser } from '@/lib/auth';
import { getOrCreateStripeCustomer } from '@/lib/stripe/customers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser(request);
    if (!user) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { priceId, quantity = 1 } = await request.json();

    // Validate price ID
    if (!priceId || typeof priceId !== 'string') {
      return Response.json(
        { error: 'Invalid price ID' },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    const customer = await getOrCreateStripeCustomer(user.id, user.email);

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      line_items: [
        {
          price: priceId,
          quantity: quantity
        }
      ],
      subscription_data: {
        trial_period_days: 14,
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel'
          }
        },
        metadata: {
          user_id: user.id,
          plan: getPlanFromPriceId(priceId)
        }
      },
      automatic_tax: {
        enabled: true // Stripe Tax
      },
      customer_update: {
        address: 'auto' // Collect address for tax
      },
      payment_method_collection: 'always',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/pricing`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: {
        user_id: user.id
      }
    });

    return Response.json({ url: session.url });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    return Response.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

function getPlanFromPriceId(priceId: string): string {
  // Map price IDs to plan names
  const priceMap: Record<string, string> = {
    [process.env.STRIPE_PRICE_PRO_MONTHLY!]: 'pro',
    [process.env.STRIPE_PRICE_PRO_YEARLY!]: 'pro',
    [process.env.STRIPE_PRICE_TEAM_MONTHLY!]: 'team',
    [process.env.STRIPE_PRICE_TEAM_YEARLY!]: 'team'
  };

  return priceMap[priceId] || 'unknown';
}
```

**Client-Side Component (React):**

```typescript
// app/pricing/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSubscribe(priceId: string, quantity = 1) {
    setLoading(priceId);

    try {
      const response = await fetch('/api/v1/billing/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ priceId, quantity })
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();

      // Redirect to Stripe Checkout
      window.location.href = url;

    } catch (error) {
      console.error('Error:', error);
      alert('Failed to start checkout. Please try again.');
      setLoading(null);
    }
  }

  return (
    <div className="pricing-grid">
      {/* Pro Plan */}
      <div className="pricing-card">
        <h3>Pro</h3>
        <p>$9.99/month</p>
        <button
          onClick={() => handleSubscribe(process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY!)}
          disabled={loading !== null}
        >
          {loading === process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY
            ? 'Loading...'
            : 'Start Free Trial'}
        </button>
      </div>

      {/* Team Plan */}
      <div className="pricing-card">
        <h3>Team</h3>
        <p>$19.99/seat/month</p>
        <TeamSeatsSelector
          onSubscribe={(seats) => handleSubscribe(
            process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY!,
            seats
          )}
          loading={loading === process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY}
        />
      </div>
    </div>
  );
}

// Team seats selector component
function TeamSeatsSelector({ onSubscribe, loading }: {
  onSubscribe: (seats: number) => void;
  loading: boolean;
}) {
  const [seats, setSeats] = useState(3);
  const MIN_SEATS = 3;
  const MAX_SEATS = 100;

  return (
    <div>
      <label>
        Number of seats:
        <input
          type="number"
          min={MIN_SEATS}
          max={MAX_SEATS}
          value={seats}
          onChange={(e) => setSeats(Math.max(MIN_SEATS, Math.min(MAX_SEATS, parseInt(e.target.value) || MIN_SEATS)))}
          disabled={loading}
        />
      </label>
      <p>Total: ${(seats * 19.99).toFixed(2)}/month</p>
      <button
        onClick={() => onSubscribe(seats)}
        disabled={loading || seats < MIN_SEATS}
      >
        {loading ? 'Loading...' : 'Start Free Trial'}
      </button>
    </div>
  );
}
```

**Success Page (Handle Checkout Completion):**

```typescript
// app/billing/success/page.tsx
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export default function CheckoutSuccessPage({
  searchParams
}: {
  searchParams: { session_id?: string }
}) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CheckoutSuccess sessionId={searchParams.session_id} />
    </Suspense>
  );
}

async function CheckoutSuccess({ sessionId }: { sessionId?: string }) {
  if (!sessionId) {
    redirect('/pricing');
  }

  // Retrieve session to get subscription details
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription']
  });

  const subscription = session.subscription as Stripe.Subscription;

  return (
    <div className="success-page">
      <h1>Welcome to Snappd {subscription.metadata.plan === 'pro' ? 'Pro' : 'Team'}!</h1>
      <p>Your {subscription.trial_end ? '14-day free trial' : 'subscription'} is now active.</p>

      {subscription.trial_end && (
        <p>
          Trial ends: {new Date(subscription.trial_end * 1000).toLocaleDateString()}
        </p>
      )}

      <a href="/dashboard">Go to Dashboard</a>
      <a href="/billing">Manage Billing</a>
    </div>
  );
}
```

**Environment Variables:**

```bash
# .env.local
NEXT_PUBLIC_BASE_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Public price IDs (safe to expose)
NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_TEAM_YEARLY=price_xxx
```

**Common Pitfalls:**
- Don't create Checkout Sessions client-side - exposes secret key
- Don't hardcode price IDs in code - use environment variables
- Don't skip authentication before creating sessions
- Don't forget to handle session expiration (1 hour timeout)
- Don't create new customers on every checkout - reuse existing customer ID

---

### 3.2 Customer Portal Integration

**Decision:** Use Stripe's hosted Customer Portal with custom branding and configuration. Create portal sessions server-side.

**Rationale:**
- No-code solution for subscription management, invoices, payment methods
- PCI compliant and secure by default
- Configurable in Stripe Dashboard (no deployment needed for changes)
- Supports plan switching, seat management, cancellation flows
- Mobile-responsive and localized

**Setup:**

1. **Configure Customer Portal in Stripe Dashboard:**
   - Go to **Settings > Billing > Customer Portal**
   - Enable features:
     - ✅ Update payment method
     - ✅ View invoices
     - ✅ Cancel subscription (with optional retention offers)
     - ✅ Update subscription (switch plans, change seats)
     - ✅ Apply promotion codes
   - Set cancellation behavior:
     - Cancel at period end (recommended) or immediately
     - Optional: Show retention offers before cancellation
   - Customize branding (logo, colors, button text)
   - Set business details (support email, phone, address)

2. **Configure Subscription Management:**
   - Allow customers to:
     - Switch between monthly/yearly billing
     - Update quantity (for team plans)
     - Pause subscription (optional)
   - Set quantity limits:
     - Minimum: 3 (for team plans)
     - Maximum: 100 (or your limit)

**Implementation:**

```typescript
// app/api/v1/billing/create-portal-session/route.ts
import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { getCurrentUser } from '@/lib/auth';
import { getStripeCustomerByUserId } from '@/lib/stripe/customers';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser(request);
    if (!user) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get Stripe customer ID
    const customer = await getStripeCustomerByUserId(user.id);

    if (!customer) {
      return Response.json(
        { error: 'No billing account found' },
        { status: 404 }
      );
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/billing`,
    });

    return Response.json({ url: session.url });

  } catch (error) {
    console.error('Error creating portal session:', error);
    return Response.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
```

**Client-Side Component:**

```typescript
// app/billing/page.tsx
'use client';

import { useState } from 'react';

export default function BillingPage() {
  const [loading, setLoading] = useState(false);

  async function openCustomerPortal() {
    setLoading(true);

    try {
      const response = await fetch('/api/v1/billing/create-portal-session', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to create portal session');
      }

      const { url } = await response.json();

      // Redirect to Customer Portal
      window.location.href = url;

    } catch (error) {
      console.error('Error:', error);
      alert('Failed to open billing portal. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>Billing</h1>
      <button onClick={openCustomerPortal} disabled={loading}>
        {loading ? 'Loading...' : 'Manage Billing'}
      </button>

      <div className="billing-info">
        {/* Show current plan, next billing date, etc. */}
      </div>
    </div>
  );
}
```

**Webhook Handling for Portal Actions:**

```typescript
// Customer Portal actions trigger standard subscription webhooks:

switch (event.type) {
  case 'customer.subscription.updated':
    // Handle plan changes, seat updates, paused subscriptions
    const subscription = event.data.object as Stripe.Subscription;

    if (subscription.cancel_at_period_end) {
      // Customer scheduled cancellation
      await handleScheduledCancellation(subscription);
    } else if (subscription.items.data[0].quantity !== previousQuantity) {
      // Customer changed seat count
      await handleSeatCountChange(subscription);
    }
    break;

  case 'customer.subscription.deleted':
    // Handle immediate or end-of-period cancellation
    await handleSubscriptionCancellation(event.data.object);
    break;

  case 'payment_method.attached':
    // Customer added new payment method via portal
    await handlePaymentMethodUpdate(event.data.object);
    break;
}
```

**Common Pitfalls:**
- Don't create portal sessions client-side - requires secret key
- Don't skip authentication - anyone with customer ID could access portal
- Don't forget to handle webhooks for portal actions (plan changes, cancellations)
- Don't allow portal access for users without Stripe customer ID
- Don't forget to set return_url - user needs way back to your app

**Best Practices:**
- ✅ Always authenticate users before creating portal sessions
- ✅ Use webhooks to sync portal actions to your database
- ✅ Configure retention offers to reduce churn
- ✅ Enable invoice downloads for transparency
- ✅ Set clear cancellation policies in portal configuration
- ✅ Test portal flows in test mode before production

---

### 3.3 Environment Variable Management

**Decision:** Use Next.js environment variables with `NEXT_PUBLIC_` prefix for client-side values, keep secrets server-side only.

**Rationale:**
- Next.js automatically inlines `NEXT_PUBLIC_` variables at build time
- Server-side variables (`STRIPE_SECRET_KEY`) never exposed to client
- Type-safe access with TypeScript
- Different values for development/production environments

**Environment Variable Structure:**

```bash
# .env.local (development)
# Server-side only (NEVER expose to client)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Client-side safe (public)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# Price IDs (safe to expose - needed for client-side checkout)
NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_TEAM_YEARLY=price_xxx

# Optional: Product IDs for metadata
STRIPE_PRODUCT_PRO=prod_xxx
STRIPE_PRODUCT_TEAM=prod_xxx
```

```bash
# .env.production (production - deployed to Vercel/hosting)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx_production

NEXT_PUBLIC_BASE_URL=https://snappd.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY=price_live_xxx
NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY=price_live_xxx
NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY=price_live_xxx
NEXT_PUBLIC_STRIPE_PRICE_TEAM_YEARLY=price_live_xxx
```

**Type-Safe Access (TypeScript):**

```typescript
// lib/env.ts
// Server-side environment variables (typed)
export const env = {
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    productPro: process.env.STRIPE_PRODUCT_PRO!,
    productTeam: process.env.STRIPE_PRODUCT_TEAM!
  },
  app: {
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL!
  }
} as const;

// Client-side environment variables (typed)
export const publicEnv = {
  stripe: {
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
    prices: {
      proMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY!,
      proYearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY!,
      teamMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY!,
      teamYearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_YEARLY!
    }
  },
  app: {
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL!
  }
} as const;

// Runtime validation (optional but recommended)
function validateEnv() {
  const requiredEnv = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'NEXT_PUBLIC_BASE_URL'
  ];

  const missing = requiredEnv.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

validateEnv();
```

**Usage Examples:**

```typescript
// Server-side API route
import { env } from '@/lib/env';

const stripe = new Stripe(env.stripe.secretKey);

// Client-side component
import { publicEnv } from '@/lib/env';

<button onClick={() => handleCheckout(publicEnv.stripe.prices.proMonthly)}>
  Subscribe to Pro
</button>
```

**Vercel Deployment:**

```bash
# Set environment variables in Vercel dashboard or CLI
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
```

**Common Pitfalls:**
- Don't expose secret keys with `NEXT_PUBLIC_` prefix
- Don't commit `.env.local` to git (add to `.gitignore`)
- Don't use same keys for test and live modes
- Don't forget to set environment variables in production deployment
- Don't hardcode secrets in code - always use environment variables

**Security Checklist:**
- ✅ Never commit secrets to version control
- ✅ Use different keys for development/production
- ✅ Rotate webhook secrets periodically
- ✅ Use `NEXT_PUBLIC_` only for non-sensitive data
- ✅ Validate environment variables on startup
- ✅ Use secret management for production (Vercel Env, AWS Secrets Manager, etc.)

---

## 4. Security Requirements

### 4.1 PCI Compliance through Stripe

**Decision:** Use Stripe Checkout and Customer Portal exclusively - never handle raw card data in your application.

**Rationale:**
- Stripe is PCI Level 1 certified - highest level of compliance
- Checkout/Portal handle all payment data - no PCI burden on your application
- Stripe.js tokenizes card data before it reaches your server
- No card data stored in your database
- Automatic SCA (Strong Customer Authentication) for European customers

**Compliance Requirements Met:**

| Requirement | How Stripe Handles It |
|-------------|----------------------|
| Secure card data storage | Stripe stores all card data - never touches your servers |
| Encrypted transmission | HTTPS required by default, end-to-end encryption |
| Access controls | Only Stripe employees access card data with strict auditing |
| Regular security testing | Stripe undergoes annual PCI audits and penetration testing |
| Secure development | Stripe's SDKs follow secure coding practices |
| Network security | Stripe's infrastructure is isolated and monitored 24/7 |

**Implementation Best Practices:**

```typescript
// ✅ GOOD: Use Checkout Session (PCI compliant)
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price: priceId, quantity: 1 }],
  // ... Stripe handles all payment collection
});

// ✅ GOOD: Use Customer Portal (PCI compliant)
const portalSession = await stripe.billingPortal.sessions.create({
  customer: customerId,
  // ... Stripe handles all payment method updates
});

// ❌ BAD: Never handle card data directly
const paymentMethod = await stripe.paymentMethods.create({
  type: 'card',
  card: {
    number: '4242424242424242', // ❌ NEVER do this
    exp_month: 12,
    exp_year: 2025,
    cvc: '123'
  }
});
```

**Database Schema (No Card Data):**

```sql
-- ✅ Store only Stripe references, never card data
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  stripe_customer_id TEXT UNIQUE, -- Stripe customer reference
  stripe_subscription_id TEXT UNIQUE, -- Stripe subscription reference
  plan TEXT,
  subscription_status TEXT,
  -- ❌ NEVER store: card_number, cvv, expiry, etc.
);
```

**What You Can Store:**

- ✅ Stripe Customer ID (`cus_xxx`)
- ✅ Stripe Subscription ID (`sub_xxx`)
- ✅ Payment Intent ID (`pi_xxx`)
- ✅ Invoice ID (`in_xxx`)
- ✅ Last 4 digits of card (from Stripe API, not user input)
- ✅ Card brand (Visa, Mastercard, etc.)
- ✅ Payment method ID (`pm_xxx`)

**What You Cannot Store:**

- ❌ Full card number
- ❌ CVV/CVC
- ❌ Card expiry date (unless from Stripe API)
- ❌ Cardholder name (unless for billing address)
- ❌ PIN

**Your PCI Compliance Level:**

Using Stripe Checkout/Portal: **SAQ A** (simplest, ~20 questions)
- Applies when you never touch card data
- No card data on your servers
- All payments via Stripe-hosted pages

**Annual Requirements:**
- Complete SAQ A questionnaire (via Stripe Dashboard)
- Attest to PCI compliance
- Use HTTPS on all pages
- Keep Stripe.js up to date

**Common Pitfalls:**
- Don't create custom payment forms - use Stripe Elements or Checkout
- Don't log payment method details - even for debugging
- Don't store card data "temporarily" - even in memory
- Don't email card details to customers or support
- Don't accept card details via chat, email, or phone

---

### 4.2 Webhook Endpoint Protection

**Decision:** Implement signature verification, rate limiting, authentication checks, and HTTPS enforcement on webhook endpoints.

**Rationale:**
- Webhooks are publicly accessible - anyone can POST to the URL
- Signature verification proves request came from Stripe
- Rate limiting prevents abuse and DDoS attacks
- HTTPS prevents man-in-the-middle attacks
- Proper error handling prevents information leakage

**Security Layers:**

```typescript
// app/api/v1/webhooks/stripe/route.ts
import { NextRequest } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { rateLimit } from '@/lib/rate-limit';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// 1. HTTPS ENFORCEMENT (production only)
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const protocol = request.headers.get('x-forwarded-proto');
    if (protocol !== 'https') {
      return Response.json(
        { error: 'HTTPS required' },
        { status: 403 }
      );
    }
  }

  // 2. RATE LIMITING (prevents abuse)
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const rateLimitResult = await rateLimit({
    key: `webhook:${ip}`,
    limit: 100, // 100 requests per minute
    window: 60
  });

  if (!rateLimitResult.success) {
    return Response.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }

  // 3. SIGNATURE VERIFICATION (proves authenticity)
  const body = await request.text();
  const signature = headers().get('stripe-signature');

  if (!signature) {
    return Response.json(
      { error: 'Missing signature' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret,
      300 // 5-minute tolerance
    );
  } catch (err) {
    // 4. SECURE ERROR HANDLING (don't leak info)
    console.error('Webhook signature verification failed');
    return Response.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  // 5. IDEMPOTENCY CHECK (prevents replay attacks)
  const isProcessed = await checkEventProcessed(event.id);
  if (isProcessed) {
    return Response.json({ received: true });
  }

  // 6. EVENT TYPE VALIDATION (only process expected events)
  const allowedEvents = [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.payment_succeeded',
    'invoice.payment_failed'
  ];

  if (!allowedEvents.includes(event.type)) {
    console.log(`Ignoring unexpected event type: ${event.type}`);
    return Response.json({ received: true });
  }

  // 7. ASYNC PROCESSING (return 200 quickly)
  setImmediate(async () => {
    try {
      await processWebhookEvent(event);
      await markEventProcessed(event.id, event.type);
    } catch (error) {
      console.error(`Webhook processing failed: ${event.id}`, error);
      await logWebhookFailure(event.id, event.type, error);
    }
  });

  return Response.json({ received: true });
}

// Only allow POST requests
export async function GET() {
  return Response.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
```

**Rate Limiting Implementation:**

```typescript
// lib/rate-limit.ts
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!
});

export async function rateLimit({
  key,
  limit,
  window
}: {
  key: string;
  limit: number;
  window: number;
}) {
  const now = Date.now();
  const windowStart = now - window * 1000;

  // Use Redis sorted set for sliding window rate limiting
  const pipe = redis.pipeline();

  // Remove old entries
  pipe.zremrangebyscore(key, 0, windowStart);

  // Add current request
  pipe.zadd(key, { score: now, member: now });

  // Count requests in window
  pipe.zcard(key);

  // Set expiration
  pipe.expire(key, window);

  const results = await pipe.exec();
  const count = results[2] as number;

  return {
    success: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    reset: windowStart + window * 1000
  };
}
```

**Additional Security Headers:**

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers for webhook endpoint
  if (request.nextUrl.pathname.startsWith('/api/v1/webhooks')) {
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'no-referrer');
  }

  return response;
}
```

**Monitoring and Alerts:**

```typescript
// Alert on suspicious activity
async function detectSuspiciousWebhook(event: Stripe.Event, ip: string) {
  // Check for unusual patterns
  const recentEvents = await getRecentWebhookEvents(ip, 60); // Last minute

  if (recentEvents.length > 50) {
    // Potential DDoS or abuse
    await sendAlert({
      type: 'webhook_abuse',
      ip,
      eventCount: recentEvents.length,
      message: `High webhook volume from IP: ${ip}`
    });
  }

  // Check for invalid signatures
  const failedAttempts = await getFailedSignatureAttempts(ip, 300); // Last 5 min

  if (failedAttempts.length > 10) {
    // Potential attack
    await sendAlert({
      type: 'signature_attack',
      ip,
      failedCount: failedAttempts.length,
      message: `Multiple signature verification failures from IP: ${ip}`
    });
  }
}
```

**Common Pitfalls:**
- Don't skip signature verification - critical security requirement
- Don't log full webhook payloads - may contain sensitive data
- Don't trust IP addresses alone - use signature verification
- Don't expose detailed error messages - can leak implementation details
- Don't forget to rotate webhook secrets periodically

**Security Checklist:**
- ✅ Verify webhook signature on every request
- ✅ Use HTTPS in production (required by Stripe)
- ✅ Implement rate limiting (100 req/min recommended)
- ✅ Check for replay attacks via idempotency
- ✅ Validate event types (only process expected events)
- ✅ Return 200 quickly - process asynchronously
- ✅ Log security events for monitoring
- ✅ Rotate webhook secrets regularly (every 90 days)
- ✅ Monitor for suspicious patterns
- ✅ Use different webhook secrets for test/live

---

### 4.3 Rate Limiting for Payment Endpoints

**Decision:** Implement strict rate limiting on all payment-related endpoints (checkout, portal, webhooks) to prevent abuse and protect Stripe API quotas.

**Rationale:**
- Prevents abuse (multiple checkout sessions, billing portal spam)
- Protects Stripe API rate limits (100 req/sec default, 25/sec for some endpoints)
- Reduces costs (fewer unnecessary Stripe API calls)
- Improves security (mitigates DDoS attacks)
- Better user experience (prevents accidental duplicate submissions)

**Rate Limit Strategy:**

| Endpoint | Limit | Window | Rationale |
|----------|-------|--------|-----------|
| `POST /api/v1/billing/create-checkout` | 5 requests | 1 minute | Prevent checkout spam, allow retries |
| `POST /api/v1/billing/create-portal-session` | 10 requests | 1 minute | Portal access should be infrequent |
| `POST /api/v1/billing/update-seats` | 10 requests | 1 minute | Prevent rapid seat changes |
| `POST /api/v1/webhooks/stripe` | 100 requests | 1 minute | Allow Stripe retry bursts |
| `GET /api/v1/billing/subscription` | 30 requests | 1 minute | Frequent reads acceptable |

**Implementation (Upstash Redis):**

```typescript
// lib/rate-limit.ts
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!
});

export async function rateLimit({
  key,
  limit,
  window
}: {
  key: string;
  limit: number;
  window: number; // seconds
}) {
  const now = Date.now();
  const windowStart = now - window * 1000;

  // Sliding window algorithm using Redis sorted set
  const pipe = redis.pipeline();

  // Remove expired entries
  pipe.zremrangebyscore(key, 0, windowStart);

  // Add current request timestamp
  pipe.zadd(key, { score: now, member: `${now}-${Math.random()}` });

  // Count requests in current window
  pipe.zcard(key);

  // Set expiration on the key
  pipe.expire(key, window);

  const results = await pipe.exec();
  const count = results[2] as number;

  const success = count <= limit;
  const remaining = Math.max(0, limit - count);
  const reset = windowStart + window * 1000;

  return {
    success,
    limit,
    remaining,
    reset,
    retryAfter: success ? null : Math.ceil((reset - now) / 1000)
  };
}

// Helper to get user-specific rate limit key
export function getUserRateLimitKey(userId: string, endpoint: string): string {
  return `rate_limit:${endpoint}:user:${userId}`;
}

// Helper to get IP-based rate limit key
export function getIpRateLimitKey(ip: string, endpoint: string): string {
  return `rate_limit:${endpoint}:ip:${ip}`;
}
```

**API Route with Rate Limiting:**

```typescript
// app/api/v1/billing/create-checkout/route.ts
import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit, getUserRateLimitKey } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Authenticate user
  const user = await getCurrentUser(request);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // RATE LIMITING
  const rateLimitKey = getUserRateLimitKey(user.id, 'create-checkout');
  const rateLimitResult = await rateLimit({
    key: rateLimitKey,
    limit: 5,
    window: 60 // 5 requests per minute
  });

  if (!rateLimitResult.success) {
    return Response.json(
      {
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many checkout attempts. Please try again later.',
        retryAfter: rateLimitResult.retryAfter
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
        }
      }
    );
  }

  // Add rate limit headers to successful responses
  const response = await createCheckoutSession(request);

  response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
  response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
  response.headers.set('X-RateLimit-Reset', rateLimitResult.reset.toString());

  return response;
}
```

**Multi-Tier Rate Limiting (User + IP):**

```typescript
// Implement both user-based and IP-based rate limiting
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  const ip = request.headers.get('x-forwarded-for') || 'unknown';

  // User-based rate limit (authenticated requests)
  if (user) {
    const userRateLimit = await rateLimit({
      key: getUserRateLimitKey(user.id, 'create-checkout'),
      limit: 5,
      window: 60
    });

    if (!userRateLimit.success) {
      return Response.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429 }
      );
    }
  }

  // IP-based rate limit (prevents unauthenticated abuse)
  const ipRateLimit = await rateLimit({
    key: getIpRateLimitKey(ip, 'create-checkout'),
    limit: 10, // Slightly higher for shared IPs
    window: 60
  });

  if (!ipRateLimit.success) {
    return Response.json(
      { error: 'Too many requests from this IP. Please wait before trying again.' },
      { status: 429 }
    );
  }

  // Proceed with request...
}
```

**Client-Side Error Handling:**

```typescript
// Handle rate limit errors gracefully
async function createCheckoutSession(priceId: string) {
  try {
    const response = await fetch('/api/v1/billing/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId })
    });

    if (response.status === 429) {
      const data = await response.json();
      const retryAfter = data.retryAfter || 60;

      alert(`Too many requests. Please wait ${retryAfter} seconds before trying again.`);

      // Optional: Disable button and show countdown
      disableButtonWithCountdown(retryAfter);
      return;
    }

    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }

    const { url } = await response.json();
    window.location.href = url;

  } catch (error) {
    console.error('Error:', error);
    alert('An error occurred. Please try again.');
  }
}

function disableButtonWithCountdown(seconds: number) {
  const button = document.querySelector('button');
  if (!button) return;

  let remaining = seconds;
  button.disabled = true;

  const interval = setInterval(() => {
    remaining--;
    button.textContent = `Wait ${remaining}s`;

    if (remaining <= 0) {
      clearInterval(interval);
      button.disabled = false;
      button.textContent = 'Subscribe Now';
    }
  }, 1000);
}
```

**Common Pitfalls:**
- Don't use only IP-based rate limiting - NAT/proxies share IPs
- Don't set limits too low - legitimate users need retries
- Don't forget to add rate limit headers to responses
- Don't rate limit GET requests as strictly as POST
- Don't skip rate limiting on webhooks - can be abused

**Monitoring:**

```typescript
// Track rate limit hits for monitoring
async function trackRateLimitHit(userId: string, endpoint: string) {
  await supabase
    .from('rate_limit_hits')
    .insert({
      user_id: userId,
      endpoint,
      hit_at: new Date().toISOString()
    });
}

// Query for users hitting rate limits frequently
SELECT
  user_id,
  endpoint,
  COUNT(*) as hit_count,
  MAX(hit_at) as last_hit
FROM rate_limit_hits
WHERE hit_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id, endpoint
HAVING COUNT(*) > 10
ORDER BY hit_count DESC;
```

---

### 4.4 Secure Storage of Stripe Customer IDs

**Decision:** Store Stripe customer IDs in database with unique constraints, row-level security (RLS), and indexed lookups. Never expose customer IDs publicly.

**Rationale:**
- Customer IDs are sensitive - allow access to billing information
- Unique constraints prevent duplicate customer creation
- RLS ensures users can only access their own customer data
- Indexed lookups improve performance for webhook processing
- Proper foreign key relationships maintain data integrity

**Database Schema (Supabase PostgreSQL):**

```sql
-- Profiles table with Stripe customer ID
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,

  -- Stripe references (sensitive)
  stripe_customer_id TEXT UNIQUE, -- Unique constraint prevents duplicates
  stripe_subscription_id TEXT UNIQUE,

  -- Subscription details (synced from Stripe via webhooks)
  plan TEXT CHECK (plan IN ('free', 'pro', 'team')) DEFAULT 'free',
  subscription_status TEXT, -- 'active', 'trialing', 'past_due', 'canceled', 'incomplete'
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX idx_profiles_stripe_customer ON profiles(stripe_customer_id);
CREATE INDEX idx_profiles_stripe_subscription ON profiles(stripe_subscription_id);
CREATE INDEX idx_profiles_plan ON profiles(plan);

-- Row-Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (except Stripe IDs - managed via webhooks)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Only service role can insert/update Stripe IDs (webhook processing)
CREATE POLICY "Service role can manage Stripe IDs"
  ON profiles FOR ALL
  USING (auth.role() = 'service_role');
```

**Secure Customer ID Access Patterns:**

```typescript
// lib/stripe/customers.ts
import { supabase } from '@/lib/supabase/client';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Get or create Stripe customer (idempotent)
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string
): Promise<Stripe.Customer> {
  // Check if customer already exists
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  if (profile?.stripe_customer_id) {
    // Retrieve existing customer from Stripe
    return await stripe.customers.retrieve(profile.stripe_customer_id) as Stripe.Customer;
  }

  // Create new customer in Stripe
  const customer = await stripe.customers.create({
    email,
    metadata: {
      user_id: userId // Link back to our user
    }
  });

  // Store customer ID in database
  await supabase
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId);

  return customer;
}

// Get Stripe customer ID by user ID (secure)
export async function getStripeCustomerIdByUserId(
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.stripe_customer_id;
}

// Get user ID from Stripe customer ID (webhook processing)
export async function getUserIdByStripeCustomerId(
  customerId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.id;
}

// Update customer ID (webhook processing only - uses service role)
export async function updateStripeCustomerId(
  userId: string,
  customerId: string
) {
  // Use service role key for this operation
  const { error } = await supabase
    .from('profiles')
    .update({ stripe_customer_id: customerId })
    .eq('id', userId);

  if (error) {
    throw new Error(`Failed to update customer ID: ${error.message}`);
  }
}
```

**API Route Security (Never Expose Customer IDs):**

```typescript
// ❌ BAD: Exposing customer ID to client
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  return Response.json({
    customerId: user.stripe_customer_id, // ❌ NEVER expose this
    plan: user.plan
  });
}

// ✅ GOOD: Only expose necessary data
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);

  return Response.json({
    plan: user.plan,
    subscriptionStatus: user.subscription_status,
    currentPeriodEnd: user.current_period_end,
    cancelAtPeriodEnd: user.cancel_at_period_end
  });
}

// ✅ GOOD: Create Checkout Session server-side (customer ID never exposed)
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  const { priceId } = await request.json();

  // Get customer ID securely on server
  const customerId = await getStripeCustomerIdByUserId(user.id);

  if (!customerId) {
    return Response.json(
      { error: 'No billing account found' },
      { status: 404 }
    );
  }

  // Create session (customer ID stays server-side)
  const session = await stripe.checkout.sessions.create({
    customer: customerId, // Used server-side only
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: '...',
    cancel_url: '...'
  });

  // Only return session URL
  return Response.json({ url: session.url });
}
```

**Webhook Customer ID Validation:**

```typescript
// Validate customer ID in webhook events
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // Verify customer exists in our database
  const userId = await getUserIdByStripeCustomerId(customerId);

  if (!userId) {
    console.error(`Unknown customer ID in webhook: ${customerId}`);
    // Optional: Create customer record or alert monitoring
    return;
  }

  // Update subscription details
  await supabase
    .from('profiles')
    .update({
      stripe_subscription_id: subscription.id,
      plan: subscription.metadata.plan,
      subscription_status: subscription.status,
      current_period_end: new Date(subscription.current_period_end * 1000)
    })
    .eq('id', userId);
}
```

**Common Pitfalls:**
- Don't expose customer IDs in API responses - only return in secure server context
- Don't allow users to modify their own customer IDs - manage via webhooks only
- Don't create multiple customer IDs per user - check before creating
- Don't skip unique constraints - prevents duplicate customer creation
- Don't log customer IDs in client-side code - server-only

**Security Checklist:**
- ✅ Store customer IDs in database with unique constraints
- ✅ Enable RLS on profiles table
- ✅ Never expose customer IDs to client (API responses, logs, etc.)
- ✅ Use service role for webhook customer ID updates
- ✅ Index customer ID columns for fast lookups
- ✅ Validate customer IDs in webhook handlers
- ✅ Audit access to customer IDs (log when accessed)
- ✅ Use customer IDs only server-side

---

## 5. Dunning Management

### 5.1 Stripe Smart Retries vs Custom Logic

**Decision:** Use Stripe Smart Retries with AI-powered retry timing. Supplement with custom dunning emails for customer communication.

**Rationale:**
- Smart Retries uses AI to determine optimal retry times (better success rates than fixed schedules)
- Stripe automatically retries failed payments up to 4 times over 15 days
- Avoids card network penalties (Mastercard: 35 attempts/30 days, Visa: 15 attempts/30 days)
- Custom emails provide human touch and recovery guidance
- Combining both approaches maximizes recovery rate (up to 70% vs 40% without Smart Retries)

**How Smart Retries Works:**

1. **AI-Powered Timing:**
   - Analyzes device activity, payment patterns, and historical data
   - Retries when payment is most likely to succeed
   - Adapts to individual customer behavior

2. **Automatic Retry Schedule (Default):**
   - 1st retry: ~3 days after failure
   - 2nd retry: ~5 days after 1st retry
   - 3rd retry: ~7 days after 2nd retry
   - 4th retry: ~7 days after 3rd retry (total: ~22 days)

3. **Soft vs Hard Declines:**
   - **Soft declines** (insufficient funds, expired card): Retried automatically
   - **Hard declines** (card blocked, invalid): Not retried (customer must update payment method)

**Configuration:**

```typescript
// Enable Smart Retries in Stripe Dashboard:
// Settings > Billing > Revenue Recovery > Retries
// - Select "Smart Retries" (recommended)
// - Alternative: Custom schedule (7 days between retries recommended)

// No code changes needed - Stripe handles retries automatically
// Webhooks notify you of retry results
```

**Webhook Events for Retry Management:**

```typescript
// Handle payment retry events
switch (event.type) {
  case 'invoice.payment_failed':
    const invoice = event.data.object as Stripe.Invoice;
    const attempt = invoice.attempt_count;
    const nextRetry = invoice.next_payment_attempt;

    if (attempt === 1) {
      // First failure - send friendly reminder
      await sendPaymentFailureEmail(invoice.customer, {
        type: 'first_failure',
        nextRetryDate: nextRetry ? new Date(nextRetry * 1000) : null,
        updatePaymentUrl: await getCustomerPortalUrl(invoice.customer)
      });
    } else if (attempt >= 3) {
      // Multiple failures - more urgent
      await sendPaymentFailureEmail(invoice.customer, {
        type: 'final_warning',
        attemptsRemaining: 4 - attempt,
        updatePaymentUrl: await getCustomerPortalUrl(invoice.customer)
      });
    }

    // Track failure for analytics
    await trackPaymentFailure(invoice.customer, {
      attempt,
      reason: invoice.last_finalization_error?.message,
      amount: invoice.amount_due
    });
    break;

  case 'invoice.payment_action_required':
    // Payment requires additional action (SCA)
    const actionInvoice = event.data.object as Stripe.Invoice;
    await sendSCARequiredEmail(actionInvoice.customer, {
      paymentUrl: actionInvoice.hosted_invoice_url
    });
    break;
}
```

**Smart Retries vs Custom Schedule:**

| Approach | Success Rate | Card Network Penalties | Complexity |
|----------|--------------|------------------------|------------|
| Smart Retries | ~70% | Low (optimized timing) | Low (automatic) |
| Custom Schedule (7 days) | ~55% | Medium (fixed timing) | Medium (manual config) |
| No Retries | ~40% | None | Low |

**Recommendation:** Use Smart Retries for optimal results.

**Common Pitfalls:**
- Don't retry hard declines (card blocked, invalid) - wastes attempts and risks penalties
- Don't retry too frequently - card networks charge fees for excessive retries
- Don't rely only on retries - send dunning emails to prompt customer action
- Don't forget to handle `invoice.payment_action_required` (SCA requirements)

---

### 5.2 Payment Recovery Email Best Practices

**Decision:** Implement multi-stage dunning email campaign with clear CTAs, personalized messaging, and urgency escalation.

**Rationale:**
- Emails prompt customer action faster than waiting for automatic retries
- Personalized messages increase response rates by 26%
- Clear CTAs (update payment method) reduce friction
- Escalating urgency prevents subscription cancellation
- Retention offers can save customers on the edge of churning

**Email Campaign Structure:**

| Stage | Timing | Tone | Goal |
|-------|--------|------|------|
| 1. Friendly Reminder | Immediately after failure | Helpful, understanding | Inform customer, offer easy fix |
| 2. Payment Update Request | 3 days after failure | Professional, clear | Drive action to update payment |
| 3. Service Interruption Warning | 7 days after failure | Urgent but respectful | Create urgency, offer support |
| 4. Final Notice | 14 days after failure | Final warning, retention offer | Last chance to save subscription |

**Email Templates:**

```typescript
// lib/email/dunning-templates.ts

// 1. Friendly Reminder (Day 0)
export const firstFailureEmail = {
  subject: "Payment issue with your Snappd subscription",

  body: `
Hi {{customer_name}},

We had trouble processing your recent payment for Snappd {{plan_name}}.

This can happen for a few reasons:
- Insufficient funds
- Expired card
- Card issuer declined the charge

**What you need to do:**
We'll automatically retry your payment in a few days, but you can update your payment method now to avoid any service interruption.

[Update Payment Method]

Your subscription is still active, and you have full access to all features.

If you have questions, we're here to help: support@snappd.com

Thanks,
The Snappd Team
  `
};

// 2. Payment Update Request (Day 3)
export const secondFailureEmail = {
  subject: "Action required: Update your payment method",

  body: `
Hi {{customer_name}},

We've tried processing your payment again, but it was unsuccessful.

**Current status:**
- Subscription: Snappd {{plan_name}}
- Failed attempts: {{attempt_count}}
- Next retry: {{next_retry_date}}

**To keep your account active:**
Please update your payment method as soon as possible. It only takes a minute.

[Update Payment Method]

**Need help?**
If you're having trouble, our support team is ready to assist: support@snappd.com

We appreciate your business and want to make sure you don't lose access to your screenshots and analytics.

Best regards,
The Snappd Team
  `
};

// 3. Service Interruption Warning (Day 7)
export const urgentWarningEmail = {
  subject: "⚠️ Your Snappd subscription may be canceled soon",

  body: `
Hi {{customer_name}},

**Action Required:** Your Snappd {{plan_name}} subscription is at risk of cancellation due to payment issues.

**What's happening:**
- We've attempted to process your payment {{attempt_count}} times
- All attempts have been unsuccessful
- Your subscription will be canceled in {{days_remaining}} days

**Update your payment method now to avoid losing access to:**
- {{feature_list}}

[Update Payment Method - 2 Minute Fix]

**Having financial difficulty?**
We understand things come up. If you need to pause or downgrade your subscription, we can help find a solution that works for you.

[Contact Support]

We value you as a customer and don't want you to lose your data.

Sincerely,
The Snappd Team
  `
};

// 4. Final Notice + Retention Offer (Day 14)
export const finalNoticeEmail = {
  subject: "Final notice: Save your Snappd subscription",

  body: `
Hi {{customer_name}},

This is our final notice before your Snappd subscription is canceled.

**Status:**
- Subscription: Snappd {{plan_name}}
- Failed attempts: {{attempt_count}}
- Cancellation date: {{cancellation_date}}

**What happens if your subscription is canceled:**
❌ Loss of access to {{storage_amount}} of stored screenshots
❌ Loss of analytics data
❌ Loss of custom domains and branding

**Update payment now to keep your account active:**
[Update Payment Method]

**Special Offer: We don't want to see you go**
If cost is a concern, we'd like to offer you:
- 20% off for 3 months
- Downgrade to a lower plan
- Pause your subscription for up to 3 months

[View Offers] or [Contact Support]

This is your last chance to save your data and subscription.

The Snappd Team
  `
};
```

**Email Service Implementation:**

```typescript
// lib/email/dunning.ts
import { SendGridEmailService } from './sendgrid';
import { getUserByStripeCustomerId } from '@/lib/stripe/customers';
import Stripe from 'stripe';

export async function sendPaymentFailureEmail(
  customerId: string,
  options: {
    type: 'first_failure' | 'second_failure' | 'urgent_warning' | 'final_notice';
    nextRetryDate?: Date;
    attemptsRemaining?: number;
    updatePaymentUrl: string;
  }
) {
  const user = await getUserByStripeCustomerId(customerId);

  if (!user) {
    console.error(`No user found for customer: ${customerId}`);
    return;
  }

  const templates = {
    first_failure: {
      subject: "Payment issue with your Snappd subscription",
      urgency: 'low'
    },
    second_failure: {
      subject: "Action required: Update your payment method",
      urgency: 'medium'
    },
    urgent_warning: {
      subject: "⚠️ Your Snappd subscription may be canceled soon",
      urgency: 'high'
    },
    final_notice: {
      subject: "Final notice: Save your Snappd subscription",
      urgency: 'critical'
    }
  };

  const template = templates[options.type];

  await SendGridEmailService.send({
    to: user.email,
    subject: template.subject,
    html: renderDunningEmail(options.type, {
      customerName: user.full_name || 'there',
      planName: user.plan,
      attemptCount: 4 - (options.attemptsRemaining || 0),
      nextRetryDate: options.nextRetryDate,
      updatePaymentUrl: options.updatePaymentUrl,
      daysRemaining: options.attemptsRemaining ? options.attemptsRemaining * 3 : 0
    }),
    category: `dunning_${options.type}`,
    metadata: {
      user_id: user.id,
      customer_id: customerId,
      urgency: template.urgency
    }
  });

  // Track email sent
  await trackDunningEmailSent(user.id, options.type);
}

async function getCustomerPortalUrl(customerId: string): Promise<string> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/billing`
  });

  return session.url;
}

function renderDunningEmail(type: string, data: any): string {
  // Load template and replace variables
  // Use a template engine like Handlebars or just string replacement
  const template = firstFailureEmail.body; // Example

  return template
    .replace(/\{\{customer_name\}\}/g, data.customerName)
    .replace(/\{\{plan_name\}\}/g, data.planName)
    .replace(/\{\{attempt_count\}\}/g, data.attemptCount)
    .replace(/\{\{next_retry_date\}\}/g, data.nextRetryDate?.toLocaleDateString() || 'N/A');
}
```

**Best Practices:**

1. **Timing:**
   - Send first email immediately after failure
   - Space subsequent emails 3-7 days apart
   - Send final notice 24-48h before cancellation

2. **Tone:**
   - Start helpful and understanding
   - Gradually increase urgency
   - Always remain professional and respectful
   - Offer help and alternatives

3. **CTAs:**
   - One primary CTA: "Update Payment Method"
   - Make CTA button/link prominent
   - Use Customer Portal URLs (secure, no login required)
   - Secondary CTA: "Contact Support"

4. **Personalization:**
   - Use customer's name
   - Reference their specific plan
   - Mention specific features they'll lose
   - Include data they've stored (screenshot count, storage used)

5. **Retention Offers:**
   - Offer discounts on final notice only (prevent gaming)
   - Suggest plan downgrades if cost is an issue
   - Offer pause/freeze option (keeps customer in ecosystem)
   - Make it easy to contact support for help

**Common Pitfalls:**
- Don't send too many emails - causes fatigue and unsubscribes
- Don't be overly aggressive - maintain professional tone
- Don't forget to track which emails were sent (prevent duplicates)
- Don't use threatening language - focus on helping customer
- Don't make it hard to update payment - use direct Customer Portal links

**Success Metrics:**

```typescript
// Track dunning email effectiveness
interface DunningMetrics {
  emailsSent: number;
  emailsOpened: number;
  linksClicked: number;
  paymentsUpdated: number;
  subscriptionsRecovered: number;
  averageRecoveryTime: number; // days
}

async function getDunningMetrics(startDate: Date, endDate: Date): Promise<DunningMetrics> {
  // Query analytics from SendGrid + Stripe
  // Track: open rates, click rates, conversion rates
  // Goal: 60%+ open rate, 30%+ click rate, 50%+ recovery rate
}
```

---

### 5.3 Grace Period Implementation

**Decision:** Allow 15-day grace period after final payment failure before canceling subscription. Downgrade to free plan instead of full cancellation.

**Rationale:**
- Industry standard: 14-21 day grace period after final retry
- Gives customers time to resolve payment issues
- Reduces churn (customers can recover without re-subscribing)
- Downgrade to free preserves customer relationship
- Maintains data integrity (don't delete user data)

**Implementation:**

```typescript
// Webhook handler for failed payments
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const subscription = invoice.subscription as string;
  const attemptCount = invoice.attempt_count || 0;

  // Get user from database
  const userId = await getUserIdByStripeCustomerId(customerId);
  if (!userId) return;

  // Check if this is the final retry attempt
  const isLastAttempt = attemptCount >= 4;

  if (isLastAttempt) {
    // GRACE PERIOD: Don't cancel immediately
    // Mark subscription for cancellation after 15 days
    const gracePeriodEnd = new Date();
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 15);

    await supabase
      .from('profiles')
      .update({
        subscription_status: 'past_due',
        grace_period_end: gracePeriodEnd.toISOString(),
        cancel_scheduled: true
      })
      .eq('id', userId);

    // Send final notice email
    await sendPaymentFailureEmail(customerId, {
      type: 'final_notice',
      attemptsRemaining: 0,
      updatePaymentUrl: await getCustomerPortalUrl(customerId)
    });

    // Schedule background job to cancel subscription after grace period
    await scheduleGracePeriodCancellation(userId, gracePeriodEnd);

  } else {
    // Regular payment failure - send reminder
    await supabase
      .from('profiles')
      .update({
        subscription_status: 'past_due'
      })
      .eq('id', userId);

    await sendPaymentFailureEmail(customerId, {
      type: attemptCount === 1 ? 'first_failure' : 'second_failure',
      attemptsRemaining: 4 - attemptCount,
      nextRetryDate: invoice.next_payment_attempt
        ? new Date(invoice.next_payment_attempt * 1000)
        : null,
      updatePaymentUrl: await getCustomerPortalUrl(customerId)
    });
  }
}

// Handle subscription deletion (end of grace period or immediate cancellation)
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const userId = await getUserIdByStripeCustomerId(customerId);

  if (!userId) return;

  // DOWNGRADE TO FREE PLAN (don't delete data)
  await supabase
    .from('profiles')
    .update({
      plan: 'free',
      subscription_status: 'canceled',
      stripe_subscription_id: null,
      current_period_end: null,
      cancel_at_period_end: false,
      downgraded_at: new Date().toISOString()
    })
    .eq('id', userId);

  // Apply free tier limits (archive old screenshots, limit storage, etc.)
  await applyFreeTierLimits(userId);

  // Send downgrade notification email
  await sendSubscriptionCanceledEmail(userId, {
    downgradedTo: 'free',
    reason: 'payment_failure',
    reactivateUrl: await getCheckoutUrl('pro')
  });
}

// Background job: Cancel subscriptions after grace period
async function processGracePeriodCancellations() {
  const { data: expiredGracePeriods } = await supabase
    .from('profiles')
    .select('id, stripe_subscription_id, grace_period_end')
    .eq('cancel_scheduled', true)
    .lte('grace_period_end', new Date().toISOString());

  for (const profile of expiredGracePeriods || []) {
    try {
      // Cancel subscription in Stripe
      if (profile.stripe_subscription_id) {
        await stripe.subscriptions.cancel(profile.stripe_subscription_id);
      }

      // Webhook will handle database update via handleSubscriptionDeleted

    } catch (error) {
      console.error(`Failed to cancel subscription for user ${profile.id}:`, error);
    }
  }
}

// Schedule background job (run daily)
// Using cron job, Vercel Cron, or similar scheduler
// Schedule: 0 0 * * * (daily at midnight)
```

**Free Tier Limits Application:**

```typescript
async function applyFreeTierLimits(userId: string) {
  // Example: Free tier allows 10 screenshots, Pro allows unlimited
  const FREE_TIER_SCREENSHOT_LIMIT = 10;

  // Get user's screenshots
  const { data: screenshots } = await supabase
    .from('screenshots')
    .select('id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (screenshots && screenshots.length > FREE_TIER_SCREENSHOT_LIMIT) {
    // Archive or delete older screenshots
    const screenshotsToArchive = screenshots.slice(FREE_TIER_SCREENSHOT_LIMIT);

    await supabase
      .from('screenshots')
      .update({ archived: true })
      .in('id', screenshotsToArchive.map(s => s.id));

    // Notify user
    await sendScreenshotsArchivedEmail(userId, {
      archivedCount: screenshotsToArchive.length,
      upgradeUrl: await getCheckoutUrl('pro')
    });
  }
}
```

**Reactivation Flow:**

```typescript
// Allow easy reactivation after grace period
async function reactivateSubscription(userId: string, priceId: string) {
  const customer = await getStripeCustomerByUserId(userId);

  if (!customer) {
    throw new Error('No customer found');
  }

  // Create new subscription
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: {
      save_default_payment_method: 'on_subscription'
    },
    expand: ['latest_invoice.payment_intent'],
    metadata: {
      user_id: userId,
      reactivated: 'true',
      previous_cancellation_reason: 'payment_failure'
    }
  });

  // Restore archived screenshots
  await restoreArchivedScreenshots(userId);

  return subscription;
}
```

**Common Pitfalls:**
- Don't delete user data on cancellation - downgrade to free instead
- Don't cancel immediately after final payment failure - allow grace period
- Don't make it hard to reactivate - offer one-click reactivation
- Don't forget to send email notifications during grace period
- Don't forget to clean up scheduled cancellations if payment is updated

**Best Practices:**
- ✅ Grace period: 14-21 days (Snappd uses 15 days)
- ✅ Downgrade to free plan instead of full cancellation
- ✅ Archive (don't delete) data over free tier limits
- ✅ Send final notice email at start of grace period
- ✅ Allow easy reactivation with one click
- ✅ Track grace period expirations with daily job
- ✅ Offer retention discounts during grace period

---

## Summary & Implementation Checklist

### Key Decisions Made

| Category | Decision | Rationale |
|----------|----------|-----------|
| **Trials** | 14-day trial with payment method required | Best conversion rates, auto-cancel without payment |
| **Multi-Seat** | Enforce 3-seat minimum at app level | Stripe has no native minimum, app validation provides better UX |
| **Proration** | Use Stripe's automatic proration | Accurate, transparent, handles all edge cases |
| **Tax** | Enable Stripe Tax | Automatic compliance, reduces legal risk |
| **Webhooks** | Database-backed idempotency + signature verification | Prevents duplicates, ensures security |
| **Checkout** | Use Checkout Session + Customer Portal | PCI compliant, no custom payment forms needed |
| **Dunning** | Smart Retries + multi-stage email campaign | 70% recovery rate vs 40% without |
| **Grace Period** | 15 days, downgrade to free instead of delete | Reduces churn, preserves customer relationship |

### Implementation Order

**Phase 1: Core Subscription Infrastructure (Week 1)**
- [ ] Set up Stripe products and prices in Dashboard
- [ ] Create environment variables (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, etc.)
- [ ] Implement customer creation (`getOrCreateStripeCustomer`)
- [ ] Create Checkout Session API route (`/api/v1/billing/create-checkout`)
- [ ] Create Customer Portal API route (`/api/v1/billing/create-portal-session`)
- [ ] Update database schema (add `stripe_customer_id`, `stripe_subscription_id`)
- [ ] Test basic subscription flow in Stripe test mode

**Phase 2: Webhook Processing (Week 2)**
- [ ] Create webhook endpoint (`/api/v1/webhooks/stripe`)
- [ ] Implement signature verification
- [ ] Create `stripe_events` table for idempotency
- [ ] Implement core webhook handlers:
  - [ ] `checkout.session.completed`
  - [ ] `customer.subscription.created`
  - [ ] `customer.subscription.updated`
  - [ ] `customer.subscription.deleted`
  - [ ] `invoice.payment_succeeded`
  - [ ] `invoice.payment_failed`
- [ ] Test webhooks with Stripe CLI
- [ ] Deploy webhook endpoint to production
- [ ] Configure webhook in Stripe Dashboard (production)

**Phase 3: Trial & Multi-Seat Implementation (Week 3)**
- [ ] Configure 14-day trial in Checkout Sessions
- [ ] Implement team plan with minimum 3 seats
- [ ] Create seat update API route (`/api/v1/billing/update-seats`)
- [ ] Configure Customer Portal for seat management
- [ ] Test trial conversion flow
- [ ] Test seat increase/decrease flows

**Phase 4: Security & Rate Limiting (Week 4)**
- [ ] Implement rate limiting on payment endpoints
- [ ] Enable HTTPS in production
- [ ] Rotate and secure webhook secrets
- [ ] Implement RLS policies on Stripe data
- [ ] Add security headers to webhook endpoint
- [ ] Set up monitoring for failed webhooks
- [ ] Audit customer ID exposure in API responses

**Phase 5: Dunning & Grace Period (Week 5)**
- [ ] Enable Smart Retries in Stripe Dashboard
- [ ] Implement dunning email templates
- [ ] Create email sending logic for payment failures
- [ ] Implement grace period tracking
- [ ] Create background job for grace period cancellations
- [ ] Implement downgrade to free tier logic
- [ ] Test payment failure recovery flows

**Phase 6: Tax & Proration (Week 6)**
- [ ] Enable Stripe Tax in Dashboard
- [ ] Configure tax registrations
- [ ] Update Checkout Sessions with `automatic_tax: true`
- [ ] Test tax calculation in different regions
- [ ] Implement proration preview for plan changes
- [ ] Test plan upgrade/downgrade flows
- [ ] Verify prorated invoices are correct

**Phase 7: Testing & Launch (Week 7)**
- [ ] End-to-end testing in test mode
- [ ] Test trial conversion (with/without payment method)
- [ ] Test payment failures and retries
- [ ] Test webhook idempotency (duplicate events)
- [ ] Test rate limiting on all endpoints
- [ ] Test Customer Portal flows
- [ ] Switch to live mode
- [ ] Monitor webhooks for 48h
- [ ] Verify first real subscription flows

### Monitoring & Maintenance

**Daily Monitoring:**
- [ ] Check webhook failure rate (should be <1%)
- [ ] Monitor failed payments and retry attempts
- [ ] Review grace period expirations

**Weekly Monitoring:**
- [ ] Analyze dunning email performance (open rate, click rate, recovery rate)
- [ ] Review subscription churn rate
- [ ] Check for unusual rate limit hits
- [ ] Review Stripe API error logs

**Monthly Maintenance:**
- [ ] Review and update dunning email templates
- [ ] Analyze payment failure reasons
- [ ] Audit customer ID access logs
- [ ] Review Stripe Dashboard for insights
- [ ] Update price IDs if needed (new plans, promotions)

**Quarterly Maintenance:**
- [ ] Rotate webhook secrets
- [ ] Review PCI compliance (SAQ A)
- [ ] Update Stripe SDK versions
- [ ] Audit tax registrations (new jurisdictions)
- [ ] Review and optimize retry schedules

### Critical Documentation Links

**Stripe Official Docs:**
- [Subscriptions Overview](https://docs.stripe.com/billing/subscriptions/overview)
- [Checkout Sessions](https://docs.stripe.com/payments/checkout)
- [Customer Portal](https://docs.stripe.com/customer-management)
- [Webhooks](https://docs.stripe.com/webhooks)
- [Smart Retries](https://docs.stripe.com/billing/revenue-recovery/smart-retries)
- [Stripe Tax](https://docs.stripe.com/tax)
- [Per-Seat Billing](https://docs.stripe.com/billing/subscriptions/per-seat)
- [Free Trials](https://docs.stripe.com/billing/subscriptions/trials)
- [Idempotent Requests](https://docs.stripe.com/api/idempotent_requests)

**Next.js Integration:**
- [Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Webhooks in Next.js](https://nextjs.org/docs/app/building-your-application/routing/route-handlers#dynamic-functions)

**Community Resources:**
- [Stripe Node.js SDK](https://github.com/stripe/stripe-node)
- [Stripe Samples (Next.js)](https://github.com/stripe-samples)
- [Stripe Recommendations by T3](https://github.com/t3dotgg/stripe-recommendations)

### Common Issues & Solutions

**Issue: Webhook signature verification fails**
- **Cause:** Using parsed JSON body instead of raw body
- **Solution:** Use `request.text()` in Next.js App Router, disable `bodyParser` in Pages Router

**Issue: Duplicate subscriptions created**
- **Cause:** Multiple checkout sessions for same user
- **Solution:** Check for existing subscription before creating checkout, enforce unique constraint on `stripe_subscription_id`

**Issue: Payment failures not triggering emails**
- **Cause:** Webhook not processing `invoice.payment_failed` events
- **Solution:** Verify webhook endpoint is registered in Stripe Dashboard, check webhook signature, ensure event handler is implemented

**Issue: Trial not converting after 14 days**
- **Cause:** `trial_settings.end_behavior.missing_payment_method` not set
- **Solution:** Set to `'cancel'` to auto-cancel without payment method

**Issue: Tax calculation failing**
- **Cause:** Customer address incomplete or invalid
- **Solution:** Enable `customer_update: { address: 'auto' }` in Checkout, listen for `invoice.finalization_failed` webhook

**Issue: Prorations incorrect**
- **Cause:** Using `proration_behavior: 'none'` or wrong billing cycle anchor
- **Solution:** Use `proration_behavior: 'create_prorations'`, keep `billing_cycle_anchor: 'unchanged'`

---

## Conclusion

This research document provides production-ready patterns for implementing Stripe subscription billing in Next.js applications. Key takeaways:

1. **Use Stripe's hosted solutions** (Checkout, Customer Portal) to minimize PCI scope and development effort
2. **Implement robust webhook handling** with signature verification and idempotency to ensure data consistency
3. **Enable Smart Retries** for automatic payment recovery and supplement with targeted dunning emails
4. **Enforce business rules at application level** (minimum seats, grace periods) while leveraging Stripe's native features (proration, tax calculation)
5. **Prioritize security** with rate limiting, HTTPS, RLS, and secure customer ID storage
6. **Monitor continuously** for webhook failures, payment issues, and suspicious activity

By following these patterns, Snappd will have a scalable, secure, and user-friendly subscription billing system that maximizes revenue recovery and minimizes churn.

---

**Last Updated:** November 5, 2025
**Maintained By:** Snappd Development Team
**Review Cycle:** Quarterly
