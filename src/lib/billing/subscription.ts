/**
 * Subscription Management Helpers
 *
 * Provides utilities for creating and managing Stripe Checkout Sessions,
 * subscriptions, and customer records.
 */

import Stripe from 'stripe';
import { stripe } from './stripe';
import { createServiceClient } from '../supabase/service';
import { logger } from '@/lib/logger';

/**
 * Get or create a Stripe Customer for a user
 *
 * Checks if the user already has a Stripe Customer ID stored in the database.
 * If not, creates a new Stripe Customer and stores the ID.
 *
 * @param userId - Supabase user ID
 * @param email - User's email address
 * @param name - User's full name (optional)
 * @returns Stripe Customer ID
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name?: string | null
): Promise<string> {
  try {
    const supabase = createServiceClient();

    // Check if customer already exists in our database
    const { data: existingCustomer, error: fetchError } = await supabase
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      logger.error('Failed to fetch existing Stripe customer', undefined, {
        error: fetchError,
        userId,
      });
      throw fetchError;
    }

    if (existingCustomer) {
      logger.info('Found existing Stripe customer', undefined, {
        userId,
        stripeCustomerId: existingCustomer.stripe_customer_id,
      });
      return existingCustomer.stripe_customer_id;
    }

    // Create new Stripe Customer
    logger.info('Creating new Stripe customer', undefined, { userId, email });

    const customer = await stripe.customers.create({
      email,
      name: name || undefined,
      metadata: {
        supabase_user_id: userId,
      },
    });

    logger.info('Created Stripe customer', undefined, {
      userId,
      stripeCustomerId: customer.id,
    });

    // Store customer ID in database
    const { error: insertError } = await supabase.from('stripe_customers').insert({
      user_id: userId,
      stripe_customer_id: customer.id,
      email,
      name: name || null,
    });

    if (insertError) {
      logger.error('Failed to store Stripe customer in database', undefined, {
        error: insertError,
        userId,
        stripeCustomerId: customer.id,
      });
      throw insertError;
    }

    return customer.id;
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
 * Plan configuration for Stripe Price IDs
 *
 * These should be set via environment variables in production.
 * Create these products and prices in Stripe Dashboard first.
 */
export const PLAN_PRICE_IDS = {
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'price_pro_monthly',
    annual: process.env.STRIPE_PRICE_PRO_ANNUAL || 'price_pro_annual',
  },
  team: {
    monthly: process.env.STRIPE_PRICE_TEAM_MONTHLY || 'price_team_monthly',
    annual: process.env.STRIPE_PRICE_TEAM_ANNUAL || 'price_team_annual',
  },
} as const;

/**
 * Checkout Session creation parameters
 */
export interface CreateCheckoutSessionParams {
  /** Supabase user ID */
  userId: string;
  /** User's email */
  email: string;
  /** User's full name (optional) */
  name?: string | null;
  /** Plan type */
  planType: 'pro' | 'team';
  /** Billing cycle */
  billingCycle: 'monthly' | 'annual';
  /** Number of seats (required for team plans, must be >= 3) */
  seatCount?: number;
  /** Success redirect URL */
  successUrl: string;
  /** Cancel redirect URL */
  cancelUrl: string;
  /** Include 14-day free trial */
  includeTrial?: boolean;
}

/**
 * Create a Stripe Checkout Session for subscription purchase
 *
 * Creates a hosted Checkout page where users can enter payment details.
 * Supports both Pro (individual) and Team (multi-seat) plans with optional 14-day trials.
 *
 * @param params - Checkout session parameters
 * @returns Stripe Checkout Session with URL for redirect
 *
 * @example
 * ```typescript
 * const session = await createCheckoutSession({
 *   userId: 'user_123',
 *   email: 'user@example.com',
 *   planType: 'pro',
 *   billingCycle: 'monthly',
 *   successUrl: 'https://app.com/success?session_id={CHECKOUT_SESSION_ID}',
 *   cancelUrl: 'https://app.com/pricing',
 *   includeTrial: true
 * });
 *
 * // Redirect user to session.url
 * ```
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<Stripe.Checkout.Session> {
  const {
    userId,
    email,
    name,
    planType,
    billingCycle,
    seatCount,
    successUrl,
    cancelUrl,
    includeTrial = true,
  } = params;

  try {
    logger.info('Creating Checkout session', undefined, {
      userId,
      planType,
      billingCycle,
      seatCount,
    });

    // Validate team plan has seat count
    if (planType === 'team') {
      if (!seatCount || seatCount < 3) {
        throw new Error('Team plans require a minimum of 3 seats');
      }
    }

    // Get or create Stripe Customer
    const customerId = await getOrCreateStripeCustomer(userId, email, name);

    // Get price ID based on plan and billing cycle
    const priceId = PLAN_PRICE_IDS[planType][billingCycle];

    // Build line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price: priceId,
        quantity: planType === 'team' && seatCount ? seatCount : 1,
      },
    ];

    // Build subscription data
    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: {
        supabase_user_id: userId,
        plan_type: planType,
        billing_cycle: billingCycle,
      },
    };

    // Add trial if requested
    if (includeTrial) {
      subscriptionData.trial_period_days = 14;
      subscriptionData.trial_settings = {
        end_behavior: {
          missing_payment_method: 'cancel',
        },
      };
    }

    // Add seat count metadata for team plans
    if (planType === 'team' && seatCount) {
      if (!subscriptionData.metadata) {
        subscriptionData.metadata = {};
      }
      subscriptionData.metadata.seat_count = seatCount.toString();
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: lineItems,
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: subscriptionData,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      payment_method_types: ['card'],
      metadata: {
        supabase_user_id: userId,
        plan_type: planType,
      },
    });

    logger.info('Created Checkout session', undefined, {
      userId,
      sessionId: session.id,
      sessionUrl: session.url,
    });

    return session;
  } catch (error) {
    logger.error('Failed to create Checkout session', undefined, {
      error,
      userId,
      planType,
      billingCycle,
    });
    throw error;
  }
}

/**
 * Create a Customer Portal session for self-service billing management
 *
 * Allows users to update payment methods, view invoices, and cancel subscriptions.
 *
 * @param userId - Supabase user ID
 * @param returnUrl - URL to return to after portal session
 * @returns Stripe Customer Portal Session with URL for redirect
 *
 * @example
 * ```typescript
 * const session = await createPortalSession('user_123', 'https://app.com/settings/billing');
 * // Redirect user to session.url
 * ```
 */
export async function createPortalSession(
  userId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  try {
    logger.info('Creating Customer Portal session', undefined, { userId });

    const supabase = createServiceClient();

    // Get Stripe Customer ID
    const { data: customer, error } = await supabase
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (error || !customer) {
      throw new Error('Stripe customer not found for user');
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: returnUrl,
    });

    logger.info('Created Customer Portal session', undefined, {
      userId,
      sessionId: session.id,
    });

    return session;
  } catch (error) {
    logger.error('Failed to create Customer Portal session', undefined, {
      error,
      userId,
    });
    throw error;
  }
}

/**
 * Get current subscription for a user
 *
 * Retrieves the active or trialing subscription from the database.
 *
 * @param userId - Supabase user ID
 * @returns Subscription record or null if no active subscription
 */
export async function getCurrentSubscription(userId: string) {
  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Failed to fetch current subscription', undefined, {
        error,
        userId,
      });
      throw error;
    }

    return data;
  } catch (error) {
    logger.error('Error fetching current subscription', undefined, {
      error,
      userId,
    });
    throw error;
  }
}
