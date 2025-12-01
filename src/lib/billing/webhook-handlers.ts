/**
 * Stripe Webhook Event Handlers
 *
 * Implements handlers for specific Stripe webhook events.
 * Each handler is responsible for updating the database based on the event data.
 */

import Stripe from 'stripe'
import { createServiceClient } from '../supabase/service'
import { logger } from '@/lib/logger'
import { sendInvoiceEmail } from '@/lib/email/templates/invoice'
import { sendTrialEndingEmail } from '@/lib/email/templates/trial-ending'
import { sendSubscriptionCreatedEmail } from '@/lib/email/templates/subscription-created'
import { sendPaymentFailedEmail } from '@/lib/email/templates/payment-failed'
import { getPlanPrice } from './stripe'

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
  const currentPeriodStart = firstItem.current_period_start ?? subscription.billing_cycle_anchor
  const currentPeriodEnd = firstItem.current_period_end ?? subscription.billing_cycle_anchor

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

  // Get user profile for email
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', userId)
    .single()

  if (profile?.email) {
    // Send welcome email
    try {
      const isTrialing = subscription.status === 'trialing'
      const planPrice = getPlanPrice(planType, billingCycle)
      const features = getPlanFeatures(planType)

      // Format dates
      const formatDate = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

      await sendSubscriptionCreatedEmail(profile.email, {
        userName: profile.full_name || undefined,
        planName: planType === 'pro' ? 'Pro' : 'Team',
        billingCycle,
        price: planPrice,
        trialEndDate: subscription.trial_end ? formatDate(subscription.trial_end) : undefined,
        nextBillingDate: formatDate(currentPeriodEnd),
        dashboardUrl: `${baseUrl}/dashboard`,
        features,
        isTrialing,
      })

      logger.info('Subscription welcome email sent', undefined, {
        subscriptionId: subscription.id,
        userId,
        email: profile.email,
      })
    } catch (emailError) {
      logger.error('Failed to send subscription welcome email', undefined, {
        error: emailError,
        subscriptionId: subscription.id,
        userId,
      })
      // Don't throw - email failure shouldn't fail the webhook
    }
  } else if (profileError) {
    logger.warn('Could not fetch user profile for welcome email', undefined, {
      error: profileError,
      userId,
    })
  }

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
 * Get plan features for email template
 */
