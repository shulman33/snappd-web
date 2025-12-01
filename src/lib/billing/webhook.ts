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
 * Check if webhook event has already been processed or is being processed (idempotency)
 *
 * Uses the stripe_events table to track processed events and prevent duplicate processing.
 * Stripe may send the same webhook multiple times (25%+ are retries).
 *
 * Three-state machine:
 * - NULL: Not yet processed (can process)
 * - in_progress: Currently being processed (skip unless stale)
 * - completed: Successfully processed (skip)
 *
 * @param eventId - Stripe event ID
 * @returns Object with processing status information
 */
export async function getEventStatus(eventId: string): Promise<{
  exists: boolean;
  status: 'in_progress' | 'completed' | null;
  isStale: boolean;
  attemptedAt: string | null;
}> {
  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('stripe_events')
      .select('id, status, attempted_at')
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

    if (!data) {
      return {
        exists: false,
        status: null,
        isStale: false,
        attemptedAt: null,
      };
    }

    // Check if event is stale (in_progress for more than 1 hour)
    const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
    const attemptedAt = data.attempted_at ? new Date(data.attempted_at) : null;
    const isStale =
      data.status === 'in_progress' &&
      attemptedAt !== null &&
      Date.now() - attemptedAt.getTime() > STALE_THRESHOLD_MS;

    if (data.status === 'completed') {
      logger.warn('Duplicate webhook event detected (already completed)', undefined, {
        eventId,
      });
    } else if (data.status === 'in_progress' && !isStale) {
      logger.warn('Event already being processed by another instance', undefined, {
        eventId,
        attemptedAt: data.attempted_at,
      });
    } else if (isStale) {
      logger.warn('Found stale in_progress event, will allow reprocessing', undefined, {
        eventId,
        attemptedAt: data.attempted_at,
      });
    }

    return {
      exists: true,
      status: data.status as 'in_progress' | 'completed',
      isStale,
      attemptedAt: data.attempted_at,
    };
  } catch (error) {
    logger.error('Error checking webhook idempotency', undefined, {
      error,
      eventId,
    });
    throw error;
  }
}

/**
 * Check if webhook event has already been processed (idempotency)
 *
 * @param eventId - Stripe event ID
 * @returns True if event was already processed or is being processed
 * @deprecated Use getEventStatus for more detailed status information
 */
export async function isEventProcessed(eventId: string): Promise<boolean> {
  const status = await getEventStatus(eventId);
  // Skip if completed, or if in_progress and not stale
  return status.status === 'completed' || (status.status === 'in_progress' && !status.isStale);
}

/**
 * Mark webhook event as in_progress
 *
 * Atomically inserts event ID into stripe_events table with 'in_progress' status.
 * Uses INSERT to handle race conditions - only one instance can successfully insert.
 *
 * @param eventId - Stripe event ID
 * @returns True if marked as in_progress successfully, false if already exists
 */
export async function markEventInProgress(eventId: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();

    const { error } = await supabase.from('stripe_events').insert({
      id: eventId,
      status: 'in_progress',
      attempted_at: new Date().toISOString(),
    });

    if (error) {
      // If error code is 23505 (unique violation), event already exists
      if (error.code === '23505') {
        logger.warn('Event already exists (race condition handled)', undefined, {
          eventId,
        });
        return false;
      }

      logger.error('Failed to mark event as in_progress', undefined, {
        error,
        eventId,
      });
      throw error;
    }

    logger.info('Marked event as in_progress', undefined, { eventId });
    return true;
  } catch (error) {
    logger.error('Error marking event as in_progress', undefined, {
      error,
      eventId,
    });
    throw error;
  }
}

/**
 * Mark webhook event as completed
 *
 * Updates event status to 'completed' after successful handler execution.
 * Should only be called after the handler has successfully processed the event.
 *
 * @param eventId - Stripe event ID
 * @returns True if marked as completed successfully
 */
export async function markEventCompleted(eventId: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();

    const { error, count } = await supabase
      .from('stripe_events')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', eventId)
      .eq('status', 'in_progress');

    if (error) {
      logger.error('Failed to mark event as completed', undefined, {
        error,
        eventId,
      });
      throw error;
    }

    if (count === 0) {
      logger.warn('Event was not in in_progress state when marking completed', undefined, {
        eventId,
      });
      return false;
    }

    logger.info('Marked event as completed', undefined, { eventId });
    return true;
  } catch (error) {
    logger.error('Error marking event as completed', undefined, {
      error,
      eventId,
    });
    throw error;
  }
}

