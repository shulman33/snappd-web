/**
 * POST /api/v1/billing/webhook
 *
 * Stripe webhook handler for subscription lifecycle events
 *
 * Features:
 * - Signature verification to ensure webhook authenticity
 * - Idempotency to prevent duplicate event processing
 * - Comprehensive event handling for subscription lifecycle
 * - Error handling with retry support
 *
 * Security:
 * - HTTPS only
 * - Signature verification required
 * - No authentication needed (webhook uses signature)
 * - Rate limiting applied
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature, handleWebhookEvent, isHandledEvent } from '@/lib/billing/webhook';
import {
  handleCheckoutSessionCompleted,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} from '@/lib/billing/webhook-handlers';
import { ApiErrorHandler, ApiErrorCode } from '@/lib/api/errors';
import { ApiResponse } from '@/lib/api/response';
import { logger } from '@/lib/logger';

/**
 * Webhook endpoint for Stripe events
 *
 * This endpoint receives webhook events from Stripe when subscription-related
 * events occur (e.g., subscription created, payment succeeded, payment failed).
 *
 * Stripe Documentation:
 * https://stripe.com/docs/webhooks
 * https://stripe.com/docs/webhooks/best-practices
 */
export async function POST(request: NextRequest) {
  try {
    logger.info('Received Stripe webhook', request);

    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');

    // Verify signature is present
    if (!signature) {
      logger.warn('Webhook missing signature header', request);
      return ApiErrorHandler.badRequest(
        ApiErrorCode.BAD_REQUEST,
        'Missing Stripe-Signature header',
        undefined,
        request
      );
    }

    // Verify webhook signature
    let event;
    try {
      event = verifyWebhookSignature(rawBody, signature);
    } catch (error) {
      logger.error('Webhook signature verification failed', request, { error });
      return ApiErrorHandler.unauthorized(
        ApiErrorCode.UNAUTHORIZED,
        'Invalid webhook signature',
        undefined,
        request
      );
    }

    logger.info('Webhook signature verified', request, {
      eventId: event.id,
      eventType: event.type,
    });

    // Check if this is an event we handle
    if (!isHandledEvent(event.type)) {
      logger.info('Received unhandled webhook event type', request, {
        eventId: event.id,
        eventType: event.type,
      });
      // Return 200 OK for unhandled events to prevent Stripe retries
      return ApiResponse.success(
        { received: true, handled: false },
        'Event received but not handled'
      );
    }

    // Process event with idempotency check
    const result = await handleWebhookEvent(event, async (event) => {
      logger.info('Processing webhook event', request, {
        eventId: event.id,
        eventType: event.type,
      });

      // Route to appropriate handler based on event type
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutSessionCompleted(event);
          break;

        case 'customer.subscription.created':
          await handleSubscriptionCreated(event);
          break;

        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event);
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event);
          break;

        case 'customer.subscription.trial_will_end':
          // TODO: Implement in Phase 11 (T152)
          logger.info('Trial ending soon', request, { eventId: event.id });
          break;

        case 'invoice.payment_succeeded':
          // TODO: Implement in User Story 4 (T052) and User Story 7 (T121)
          logger.info('Invoice payment succeeded', request, { eventId: event.id });
          break;

        case 'invoice.payment_failed':
          // TODO: Implement in User Story 4 (T049)
          logger.info('Invoice payment failed', request, { eventId: event.id });
          break;

        case 'invoice.finalized':
          // TODO: Implement in User Story 7 (T118)
          logger.info('Invoice finalized', request, { eventId: event.id });
          break;

        default:
          logger.warn('Unhandled event type in switch', request, {
            eventType: event.type,
          });
      }

      return { processed: true };
    });

    if (result === null) {
      // Event was already processed (idempotency)
      logger.info('Duplicate webhook event, returning success', request, {
        eventId: event.id,
      });
      return ApiResponse.success(
        { received: true, duplicate: true },
        'Event already processed'
      );
    }

    logger.info('Webhook event processed successfully', request, {
      eventId: event.id,
      eventType: event.type,
    });

    return ApiResponse.success(
      { received: true, processed: true },
      'Webhook processed successfully'
    );
  } catch (error) {
    logger.error('Webhook processing error', request, { error });

    // Return 500 to trigger Stripe retry
    return ApiErrorHandler.handle(error, {
      request,
      logContext: {
        route: 'POST /api/v1/billing/webhook',
      },
    });
  }
}

/**
 * Webhook Configuration
 *
 * To set up webhooks in Stripe Dashboard:
 * 1. Go to Developers > Webhooks
 * 2. Add endpoint: https://your-domain.com/api/v1/billing/webhook
 * 3. Select events to listen for (see HANDLED_WEBHOOK_EVENTS)
 * 4. Copy webhook signing secret to STRIPE_WEBHOOK_SECRET env variable
 *
 * Testing locally with Stripe CLI:
 * stripe listen --forward-to localhost:3000/api/v1/billing/webhook
 * stripe trigger customer.subscription.created
 *
 * Event Handling Status:
 * - checkout.session.completed: TODO (T027)
 * - customer.subscription.created: TODO (T027)
 * - customer.subscription.updated: TODO (T041, T056, T092)
 * - customer.subscription.deleted: TODO (T106)
 * - customer.subscription.trial_will_end: TODO (T152)
 * - invoice.payment_succeeded: TODO (T052, T121)
 * - invoice.payment_failed: TODO (T049)
 * - invoice.finalized: TODO (T118)
 */