function getPlanFeatures(planType: 'pro' | 'team'): string[] {
  if (planType === 'pro') {
    return [
      'Unlimited screenshots',
      'Unlimited storage',
      'No watermarks',
      'Priority support',
      'Advanced analytics',
    ]
  }

  return [
    'Everything in Pro',
    'Team collaboration',
    'Admin controls',
    'Centralized billing',
    'Custom branding',
  ]
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
  const firstItem = subscription.items.data[0]
  const currentPeriodStart = firstItem?.current_period_start ?? subscription.billing_cycle_anchor
  const currentPeriodEnd = firstItem?.current_period_end ?? subscription.billing_cycle_anchor

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

  // Detect grace period expiration and suspension (T056)
  // When a past_due subscription remains unpaid after 14 days, it should be suspended
  if (existingSubscription.status === 'past_due') {
    const { data: firstAttempt } = await supabase
      .from('dunning_attempts')
      .select('attempt_date')
      .eq('subscription_id', existingSubscription.id)
      .eq('attempt_number', 1)
      .single()

    if (firstAttempt) {
      const GRACE_PERIOD_DAYS = 14
      const gracePeriodStart = new Date(firstAttempt.attempt_date)
      const gracePeriodEnd = new Date(gracePeriodStart)
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + GRACE_PERIOD_DAYS)
      const now = new Date()

      // Check if grace period has expired
      if (now > gracePeriodEnd && subscription.status === 'past_due') {
        logger.warn('Grace period expired - suspending subscription', undefined, {
          subscriptionId: subscription.id,
          userId: existingSubscription.user_id,
          gracePeriodStart: gracePeriodStart.toISOString(),
          gracePeriodEnd: gracePeriodEnd.toISOString(),
        })

        // Update subscription to suspended status
        const { error: suspensionError } = await supabase
          .from('subscriptions')
          .update({
            status: 'suspended',
          })
          .eq('id', existingSubscription.id)

        if (suspensionError) {
          logger.error('Failed to suspend subscription', undefined, {
            error: suspensionError,
            subscriptionId: existingSubscription.id,
          })
        } else {
          // Create subscription event for suspension
          await supabase.from('subscription_events').insert({
            subscription_id: existingSubscription.id,
            user_id: existingSubscription.user_id,
            event_type: 'suspended',
            previous_status: 'past_due',
            new_status: 'suspended',
            metadata: {
              stripe_subscription_id: subscription.id,
              grace_period_start: gracePeriodStart.toISOString(),
              grace_period_end: gracePeriodEnd.toISOString(),
              reason: 'grace_period_expired',
            },
          })

          logger.info('Subscription suspended after grace period expiration', undefined, {
            subscriptionId: existingSubscription.id,
            userId: existingSubscription.user_id,
          })

          // TODO: Send suspension notification email (future enhancement)
          // This would inform user their premium features have been revoked
          // and encourage them to update their payment method
        }
      }
    }
  }

  // Detect billing period renewal (monthly quota reset)
  const periodChanged =
    existingSubscription.current_period_start !== new Date(currentPeriodStart * 1000).toISOString()

  if (periodChanged && subscription.status === 'active') {
    logger.info('Billing period renewed, resetting monthly quota', undefined, {
      subscriptionId: subscription.id,
      userId: existingSubscription.user_id,
      oldPeriodStart: existingSubscription.current_period_start,
      newPeriodStart: new Date(currentPeriodStart * 1000).toISOString(),
    })

    // Create new usage record for the new billing period
    const { error: usageError } = await supabase
      .from('usage_records')
      .insert({
        user_id: existingSubscription.user_id,
        period_start: new Date(currentPeriodStart * 1000).toISOString(),
        period_end: new Date(currentPeriodEnd * 1000).toISOString(),
        screenshot_count: 0,
        storage_bytes: 0,
        bandwidth_bytes: 0,
      })

    if (usageError) {
      logger.warn('Failed to create new usage record for billing period', undefined, {
        error: usageError,
        subscriptionId: subscription.id,
        userId: existingSubscription.user_id,
      })
      // Don't throw - usage record creation failure shouldn't fail the webhook
    }
  }

  // Detect plan downgrade (T092)
  // When a user downgrades via Customer Portal, Stripe creates proration automatically
  // and credits are applied to the customer's balance for future invoices
  const newPlanType = subscription.metadata?.plan_type as 'pro' | 'team' | 'free' | undefined
  const isPlanDowngrade =
    newPlanType &&
    existingSubscription.plan_type &&
    ((existingSubscription.plan_type === 'team' && ['pro', 'free'].includes(newPlanType)) ||
      (existingSubscription.plan_type === 'pro' && newPlanType === 'free'))

  if (isPlanDowngrade) {
    logger.info('Plan downgrade detected', undefined, {
      subscriptionId: subscription.id,
      userId: existingSubscription.user_id,
      oldPlan: existingSubscription.plan_type,
      newPlan: newPlanType,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: new Date(currentPeriodEnd * 1000).toISOString(),
    })

    // When cancel_at_period_end is true, user maintains current plan until period ends
    // Stripe automatically handles proration and credits the customer balance
    // The credit will be applied to their next invoice automatically

    // Note: We track downgrade scheduling but don't manually calculate credits
    // Stripe's proration system handles this automatically when the subscription is updated
    // Customer balance credits are applied via Stripe's invoice.created event

    // Create subscription event for downgrade audit trail
    await supabase.from('subscription_events').insert({
      subscription_id: existingSubscription.id,
      user_id: existingSubscription.user_id,
      event_type: 'downgraded',
      previous_plan: existingSubscription.plan_type,
      new_plan: newPlanType,
      previous_status: existingSubscription.status,
      new_status: subscription.status,
      metadata: {
        stripe_subscription_id: subscription.id,
        cancel_at_period_end: subscription.cancel_at_period_end,
        current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
        scheduled_downgrade: subscription.cancel_at_period_end,
      },
    })

    logger.info('Downgrade event logged', undefined, {
      subscriptionId: subscription.id,
      userId: existingSubscription.user_id,
      scheduledFor: subscription.cancel_at_period_end
        ? new Date(currentPeriodEnd * 1000).toISOString()
        : 'immediate',
    })
  } else {
    // Create subscription event audit log for non-downgrade updates
    const { error: eventError } = await supabase.from('subscription_events').insert({
      subscription_id: existingSubscription.id,
      user_id: existingSubscription.user_id,
      event_type: 'updated',
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

  // Calculate data retention end date (90 days from cancellation)
  const DATA_RETENTION_DAYS = 90
  const canceledAt = new Date()
  const dataRetentionUntil = new Date(canceledAt)
  dataRetentionUntil.setDate(dataRetentionUntil.getDate() + DATA_RETENTION_DAYS)

  // Update subscription to canceled status
  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: canceledAt.toISOString(),
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
    dataRetentionUntil: dataRetentionUntil.toISOString(),
  })

  // Create subscription event audit log with data retention information
  const { error: eventError } = await supabase.from('subscription_events').insert({
    subscription_id: existingSubscription.id,
    user_id: existingSubscription.user_id,
    event_type: 'canceled',
    previous_status: existingSubscription.status,
    new_status: 'canceled',
    metadata: {
      stripe_subscription_id: subscription.id,
      canceled_at: subscription.canceled_at,
      data_retention_until: dataRetentionUntil.toISOString(),
      data_retention_days: DATA_RETENTION_DAYS,
      cancellation_reason: subscription.cancellation_details?.reason || null,
      cancellation_feedback: subscription.cancellation_details?.feedback || null,
    },
  })

  if (eventError) {
    logger.warn('Failed to create subscription event log', undefined, {
      error: eventError,
      subscriptionId: subscription.id,
    })
  }

  // Profile plan will be automatically reverted to 'free' by the database trigger

  return { processed: true, dataRetentionUntil: dataRetentionUntil.toISOString() }
}

