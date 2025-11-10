/**
 * Stripe Webhook Event Handlers
 *
 * Implements handlers for specific Stripe webhook events.
 * Each handler is responsible for updating the database based on the event data.
 */

import Stripe from 'stripe'
import { createServiceClient } from '../supabase/service'
import { logger } from '@/lib/logger'

/**
 * Handle checkout.session.completed event
 *
 * This event fires when a user completes the Checkout flow.
 * For subscriptions, we primarily handle subscription creation in customer.subscription.created,
 * but this event is useful for additional metadata or one-time setup.
 *
 * @param event - Stripe webhook event
 */
export async function handleCheckoutSessionCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session

  logger.info('Processing checkout.session.completed', undefined, {
    sessionId: session.id,
    customerId: session.customer,
    subscriptionId: session.subscription,
    mode: session.mode,
  })

  // For subscription mode, the actual subscription record will be created
  // by customer.subscription.created event. This handler can be used for
  // additional processing like analytics tracking or sending confirmation emails.

  if (session.mode === 'subscription') {
    logger.info('Checkout session for subscription completed', undefined, {
      sessionId: session.id,
      subscriptionId: session.subscription,
    })

    // Future: Send checkout completion email
    // Future: Track conversion analytics
  }

  return { processed: true }
}

/**
 * Handle customer.subscription.created event
 *
 * This event fires when a new subscription is created (including trials).
 * Creates a subscription record in our database and updates the user's plan.
 *
 * @param event - Stripe webhook event
 */
export async function handleSubscriptionCreated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  const supabase = createServiceClient()

  logger.info('Processing customer.subscription.created', undefined, {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status,
    trialEnd: subscription.trial_end,
  })

  // Extract metadata
  const userId = subscription.metadata?.supabase_user_id
  const planType = subscription.metadata?.plan_type as 'pro' | 'team'
  const billingCycle = subscription.metadata?.billing_cycle as 'monthly' | 'annual'
  const seatCount = subscription.metadata?.seat_count
    ? parseInt(subscription.metadata.seat_count)
    : null

  if (!userId || !planType || !billingCycle) {
    logger.error('Missing required metadata in subscription', undefined, {
      subscriptionId: subscription.id,
      metadata: subscription.metadata,
    })
    throw new Error('Missing required metadata in subscription')
  }

  // Get Stripe customer ID
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id

  // Get Stripe price ID and billing period from the first item
  const firstItem = subscription.items.data[0]
  const priceId = firstItem?.price.id

  if (!priceId || !firstItem) {
    logger.error('No subscription item or price ID found', undefined, {
      subscriptionId: subscription.id,
    })
    throw new Error('No subscription item or price ID found in subscription')
  }

  // Get billing period from the subscription item
  // Note: In Stripe API 2025-03-31+, billing periods moved to subscription items
  const currentPeriodStart = (firstItem as any).current_period_start || subscription.billing_cycle_anchor
  const currentPeriodEnd = (firstItem as any).current_period_end || subscription.billing_cycle_anchor

  // Determine team_id if this is a team subscription
  let teamId: string | null = null
  if (planType === 'team') {
    // For checkout.session.completed, we might create the team record first
    // For now, we'll create the team record here if it doesn't exist
    const { data: existingTeam } = await supabase
      .from('teams')
      .select('id')
      .eq('admin_user_id', userId)
      .eq('subscription_id', subscription.id)
      .single()

    if (existingTeam) {
      teamId = existingTeam.id
    }
  }

  // Insert subscription record
  const { data: subscriptionRecord, error: subscriptionError } = await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      stripe_price_id: priceId,
      plan_type: planType,
      billing_cycle: billingCycle,
      status: subscription.status as 'trialing' | 'active' | 'past_due' | 'canceled' | 'suspended',
      current_period_start: new Date(currentPeriodStart * 1000).toISOString(),
      current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      seat_count: seatCount,
      team_id: teamId,
    })
    .select()
    .single()

  if (subscriptionError || !subscriptionRecord) {
    logger.error('Failed to create subscription record', undefined, {
      error: subscriptionError,
      subscriptionId: subscription.id,
      userId,
    })
    throw subscriptionError
  }

  logger.info('Created subscription record', undefined, {
    subscriptionId: subscription.id,
    recordId: subscriptionRecord.id,
    userId,
    planType,
    status: subscription.status,
  })

  // Create subscription event audit log
  const { error: eventError } = await supabase.from('subscription_events').insert({
    subscription_id: subscriptionRecord.id,
    user_id: userId,
    event_type: subscription.trial_end ? 'trial_started' : 'created',
    new_plan: planType,
    new_status: subscription.status,
    metadata: {
      stripe_subscription_id: subscription.id,
      billing_cycle: billingCycle,
      seat_count: seatCount,
    },
  })

  if (eventError) {
    logger.warn('Failed to create subscription event log', undefined, {
      error: eventError,
      subscriptionId: subscription.id,
    })
    // Don't throw - audit log failure shouldn't fail the whole process
  }

  // The profile plan update will happen automatically via the database trigger
  // (sync_profile_plan trigger updates profiles.plan when subscription status is active/trialing)

  logger.info('Subscription created successfully', undefined, {
    subscriptionId: subscription.id,
    userId,
    planType,
    status: subscription.status,
    trialEnd: subscription.trial_end,
  })

  return { processed: true, subscriptionRecordId: subscriptionRecord.id }
}