/**
 * Reset stale in_progress event for reprocessing
 *
 * Deletes an event that was stuck in in_progress state, allowing it to be reprocessed.
 * Only call this after confirming the event is stale via getEventStatus.
 *
 * @param eventId - Stripe event ID
 * @returns True if reset successfully
 */
export async function resetStaleEvent(eventId: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();

    const { error } = await supabase
      .from('stripe_events')
      .delete()
      .eq('id', eventId)
      .eq('status', 'in_progress');

    if (error) {
      logger.error('Failed to reset stale event', undefined, {
        error,
        eventId,
      });
      throw error;
    }

    logger.info('Reset stale event for reprocessing', undefined, { eventId });
    return true;
  } catch (error) {
    logger.error('Error resetting stale event', undefined, {
      error,
      eventId,
    });
    throw error;
  }
}

/**
 * Mark webhook event as processed
 *
 * @deprecated Use markEventInProgress and markEventCompleted instead
 */
export async function markEventAsProcessed(eventId: string): Promise<boolean> {
  // For backward compatibility, this now marks as in_progress
  // The caller is expected to use the new handleWebhookEvent which properly
  // transitions to completed after successful processing
  return markEventInProgress(eventId);
}

/**
 * Process Stripe webhook event with idempotency check
 *
 * Implements a three-state machine pattern for robust idempotency:
 * 1. Check event status (NULL, in_progress, completed)
 * 2. Mark as in_progress atomically (handles race conditions)
 * 3. Execute handler
 * 4. Mark as completed ONLY on success
 *
 * If the handler fails, the event stays in 'in_progress' state and can be
 * reprocessed on Stripe's automatic retry (after 1 hour stale threshold).
 *
 * @param event - Verified Stripe event
 * @param handler - Async function to process the event
 * @returns Result from handler or null if already processed/processing
 */
export async function handleWebhookEvent<T>(
  event: Stripe.Event,
  handler: (event: Stripe.Event) => Promise<T>
): Promise<T | null> {
  // Check current event status
  const eventStatus = await getEventStatus(event.id);

  // Handle already completed events
  if (eventStatus.status === 'completed') {
    logger.info('Skipping duplicate webhook event (already completed)', undefined, {
      eventId: event.id,
      eventType: event.type,
    });
    return null;
  }

  // Handle in_progress events
  if (eventStatus.status === 'in_progress') {
    if (eventStatus.isStale) {
      // Reset stale event to allow reprocessing
      logger.info('Resetting stale in_progress event for reprocessing', undefined, {
        eventId: event.id,
        eventType: event.type,
        attemptedAt: eventStatus.attemptedAt,
      });
      await resetStaleEvent(event.id);
    } else {
      // Another instance is actively processing
      logger.info('Another instance is processing event, skipping', undefined, {
        eventId: event.id,
        eventType: event.type,
        attemptedAt: eventStatus.attemptedAt,
      });
      return null;
    }
  }

  // Atomically mark as in_progress
  const marked = await markEventInProgress(event.id);
  if (!marked) {
    // Another instance won the race
    logger.info('Another instance claimed event processing, skipping', undefined, {
      eventId: event.id,
      eventType: event.type,
    });
    return null;
  }

  // Execute handler
  try {
    logger.info('Processing webhook event', undefined, {
      eventId: event.id,
      eventType: event.type,
    });

    const result = await handler(event);

    // Mark as completed ONLY after successful handler execution
    await markEventCompleted(event.id);

    logger.info('Webhook event processed successfully', undefined, {
      eventId: event.id,
      eventType: event.type,
    });

    return result;
  } catch (error) {
    // Handler failed - event stays in 'in_progress' state
    // Stripe will retry and the event can be reprocessed after stale threshold
    logger.error('Failed to process webhook event (can be retried)', undefined, {
      error,
      eventId: event.id,
      eventType: event.type,
      note: 'Event remains in in_progress state for retry',
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
