/**
 * POST /api/billing/webhook
 * Handle Stripe webhook events
 * Processes subscription lifecycle events
 * 
 * @public No authentication required (verified via Stripe signature)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyWebhookSignature } from '@/lib/stripe';
import { getSubscriptionFromEvent, getInvoiceFromEvent } from '@/types/stripe';

export async function POST(request: NextRequest) {
  try {
    // 1. Get raw body and signature
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return new Response('Missing stripe-signature header', { status: 400 });
    }

    // 2. Verify webhook signature
    const event = verifyWebhookSignature(body, signature);
    if (!event) {
      // Check if the body is valid JSON - if not, return 400 instead of 401
      try {
        JSON.parse(body);
        return new Response('Invalid signature', { status: 401 });
      } catch (e) {
        return new Response('Invalid JSON payload', { status: 400 });
      }
    }

    // 3. Check idempotency (prevent duplicate processing)
    const { data: existingEvent } = await supabaseAdmin
      .from('stripe_events')
      .select('id')
      .eq('id', event.id)
      .single();

    if (existingEvent) {
      console.log(`Webhook event ${event.id} already processed`);
      return new Response('Event already processed', { status: 200 });
    }

    // 4. Handle event based on type
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = getSubscriptionFromEvent(event);
        if (!subscription) break;

        // Get customer ID and find user
        const customerId = subscription.customer as string;
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!profile) {
          console.error(`Profile not found for customer ${customerId}`);
          break;
        }

        // Update profile with subscription details
        await supabaseAdmin
          .from('profiles')
          .update({
            plan: subscription.status === 'active' ? 'pro' : 'free',
            stripe_subscription_id: subscription.id,
            downgraded_at: null, // Clear downgrade timestamp on upgrade
          })
          .eq('id', profile.id);

        console.log(`Updated profile ${profile.id} to plan: ${subscription.status === 'active' ? 'pro' : 'free'}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = getSubscriptionFromEvent(event);
        if (!subscription) break;

        // Get customer ID and find user
        const customerId = subscription.customer as string;
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!profile) {
          console.error(`Profile not found for customer ${customerId}`);
          break;
        }

        // Downgrade to free tier with grandfathering
        await supabaseAdmin
          .from('profiles')
          .update({
            plan: 'free',
            stripe_subscription_id: null,
            downgraded_at: new Date().toISOString(),
          })
          .eq('id', profile.id);

        console.log(`Downgraded profile ${profile.id} to free tier`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = getInvoiceFromEvent(event);
        if (!invoice) break;

        // Get customer ID and find user
        const customerId = invoice.customer as string;
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id, stripe_subscription_id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!profile) {
          console.error(`Profile not found for customer ${customerId}`);
          break;
        }

        // Check if this is the final retry (Stripe typically retries 3 times)
        if (invoice.attempt_count && invoice.attempt_count >= 3) {
          // Downgrade to free tier after failed retries
          await supabaseAdmin
            .from('profiles')
            .update({
              plan: 'free',
              stripe_subscription_id: null,
              downgraded_at: new Date().toISOString(),
            })
            .eq('id', profile.id);

          console.log(`Downgraded profile ${profile.id} after payment failure`);
        }
        break;
      }

      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }

    // 5. Store event ID for idempotency
    await supabaseAdmin
      .from('stripe_events')
      .insert({ id: event.id });

    return new Response('Webhook processed', { status: 200 });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response('Webhook processing failed', { status: 500 });
  }
}

