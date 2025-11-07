/**
 * Stripe Client Singleton
 *
 * Provides a centralized, configured Stripe client instance for all billing operations.
 * Uses environment variables for API keys and ensures consistent configuration across the app.
 */

import Stripe from 'stripe';
import { logger } from '@/lib/logger';

// Validate environment variables
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!STRIPE_SECRET_KEY) {
  throw new Error(
    'Missing STRIPE_SECRET_KEY environment variable. Please add it to your .env file.'
  );
}

if (!STRIPE_WEBHOOK_SECRET) {
  logger.warn(
    'Missing STRIPE_WEBHOOK_SECRET environment variable. Webhook signature verification will fail.'
  );
}

/**
 * Singleton Stripe client instance
 *
 * Configuration:
 * - API Version: Latest (automatically updated by stripe-node)
 * - TypeScript: Full type safety enabled
 * - Idempotency: Automatic retry with idempotency keys
 * - Timeout: 80 seconds (Stripe default)
 */
export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  typescript: true,
  maxNetworkRetries: 2, // Retry failed requests twice
  timeout: 80000, // 80 second timeout
  appInfo: {
    name: 'Snappd',
    version: '1.0.0',
    url: 'https://snappd.app',
  },
});

/**
 * Get or create a Stripe customer for a user
 *
 * @param userId - Supabase user ID
 * @param email - User email address
 * @param name - Optional user full name
 * @returns Stripe Customer object
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name?: string | null
): Promise<Stripe.Customer> {
  try {
    // Search for existing customer by email and verify user ID in metadata
    const existingCustomers = await stripe.customers.list({
      email,
      limit: 1,
    });

    // Verify the customer belongs to this user by checking metadata
    if (
      existingCustomers.data.length > 0 &&
      existingCustomers.data[0].metadata?.supabase_user_id === userId
    ) {
      logger.info('Found existing Stripe customer', undefined, {
        customerId: existingCustomers.data[0].id,
        userId,
      });
      return existingCustomers.data[0];
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email,
      name: name ?? undefined,
      metadata: {
        supabase_user_id: userId,
      },
    });

    logger.info('Created new Stripe customer', undefined, {
      customerId: customer.id,
      userId,
    });

    return customer;
  } catch (error) {
    logger.error('Failed to get or create Stripe customer', undefined, {
      error,
      userId,
      email,
    });
    throw error;
  }
}

/**
 * Stripe price IDs for each plan and billing cycle
 *
 * These should be set as environment variables and created in the Stripe Dashboard
 * or via the Stripe API during initial setup.
 */
export const STRIPE_PRICE_IDS = {
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly_placeholder',
    annual: process.env.STRIPE_PRICE_PRO_ANNUAL || 'price_pro_annual_placeholder',
  },
  team: {
    monthly: process.env.STRIPE_PRICE_TEAM_MONTHLY || 'price_team_monthly_placeholder',
    annual: process.env.STRIPE_PRICE_TEAM_ANNUAL || 'price_team_annual_placeholder',
  },
} as const;

/**
 * Get Stripe Price ID for a plan and billing cycle
 *
 * @param planType - 'pro' or 'team'
 * @param billingCycle - 'monthly' or 'annual'
 * @returns Stripe Price ID
 */
export function getStripePriceId(
  planType: 'pro' | 'team',
  billingCycle: 'monthly' | 'annual'
): string {
  const priceId = STRIPE_PRICE_IDS[planType][billingCycle];

  if (priceId.includes('placeholder')) {
    logger.warn('Using placeholder Stripe Price ID', undefined, {
      planType,
      billingCycle,
      priceId,
    });
  }

  return priceId;
}

/**
 * Webhook secret for signature verification
 */
export const STRIPE_WEBHOOK_SECRET_VALUE = STRIPE_WEBHOOK_SECRET || '';

/**
 * Export Stripe types for use throughout the application
 */
export type { Stripe } from 'stripe';

// Re-export commonly used Stripe types with convenient aliases
export type StripeCustomer = Stripe.Customer;
export type StripeSubscription = Stripe.Subscription;
export type StripeInvoice = Stripe.Invoice;
export type StripePaymentMethod = Stripe.PaymentMethod;
export type StripeCheckoutSession = Stripe.Checkout.Session;
export type StripeEvent = Stripe.Event;
