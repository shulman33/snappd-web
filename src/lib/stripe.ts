/**
 * Stripe client and webhook utilities
 * Handles payment processing and subscription management
 */

import Stripe from 'stripe';

// Environment validation
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable');
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error('Missing STRIPE_WEBHOOK_SECRET environment variable');
}

if (!process.env.STRIPE_PRICE_ID) {
  throw new Error('Missing STRIPE_PRICE_ID environment variable');
}

/**
 * Stripe client singleton
 * API version locked for consistency
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
});

/**
 * Stripe Pro tier price ID (monthly subscription)
 */
export const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRICE_ID;

/**
 * Stripe Team tier price ID (monthly subscription)
 * Falls back to Pro price ID if not set
 */
export const STRIPE_TEAM_PRICE_ID = process.env.STRIPE_TEAM_PRICE_ID || process.env.STRIPE_PRICE_ID;

/**
 * Verify Stripe webhook signature
 * Prevents malicious webhook requests
 * 
 * @param payload - Raw request body as string
 * @param signature - stripe-signature header value
 * @returns Parsed Stripe event or null if invalid
 * 
 * @example
 * const event = verifyWebhookSignature(body, signature);
 * if (!event) {
 *   return new Response('Invalid signature', { status: 400 });
 * }
 */
export const verifyWebhookSignature = (
  payload: string,
  signature: string
): Stripe.Event | null => {
  try {
    return stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return null;
  }
};

/**
 * Create Stripe customer for new user
 * Called during user signup
 * 
 * @param email - User email address
 * @param userId - Supabase user ID (for metadata)
 * @returns Stripe customer ID
 */
export const createCustomer = async (
  email: string,
  userId: string
): Promise<string> => {
  const customer = await stripe.customers.create({
    email,
    metadata: {
      supabase_user_id: userId,
    },
  });

  return customer.id;
};

/**
 * Create Stripe Checkout session for plan upgrade
 * 
 * @param customerId - Stripe customer ID
 * @param plan - Plan to upgrade to ('pro' or 'team')
 * @param successUrl - URL to redirect after successful payment
 * @param cancelUrl - URL to redirect if user cancels
 * @returns Checkout session URL
 */
export const createCheckoutSession = async (
  customerId: string,
  plan: 'pro' | 'team',
  successUrl: string,
  cancelUrl: string
): Promise<string> => {
  const priceId = plan === 'team' ? STRIPE_TEAM_PRICE_ID : STRIPE_PRO_PRICE_ID;
  
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    metadata: {
      plan,
    },
  });

  if (!session.url) {
    throw new Error('Failed to create checkout session');
  }

  return session.url;
};

/**
 * Create Stripe Customer Portal session
 * Allows users to manage subscriptions and billing
 * 
 * @param customerId - Stripe customer ID
 * @param returnUrl - URL to return to after portal session
 * @returns Customer portal URL
 */
export const createPortalSession = async (
  customerId: string,
  returnUrl: string
): Promise<string> => {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
};