/**
 * Handle customer.subscription.updated event
 *
 * This event fires when a subscription is updated (status change, plan change, etc.).
 * Updates the subscription record in our database.
 *
 * @param event - Stripe webhook event
 */
export async function handleSubscriptionUpdated(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  const supabase = createServiceClient()

  logger.info('Processing customer.subscription.updated', undefined, {
    subscriptionId: subscription.id,
    status: subscription.status,
  })

  // Get existing subscription record
  const { data: existingSubscription, error: fetchError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (fetchError || !existingSubscription) {
    logger.error('Subscription record not found for update', undefined, {
      error: fetchError,
      subscriptionId: subscription.id,
    })
    throw new Error('Subscription record not found')
  }

  // Get billing period from the subscription item
  // Note: In Stripe API 2025-03-31+, billing periods moved to subscription items
  const firstItem = subscription.items.data[0]
  const currentPeriodStart = (firstItem as any)?.current_period_start || subscription.billing_cycle_anchor
  const currentPeriodEnd = (firstItem as any)?.current_period_end || subscription.billing_cycle_anchor

  // Update subscription record
  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      status: subscription.status as 'trialing' | 'active' | 'past_due' | 'canceled' | 'suspended',
      current_period_start: new Date(currentPeriodStart * 1000).toISOString(),
      current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
    })
    .eq('stripe_subscription_id', subscription.id)

  if (updateError) {
    logger.error('Failed to update subscription record', undefined, {
      error: updateError,
      subscriptionId: subscription.id,
    })
    throw updateError
  }

  logger.info('Updated subscription record', undefined, {
    subscriptionId: subscription.id,
    oldStatus: existingSubscription.status,
    newStatus: subscription.status,
  })

  // Create subscription event audit log
  const { error: eventError } = await supabase.from('subscription_events').insert({
    subscription_id: existingSubscription.id,
    user_id: existingSubscription.user_id,
    event_type: 'upgraded', // Will be refined in future stories
    previous_status: existingSubscription.status,
    new_status: subscription.status,
    metadata: {
      stripe_subscription_id: subscription.id,
    },
  })

  if (eventError) {
    logger.warn('Failed to create subscription event log', undefined, {
      error: eventError,
      subscriptionId: subscription.id,
    })
  }

  return { processed: true }
}

/**
 * Handle customer.subscription.deleted event
 *
 * This event fires when a subscription is canceled/deleted.
 * Updates the subscription status and reverts user to free plan.
 *
 * @param event - Stripe webhook event
 */
export async function handleSubscriptionDeleted(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  const supabase = createServiceClient()

  logger.info('Processing customer.subscription.deleted', undefined, {
    subscriptionId: subscription.id,
  })

  // Get existing subscription record
  const { data: existingSubscription, error: fetchError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (fetchError || !existingSubscription) {
    logger.error('Subscription record not found for deletion', undefined, {
      error: fetchError,
      subscriptionId: subscription.id,
    })
    throw new Error('Subscription record not found')
  }

  // Update subscription to canceled status
  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id)

  if (updateError) {
    logger.error('Failed to update subscription to canceled', undefined, {
      error: updateError,
      subscriptionId: subscription.id,
    })
    throw updateError
  }

  logger.info('Subscription marked as canceled', undefined, {
    subscriptionId: subscription.id,
    userId: existingSubscription.user_id,
  })

  // Create subscription event audit log
  const { error: eventError } = await supabase.from('subscription_events').insert({
    subscription_id: existingSubscription.id,
    user_id: existingSubscription.user_id,
    event_type: 'canceled',
    previous_status: existingSubscription.status,
    new_status: 'canceled',
    metadata: {
      stripe_subscription_id: subscription.id,
      canceled_at: subscription.canceled_at,
    },
  })

  if (eventError) {
    logger.warn('Failed to create subscription event log', undefined, {
      error: eventError,
      subscriptionId: subscription.id,
    })
  }

  // Profile plan will be automatically reverted to 'free' by the database trigger

  return { processed: true }
}
