/**
 * Stripe webhook event types
 * Typed interfaces for webhook payloads
 */

import type Stripe from 'stripe';

/**
 * Webhook events we handle
 */
export type StripeWebhookEvent =
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.payment_failed';

/**
 * Subscription status enum
 */
export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing';

/**
 * Webhook handler type
 */
export type WebhookHandler = (
  event: Stripe.Event
) => Promise<void>;

/**
 * Extract subscription from webhook event
 */
export const getSubscriptionFromEvent = (
  event: Stripe.Event
): Stripe.Subscription | null => {
  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    return event.data.object as Stripe.Subscription;
  }
  return null;
};

/**
 * Extract invoice from webhook event
 */
export const getInvoiceFromEvent = (
  event: Stripe.Event
): Stripe.Invoice | null => {
  if (event.type === 'invoice.payment_failed') {
    return event.data.object as Stripe.Invoice;
  }
  return null;
};