/**
 * Handle customer.subscription.trial_will_end event
 *
 * This event fires 3 days before a trial ends.
 * Sends a reminder email to encourage conversion to paid subscription.
 *
 * @param event - Stripe webhook event
 */
export async function handleTrialWillEnd(event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription
  const supabase = createServiceClient()

  logger.info('Processing customer.subscription.trial_will_end', undefined, {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    trialEnd: subscription.trial_end,
  })

  // Extract metadata
  const userId = subscription.metadata?.supabase_user_id
  const planType = subscription.metadata?.plan_type as 'pro' | 'team'

  if (!userId || !planType) {
    logger.error('Missing required metadata in subscription for trial ending', undefined, {
      subscriptionId: subscription.id,
      metadata: subscription.metadata,
    })
    throw new Error('Missing required metadata in subscription')
  }

  // Get user profile for email
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    logger.error('Could not find user for trial ending notification', undefined, {
      subscriptionId: subscription.id,
      userId,
      error: profileError,
    })
    throw new Error('User not found for trial ending notification')
  }

  // Calculate days remaining
  const trialEndTimestamp = subscription.trial_end || 0
  const now = Math.floor(Date.now() / 1000)
  const secondsRemaining = trialEndTimestamp - now
  const daysRemaining = Math.max(1, Math.ceil(secondsRemaining / 86400))

  // Format trial end date
  const trialEndDate = new Date(trialEndTimestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Send trial ending email
  if (profile.email) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const features = getPlanFeatures(planType)

      await sendTrialEndingEmail(profile.email, {
        userName: profile.full_name || undefined,
        planName: planType === 'pro' ? 'Pro' : 'Team',
        trialEndDate,
        daysRemaining,
        upgradeUrl: `${baseUrl}/billing`,
        features,
      })

      logger.info('Trial ending email sent', undefined, {
        subscriptionId: subscription.id,
        userId,
        email: profile.email,
        daysRemaining,
      })
    } catch (emailError) {
      logger.error('Failed to send trial ending email', undefined, {
        error: emailError,
        subscriptionId: subscription.id,
        userId,
      })
      // Don't throw - email failure shouldn't fail the webhook
    }
  }

  // Create subscription event audit log
  const { data: subscriptionRecord } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .single()

  if (subscriptionRecord) {
    const { error: eventError } = await supabase.from('subscription_events').insert({
      subscription_id: subscriptionRecord.id,
      user_id: userId,
      event_type: 'trial_ending',
      new_status: subscription.status,
      metadata: {
        stripe_subscription_id: subscription.id,
        trial_end: trialEndTimestamp,
        days_remaining: daysRemaining,
      },
    })

    if (eventError) {
      logger.warn('Failed to create trial ending event log', undefined, {
        error: eventError,
        subscriptionId: subscription.id,
      })
    }
  }

  logger.info('Trial will end notification processed', undefined, {
    subscriptionId: subscription.id,
    userId,
    daysRemaining,
    trialEndDate,
  })

  return { processed: true, daysRemaining }
}

