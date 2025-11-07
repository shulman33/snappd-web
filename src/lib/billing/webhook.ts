/**
 * Stripe Webhook Processing Utilities
 *
 * Handles webhook signature verification and event processing with idempotency.
 * Ensures webhooks are authentic and prevents duplicate processing.
 */

import Stripe from 'stripe';
import { stripe, STRIPE_WEBHOOK_SECRET_VALUE } from './stripe';
import { logger } from '@/lib/logger';
import { createServiceClient } from '../supabase/service';

/**
 * Verify Stripe webhook signature
 *
 * @param rawBody - Raw request body (Buffer or string)
 * @param signature - Stripe-Signature header value
 * @param secret - Webhook secret (optional, defaults to env variable)
 * @returns Verified Stripe Event object
 * @throws Error if signature verification fails
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signature: string,
  secret: string = STRIPE_WEBHOOK_SECRET_VALUE
): Stripe.Event {
  try {
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      secret,
      300 // Tolerance in seconds (5 minutes)
    );

    logger.info('Webhook signature verified', undefined, {
      eventId: event.id,
      eventType: event.type,
    });

    return event;
  } catch (error) {
    logger.error('Webhook signature verification failed', undefined, {
      error,
      signature: signature.substring(0, 20) + '...', // Log partial signature for debugging
    });
    throw new Error(`Webhook signature verification failed: ${error}`);
  }
}

/**
 * Check if webhook event has already been processed (idempotency)
 *
 * Uses the stripe_events table to track processed events and prevent duplicate processing.
 * Stripe may send the same webhook multiple times (25%+ are retries).
 *
 * @param eventId - Stripe event ID
 * @returns True if event was already processed
 */
export async function isEventProcessed(eventId: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('stripe_events')
      .select('id')
      .eq('id', eventId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (not an error in this case)
      logger.error('Failed to check event idempotency', undefined, {
        error,
        eventId,
      });
      throw error;
    }

    const isProcessed = !!data;

    if (isProcessed) {
      logger.warn('Duplicate webhook event detected (already processed)', undefined, {
        eventId,
      });
    }

    return isProcessed;
  } catch (error) {
    logger.error('Error checking webhook idempotency', undefined, {
      error,
      eventId,
    });
    throw error;
  }
}

/**
 * Mark webhook event as processed
 *
 * Inserts event ID into stripe_events table to prevent duplicate processing.
 * Uses INSERT with ON CONFLICT to handle race conditions.
 *
 * @param eventId - Stripe event ID
 * @returns True if marked successfully
 */
export async function markEventAsProcessed(eventId: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();

    const { error } = await supabase.from('stripe_events').insert({
      id: eventId,
      processed_at: new Date().toISOString(),
    });

    if (error) {
      // If error code is 23505 (unique violation), event was already processed
      if (error.code === '23505') {
        logger.warn('Event already marked as processed (race condition)', undefined, {
          eventId,
        });
        return false;
      }

      logger.error('Failed to mark event as processed', undefined, {
        error,
        eventId,
      });
      throw error;
    }

    logger.info('Marked event as processed', undefined, { eventId });
    return true;
  } catch (error) {
    logger.error('Error marking event as processed', undefined, {
      error,
      eventId,
    });
    throw error;
  }
}

/**
 * Process Stripe webhook event with idempotency check
 *
 * Generic wrapper that:
 * 1. Checks if event was already processed
 * 2. Executes handler function if not
 * 3. Marks event as processed
 *
 * @param event - Verified Stripe event
 * @param handler - Async function to process the event
 * @returns Result from handler or null if already processed
 */
export async function handleWebhookEvent<T>(
  event: Stripe.Event,
  handler: (event: Stripe.Event) => Promise<T>
): Promise<T | null> {
  // Check idempotency
  const alreadyProcessed = await isEventProcessed(event.id);
  if (alreadyProcessed) {
    logger.info('Skipping duplicate webhook event', undefined, {
      eventId: event.id,
      eventType: event.type,
    });
    return null;
  }

  try {
    // Mark as processed BEFORE executing handler to prevent race conditions
    const marked = await markEventAsProcessed(event.id);
    if (!marked) {
      // Another instance already processing
      logger.info('Another instance processing event, skipping', undefined, {
        eventId: event.id,
      });
      return null;
    }

    // Execute handler
    logger.info('Processing webhook event', undefined, {
      eventId: event.id,
      eventType: event.type,
    });

    const result = await handler(event);

    logger.info('Webhook event processed successfully', undefined, {
      eventId: event.id,
      eventType: event.type,
    });

    return result;
  } catch (error) {
    logger.error('Failed to process webhook event', undefined, {
      error,
      eventId: event.id,
      eventType: event.type,
    });
    throw error;
  }
}

/**
 * Webhook event types we handle
 */
export const HANDLED_WEBHOOK_EVENTS = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.trial_will_end',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'invoice.finalized',
  'checkout.session.completed',
] as const;

export type HandledWebhookEvent = (typeof HANDLED_WEBHOOK_EVENTS)[number];

/**
 * Check if event type is handled
 */
export function isHandledEvent(eventType: string): eventType is HandledWebhookEvent {
  return HANDLED_WEBHOOK_EVENTS.includes(eventType as HandledWebhookEvent);
}
