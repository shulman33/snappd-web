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

/**
 * Webhook retry configuration
 *
 * Stripe will automatically retry webhooks with exponential backoff:
 * - Retries: Up to 3 times over 72 hours
 * - Initial delay: ~1 hour
 * - Max delay: ~48 hours
 *
 * @see https://stripe.com/docs/webhooks#retries
 */
export interface WebhookRetryConfig {
  /** Maximum number of processing attempts */
  maxAttempts: number;
  /** Base delay in milliseconds for exponential backoff */
  baseDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
}

/**
 * Default retry configuration for internal processing
 */
export const DEFAULT_RETRY_CONFIG: WebhookRetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000, // 1 second
  maxDelayMs: 30000, // 30 seconds
};

/**
 * Calculate exponential backoff delay
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  config: WebhookRetryConfig = DEFAULT_RETRY_CONFIG
): number {
  // Exponential backoff: delay = baseDelay * 2^attempt + jitter
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 1000; // Add up to 1 second of jitter
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Process webhook event with retry logic
 *
 * Wraps an event handler with automatic retry on failure.
 * Uses exponential backoff between retries.
 *
 * @param event - Verified Stripe event
 * @param handler - Async function to process the event
 * @param config - Retry configuration
 * @returns Result from handler
 * @throws Error if all retries fail
 */
export async function handleWebhookEventWithRetry<T>(
  event: Stripe.Event,
  handler: (event: Stripe.Event) => Promise<T>,
  config: WebhookRetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      if (attempt > 0) {
        const delay = calculateBackoffDelay(attempt - 1, config);
        logger.info(`Retrying webhook event (attempt ${attempt + 1}/${config.maxAttempts})`, undefined, {
          eventId: event.id,
          eventType: event.type,
          delayMs: delay,
        });
        await sleep(delay);
      }

      const result = await handler(event);

      if (attempt > 0) {
        logger.info('Webhook event succeeded after retry', undefined, {
          eventId: event.id,
          eventType: event.type,
          attempt: attempt + 1,
        });
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      logger.warn(`Webhook event processing attempt ${attempt + 1} failed`, undefined, {
        eventId: event.id,
        eventType: event.type,
        attempt: attempt + 1,
        error: lastError.message,
      });

      // Check if error is retryable
      if (!isRetryableWebhookError(error)) {
        logger.error('Non-retryable webhook error, aborting retries', undefined, {
          eventId: event.id,
          eventType: event.type,
          error: lastError.message,
        });
        throw lastError;
      }
    }
  }

  // All retries exhausted
  logger.error('Webhook event failed after all retries', undefined, {
    eventId: event.id,
    eventType: event.type,
    maxAttempts: config.maxAttempts,
    error: lastError?.message,
  });

  throw lastError || new Error('Webhook processing failed after all retries');
}

/**
 * Check if an error is retryable
 *
 * Some errors should not be retried (e.g., validation errors, not found errors).
 * Others (e.g., database connection, rate limits) should be retried.
 */
export function isRetryableWebhookError(error: unknown): boolean {
  if (!error) return false;

  // Don't retry validation or "not found" errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Non-retryable errors
    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('not found') ||
      message.includes('missing required') ||
      message.includes('unauthorized') ||
      message.includes('forbidden')
    ) {
      return false;
    }

    // Retryable errors
    if (
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('network') ||
      message.includes('rate limit') ||
      message.includes('unavailable') ||
      message.includes('temporary') ||
      message.includes('retry')
    ) {
      return true;
    }
  }

  // Default to retryable for unknown errors
  return true;
}