/**
 * Handle invoice.finalized event
 *
 * This event fires when an invoice is finalized and ready for payment.
 * Creates an invoice record in our database with PDF download URL.
 *
 * @param event - Stripe webhook event
 */
export async function handleInvoiceFinalized(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice
  const supabase = createServiceClient()

  // Extract subscription ID from parent.subscription_details (Stripe API 2025-03-31+)
  const stripeSubscriptionId =
    invoice.parent?.subscription_details?.subscription
      ? typeof invoice.parent.subscription_details.subscription === 'string'
        ? invoice.parent.subscription_details.subscription
        : invoice.parent.subscription_details.subscription.id
      : null

  logger.info('Processing invoice.finalized', undefined, {
    invoiceId: invoice.id,
    customerId: invoice.customer,
    subscriptionId: stripeSubscriptionId,
    total: invoice.total,
  })

  // Get user from Stripe customer ID
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id

  if (!customerId) {
    logger.error('No customer ID on invoice', undefined, { invoiceId: invoice.id })
    throw new Error('No customer ID on invoice')
  }

  // Find user by Stripe customer ID
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (profileError || !profile) {
    logger.error('Could not find user for invoice', undefined, {
      invoiceId: invoice.id,
      customerId,
      error: profileError,
    })
    throw new Error('User not found for invoice')
  }

  // Look up our internal subscription record using the extracted subscription ID
  let internalSubscriptionId: string | null = null
  if (stripeSubscriptionId) {
    const { data: subscriptionRecord } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .single()

    internalSubscriptionId = subscriptionRecord?.id || null
  }

  // Extract line items (Stripe API 2025-03-31+ uses pricing.unit_amount_decimal)
  const lineItems = invoice.lines.data.map((line) => ({
    description: line.description || 'Subscription',
    quantity: line.quantity || 1,
    unit_amount: line.pricing?.unit_amount_decimal
      ? Math.round(parseFloat(line.pricing.unit_amount_decimal) * 100)
      : 0,
    amount: line.amount,
  }))

  // Calculate total tax from total_taxes array (Stripe API 2025-03-31+)
  const totalTax = invoice.total_taxes?.reduce((sum, tax) => sum + tax.amount, 0) || 0

  // Insert invoice record
  const { data: invoiceRecord, error: insertError } = await supabase
    .from('invoices')
    .insert({
      user_id: profile.id,
      subscription_id: internalSubscriptionId,
      stripe_invoice_id: invoice.id,
      stripe_hosted_invoice_url: invoice.hosted_invoice_url,
      stripe_invoice_pdf: invoice.invoice_pdf,
      invoice_number: invoice.number || `INV-${invoice.id.slice(-8).toUpperCase()}`,
      status: invoice.status as 'draft' | 'open' | 'paid' | 'void' | 'uncollectible',
      subtotal: invoice.subtotal,
      tax: totalTax,
      total: invoice.total,
      amount_paid: invoice.amount_paid,
      amount_due: invoice.amount_due,
      line_items: lineItems,
      period_start: invoice.period_start
        ? new Date(invoice.period_start * 1000).toISOString()
        : new Date().toISOString(),
      period_end: invoice.period_end
        ? new Date(invoice.period_end * 1000).toISOString()
        : new Date().toISOString(),
      due_date: invoice.due_date
        ? new Date(invoice.due_date * 1000).toISOString()
        : null,
    })
    .select()
    .single()

  if (insertError || !invoiceRecord) {
    logger.error('Failed to create invoice record', undefined, {
      error: insertError,
      invoiceId: invoice.id,
      userId: profile.id,
    })
    throw insertError
  }

  logger.info('Invoice record created', undefined, {
    invoiceId: invoice.id,
    recordId: invoiceRecord.id,
    userId: profile.id,
    total: invoice.total,
    tax: totalTax,
  })

  return { processed: true, invoiceRecordId: invoiceRecord.id }
}

/**
 * Handle invoice.payment_succeeded event
 *
 * This event fires when an invoice payment is successful.
 * Updates the invoice record and sends the invoice email with PDF link.
 *
 * @param event - Stripe webhook event
 */
export async function handleInvoicePaymentSucceeded(event: Stripe.Event) {
  const invoice = event.data.object as InvoiceWithOptionalFields
  const supabase = createServiceClient()

  logger.info('Processing invoice.payment_succeeded', undefined, {
    invoiceId: invoice.id,
    customerId: invoice.customer,
    total: invoice.total,
  })

  // Get user from Stripe customer ID
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id

  if (!customerId) {
    logger.error('No customer ID on invoice', undefined, { invoiceId: invoice.id })
    throw new Error('No customer ID on invoice')
  }

  // Find user profile with email
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('stripe_customer_id', customerId)
    .single()

  if (profileError || !profile) {
    logger.error('Could not find user for invoice', undefined, {
      invoiceId: invoice.id,
      customerId,
      error: profileError,
    })
    throw new Error('User not found for invoice')
  }

  // Check if subscription was in past_due status (payment recovery - T052)
  const stripeSubscriptionId =
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id

  let wasInPastDue = false
  let subscriptionRecord: any = null

  if (stripeSubscriptionId) {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .single()

    if (subscription) {
      subscriptionRecord = subscription
      wasInPastDue = subscription.status === 'past_due'

      // If subscription was past_due, update to active (payment recovered)
      if (wasInPastDue) {
        const { error: recoveryError } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
          })
          .eq('id', subscription.id)

        if (recoveryError) {
          logger.error('Failed to update subscription from past_due to active', undefined, {
            error: recoveryError,
            subscriptionId: subscription.id,
          })
        } else {
          logger.info('Payment recovered - subscription updated to active', undefined, {
            subscriptionId: subscription.id,
            userId: profile.id,
          })

          // Create subscription event for recovery
          await supabase.from('subscription_events').insert({
            subscription_id: subscription.id,
            user_id: profile.id,
            event_type: 'payment_recovered',
            previous_status: 'past_due',
            new_status: 'active',
            metadata: {
              stripe_invoice_id: invoice.id,
              amount_paid: invoice.amount_paid,
            },
          })

          // Mark any pending dunning attempts as successful
          await supabase
            .from('dunning_attempts')
            .update({
              payment_result: 'success',
            })
            .eq('subscription_id', subscription.id)
            .eq('payment_result', 'failed')
        }
      }
    }
  }

  // Update invoice record to paid status
  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      status: 'paid',
      amount_paid: invoice.amount_paid,
      amount_due: invoice.amount_due,
      paid_at: new Date().toISOString(),
    })
    .eq('stripe_invoice_id', invoice.id)

  if (updateError) {
    logger.warn('Failed to update invoice status to paid', undefined, {
      error: updateError,
      invoiceId: invoice.id,
    })
    // Don't throw - continue to send email
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: invoice.currency?.toUpperCase() || 'USD',
    }).format(amount / 100)
  }

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  // Determine plan name from line items
  const planName = invoice.lines.data[0]?.description || 'Snappd Subscription'

  // Calculate total tax from total_taxes array (Stripe API 2025-03-31+)
  const totalTax = invoice.total_taxes?.reduce((sum, tax) => sum + tax.amount, 0) || 0

  // Send invoice email
  try {
    if (profile.email && invoice.hosted_invoice_url && invoice.invoice_pdf) {
      await sendInvoiceEmail(profile.email, {
        invoiceNumber: invoice.number || `INV-${invoice.id.slice(-8).toUpperCase()}`,
        invoiceUrl: invoice.hosted_invoice_url,
        pdfUrl: invoice.invoice_pdf,
        total: formatCurrency(invoice.total),
        subtotal: formatCurrency(invoice.subtotal),
        tax: totalTax ? formatCurrency(totalTax) : undefined,
        periodStart: invoice.period_start ? formatDate(invoice.period_start) : '',
        periodEnd: invoice.period_end ? formatDate(invoice.period_end) : '',
        planName,
        userName: profile.full_name || undefined,
      })

      logger.info('Invoice email sent', undefined, {
        invoiceId: invoice.id,
        userId: profile.id,
        email: profile.email,
      })
    } else {
      logger.warn('Could not send invoice email - missing data', undefined, {
        invoiceId: invoice.id,
        hasEmail: !!profile.email,
        hasHostedUrl: !!invoice.hosted_invoice_url,
        hasPdfUrl: !!invoice.invoice_pdf,
      })
    }
  } catch (emailError) {
    logger.error('Failed to send invoice email', undefined, {
      error: emailError,
      invoiceId: invoice.id,
      userId: profile.id,
    })
    // Don't throw - email failure shouldn't fail the webhook
  }

  return { processed: true }
}

/**
 * Handle invoice.payment_failed event
 *
 * This event fires when an invoice payment fails.
 * Implements dunning management with:
 * - Grace period tracking (14 days)
 * - Escalating email notifications (attempt 1, 2, 3)
 * - Subscription status update to 'past_due'
 * - Dunning attempt tracking in database
 *
 * @param event - Stripe webhook event
 */
export async function handleInvoicePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice
  const supabase = createServiceClient()

  logger.info('Processing invoice.payment_failed', undefined, {
    invoiceId: invoice.id,
    customerId: invoice.customer,
    subscriptionId: invoice.subscription,
    attemptCount: invoice.attempt_count,
  })

  // Get Stripe subscription ID
  const stripeSubscriptionId =
    typeof invoiceSubscription === 'string' ? invoiceSubscription : invoiceSubscription?.id

  if (!stripeSubscriptionId) {
    logger.error('No subscription on failed invoice', undefined, { invoiceId: invoice.id })
    throw new Error('No subscription on failed invoice')
  }

  // Get user from Stripe customer ID
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id

  if (!customerId) {
    logger.error('No customer ID on invoice', undefined, { invoiceId: invoice.id })
    throw new Error('No customer ID on invoice')
  }

  // Find user profile with email
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name, plan')
    .eq('stripe_customer_id', customerId)
    .single()

  if (profileError || !profile) {
    logger.error('Could not find user for failed payment', undefined, {
      invoiceId: invoice.id,
      customerId,
      error: profileError,
    })
    throw new Error('User not found for failed payment')
  }

  // Get our internal subscription record
  const { data: subscriptionRecord, error: subscriptionError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .single()

  if (subscriptionError || !subscriptionRecord) {
    logger.error('Could not find subscription for failed payment', undefined, {
      invoiceId: invoice.id,
      stripeSubscriptionId,
      error: subscriptionError,
    })
    throw new Error('Subscription not found for failed payment')
  }

  // Update subscription status to 'past_due' if not already
  if (subscriptionRecord.status !== 'past_due') {
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: 'past_due',
      })
      .eq('id', subscriptionRecord.id)

    if (updateError) {
      logger.error('Failed to update subscription to past_due', undefined, {
        error: updateError,
        subscriptionId: subscriptionRecord.id,
      })
      throw updateError
    }

    logger.info('Updated subscription status to past_due', undefined, {
      subscriptionId: subscriptionRecord.id,
      userId: profile.id,
    })
  }

  // Check for existing dunning attempts to determine attempt number
  const { data: existingAttempts, error: attemptsError } = await supabase
    .from('dunning_attempts')
    .select('attempt_number')
    .eq('subscription_id', subscriptionRecord.id)
    .order('attempt_number', { ascending: false })
    .limit(1)

  if (attemptsError) {
    logger.error('Failed to query existing dunning attempts', undefined, {
      error: attemptsError,
      subscriptionId: subscriptionRecord.id,
    })
    throw attemptsError
  }

  const attemptNumber = existingAttempts.length > 0 ? existingAttempts[0].attempt_number + 1 : 1

  // Calculate next retry date based on attempt number
  // Attempt 1 -> Day 3, Attempt 2 -> Day 7, Attempt 3 -> Day 14
  const retrySchedule = { 1: 3, 2: 7, 3: 14 }
  const daysUntilNextRetry = retrySchedule[attemptNumber as 1 | 2 | 3] || 14
  const nextRetryDate = new Date()
  nextRetryDate.setDate(nextRetryDate.getDate() + daysUntilNextRetry)

  // Calculate days remaining in grace period (14 days from first failure)
  let gracePeriodStart: Date
  if (attemptNumber === 1) {
    gracePeriodStart = new Date()
  } else {
    // Get the first attempt date
    const { data: firstAttempt } = await supabase
      .from('dunning_attempts')
      .select('attempt_date')
      .eq('subscription_id', subscriptionRecord.id)
      .eq('attempt_number', 1)
      .single()

    gracePeriodStart = firstAttempt ? new Date(firstAttempt.attempt_date) : new Date()
  }

  const GRACE_PERIOD_DAYS = 14
  const gracePeriodEnd = new Date(gracePeriodStart)
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + GRACE_PERIOD_DAYS)
  const daysRemaining = Math.max(
    0,
    Math.ceil((gracePeriodEnd.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  )

  // Extract failure reason from Stripe
  const failureReason =
    invoice.last_payment_error?.message ||
    invoice.last_payment_error?.code ||
    'Payment method declined'

  // Insert dunning attempt record
  const { error: dunningError } = await supabase.from('dunning_attempts').insert({
    subscription_id: subscriptionRecord.id,
    attempt_number: attemptNumber,
    attempt_date: new Date().toISOString(),
    payment_result: 'failed',
    failure_reason: failureReason,
    next_retry_date: attemptNumber < 3 ? nextRetryDate.toISOString() : null,
    notification_sent: false,
  })

  if (dunningError) {
    logger.error('Failed to create dunning attempt record', undefined, {
      error: dunningError,
      subscriptionId: subscriptionRecord.id,
      attemptNumber,
    })
    throw dunningError
  }

  logger.info('Created dunning attempt record', undefined, {
    subscriptionId: subscriptionRecord.id,
    attemptNumber,
    nextRetryDate: nextRetryDate.toISOString(),
    daysRemaining,
  })

  // Create subscription event audit log
  const { error: eventError } = await supabase.from('subscription_events').insert({
    subscription_id: subscriptionRecord.id,
    user_id: profile.id,
    event_type: 'payment_failed',
    previous_status: subscriptionRecord.status === 'past_due' ? 'past_due' : 'active',
    new_status: 'past_due',
    metadata: {
      stripe_invoice_id: invoice.id,
      attempt_count: invoice.attempt_count,
      attempt_number: attemptNumber,
      failure_reason: failureReason,
      amount_due: invoice.amount_due,
      next_retry_date: attemptNumber < 3 ? nextRetryDate.toISOString() : null,
      grace_period_ends: gracePeriodEnd.toISOString(),
      days_remaining: daysRemaining,
    },
  })

  if (eventError) {
    logger.warn('Failed to create payment failure event log', undefined, {
      error: eventError,
      subscriptionId: subscriptionRecord.id,
    })
    // Don't throw - audit log failure shouldn't fail the webhook
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: invoice.currency?.toUpperCase() || 'USD',
    }).format(amount / 100)
  }

  // Get plan name
  const planName =
    subscriptionRecord.plan_type === 'pro'
      ? 'Pro'
      : subscriptionRecord.plan_type === 'team'
        ? 'Team'
        : 'Subscription'

  // Get Customer Portal URL for payment method update
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const updatePaymentUrl = `${baseUrl}/billing`

  // Send payment failure email with escalating urgency
  try {
    if (profile.email) {
      await sendPaymentFailedEmail(profile.email, {
        userName: profile.full_name || undefined,
        planName,
        failureReason,
        amountDue: formatCurrency(invoice.amount_due),
        attemptNumber,
        daysRemaining,
        updatePaymentUrl,
        invoiceUrl: invoice.hosted_invoice_url || undefined,
      })

      // Update dunning attempt to mark notification as sent
      await supabase
        .from('dunning_attempts')
        .update({
          notification_sent: true,
          notification_sent_at: new Date().toISOString(),
        })
        .eq('subscription_id', subscriptionRecord.id)
        .eq('attempt_number', attemptNumber)

      logger.info('Payment failure email sent', undefined, {
        invoiceId: invoice.id,
        userId: profile.id,
        email: profile.email,
        attemptNumber,
        daysRemaining,
      })
    } else {
      logger.warn('Could not send payment failure email - no email address', undefined, {
        invoiceId: invoice.id,
        userId: profile.id,
      })
    }
  } catch (emailError) {
    logger.error('Failed to send payment failure email', undefined, {
      error: emailError,
      invoiceId: invoice.id,
      userId: profile.id,
      attemptNumber,
    })
    // Don't throw - email failure shouldn't fail the webhook
  }

  logger.info('Payment failure processed successfully', undefined, {
    invoiceId: invoice.id,
    subscriptionId: subscriptionRecord.id,
    userId: profile.id,
    attemptNumber,
    daysRemaining,
    gracePeriodEnds: gracePeriodEnd.toISOString(),
  })

  return {
    processed: true,
    attemptNumber,
    daysRemaining,
    gracePeriodEnds: gracePeriodEnd.toISOString(),
  }
}
