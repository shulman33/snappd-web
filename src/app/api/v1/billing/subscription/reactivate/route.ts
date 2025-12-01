/**
 * POST /api/v1/billing/subscription/reactivate
 *
 * Reactivate a canceled subscription within the data retention period
 *
 * Features:
 * - Authentication required
 * - Reactivates subscriptions scheduled for end-of-period cancellation
 * - Creates new subscriptions for fully canceled users within 90-day retention
 * - Validates data retention period (90 days from cancellation)
 * - Creates audit trail in subscription_events
 *
 * Reactivation Scenarios:
 * 1. Subscription scheduled to cancel (cancel_at_period_end=true) - Simply unset the flag
 * 2. Subscription fully canceled within 90 days - Create new checkout session
 * 3. Subscription canceled beyond 90 days - Redirect to new subscription flow
 */

import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe } from '@/lib/billing/stripe'
import { ApiErrorHandler, ApiErrorCode } from '@/lib/api/errors'
import { ApiResponse } from '@/lib/api/response'
import { logger } from '@/lib/logger'

// Data retention period in days
const DATA_RETENTION_DAYS = 90

export async function POST(request: NextRequest) {
  try {
    logger.info('Subscription reactivation requested', request)

    const supabase = await createServerClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return ApiErrorHandler.unauthorized(
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required to reactivate subscription',
        undefined,
        request
      )
    }

    logger.debug('User authenticated for reactivation', request, { userId: user.id })

    // Use service client for database operations
    const serviceClient = createServiceClient()

    // Check for subscription scheduled to cancel (cancel_at_period_end=true)
    const { data: scheduledCancelSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('cancel_at_period_end', true)
      .in('status', ['trialing', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (scheduledCancelSubscription) {
      // Reactivate by unsetting cancel_at_period_end
      logger.info('Reactivating scheduled cancellation', request, {
        userId: user.id,
        subscriptionId: scheduledCancelSubscription.id,
        stripeSubscriptionId: scheduledCancelSubscription.stripe_subscription_id,
      })

      try {
        // Update Stripe subscription
        const reactivatedSubscription = await stripe.subscriptions.update(
          scheduledCancelSubscription.stripe_subscription_id,
          {
            cancel_at_period_end: false,
          }
        )

        // Update local database
        const { error: updateError } = await serviceClient
          .from('subscriptions')
          .update({
            cancel_at_period_end: false,
          })
          .eq('id', scheduledCancelSubscription.id)

        if (updateError) {
          logger.error('Failed to update subscription record after reactivation', request, {
            error: updateError,
            subscriptionId: scheduledCancelSubscription.id,
          })
        }

        // Create subscription event audit log
        await serviceClient.from('subscription_events').insert({
          subscription_id: scheduledCancelSubscription.id,
          user_id: user.id,
          event_type: 'reactivated',
          previous_status: scheduledCancelSubscription.status,
          new_status: scheduledCancelSubscription.status,
          metadata: {
            reactivation_type: 'cancel_unscheduled',
            stripe_subscription_id: scheduledCancelSubscription.stripe_subscription_id,
          },
        })

        logger.info('Subscription reactivated successfully', request, {
          userId: user.id,
          subscriptionId: scheduledCancelSubscription.id,
        })

        return ApiResponse.success(
          {
            reactivated: true,
            reactivationType: 'cancel_unscheduled',
            subscription: {
              id: scheduledCancelSubscription.id,
              planType: scheduledCancelSubscription.plan_type,
              status: scheduledCancelSubscription.status,
              currentPeriodEnd: scheduledCancelSubscription.current_period_end,
            },
            message: 'Your subscription has been reactivated and will continue as normal.',
          },
          'Subscription reactivated successfully'
        )
      } catch (error) {
        logger.error('Stripe subscription reactivation failed', request, {
          userId: user.id,
          stripeSubscriptionId: scheduledCancelSubscription.stripe_subscription_id,
          stripeError: error instanceof Error ? error.message : 'Unknown error',
        })
        return ApiErrorHandler.internal(
          ApiErrorCode.INTERNAL_ERROR,
          'Failed to reactivate subscription. Please try again or contact support.',
          undefined,
          request
        )
      }
    }

    // Check for fully canceled subscription within retention period
    const { data: canceledSubscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'canceled')
      .order('canceled_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (canceledSubscription) {
      // Check if within data retention period (90 days)
      const canceledAt = canceledSubscription.canceled_at
        ? new Date(canceledSubscription.canceled_at)
        : null

      if (canceledAt) {
        const retentionEndDate = new Date(canceledAt)
        retentionEndDate.setDate(retentionEndDate.getDate() + DATA_RETENTION_DAYS)
        const now = new Date()

        if (now <= retentionEndDate) {
          // Within retention period - user can reactivate by creating new subscription
          logger.info('User within retention period, can reactivate', request, {
            userId: user.id,
            canceledAt: canceledSubscription.canceled_at,
            retentionEndDate: retentionEndDate.toISOString(),
            previousPlan: canceledSubscription.plan_type,
          })

          // Get user's Stripe customer ID
          const { data: profile } = await serviceClient
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', user.id)
            .single()

          // Determine the base URL
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

          if (profile?.stripe_customer_id) {
            // User has existing Stripe customer - create new subscription via checkout
            try {
              // Get the previous plan's price ID
              const priceId = await getPriceIdForPlan(
                canceledSubscription.plan_type,
                canceledSubscription.billing_cycle
              )

              // Create checkout session for reactivation
              const session = await stripe.checkout.sessions.create({
                customer: profile.stripe_customer_id,
                mode: 'subscription',
                line_items: [
                  {
                    price: priceId,
                    quantity: canceledSubscription.seat_count || 1,
                  },
                ],
                success_url: `${baseUrl}/billing?reactivated=true`,
                cancel_url: `${baseUrl}/billing?reactivation_canceled=true`,
                subscription_data: {
                  metadata: {
                    supabase_user_id: user.id,
                    plan_type: canceledSubscription.plan_type,
                    billing_cycle: canceledSubscription.billing_cycle,
                    reactivation: 'true',
                    previous_subscription_id: canceledSubscription.id,
                  },
                },
                metadata: {
                  type: 'reactivation',
                  previous_subscription_id: canceledSubscription.id,
                },
              })

              logger.info('Checkout session created for reactivation', request, {
                userId: user.id,
                sessionId: session.id,
                previousPlan: canceledSubscription.plan_type,
              })

              return ApiResponse.success(
                {
                  reactivated: false,
                  reactivationType: 'new_subscription_required',
                  checkoutUrl: session.url,
                  previousPlan: canceledSubscription.plan_type,
                  dataRetainedUntil: retentionEndDate.toISOString(),
                  message: 'Please complete checkout to reactivate your subscription. Your previous data will be restored.',
                },
                'Checkout session created for reactivation'
              )
            } catch (error) {
              logger.error('Failed to create reactivation checkout session', request, {
                userId: user.id,
                stripeError: error instanceof Error ? error.message : 'Unknown error',
              })
              return ApiErrorHandler.internal(
                ApiErrorCode.INTERNAL_ERROR,
                'Failed to create reactivation checkout. Please try again.',
                undefined,
                request
              )
            }
          } else {
            // No Stripe customer - redirect to regular checkout
            return ApiResponse.success(
              {
                reactivated: false,
                reactivationType: 'new_subscription_required',
                checkoutUrl: `${baseUrl}/pricing`,
                previousPlan: canceledSubscription.plan_type,
                dataRetainedUntil: retentionEndDate.toISOString(),
                message: 'Please visit our pricing page to reactivate your subscription.',
              },
              'Please create a new subscription'
            )
          }
        } else {
          // Beyond retention period - data may be deleted
          logger.info('User beyond retention period', request, {
            userId: user.id,
            canceledAt: canceledSubscription.canceled_at,
            retentionEndDate: retentionEndDate.toISOString(),
          })

          return ApiResponse.success(
            {
              reactivated: false,
              reactivationType: 'retention_expired',
              dataRetentionExpired: true,
              expiredAt: retentionEndDate.toISOString(),
              message: `Your data retention period of ${DATA_RETENTION_DAYS} days has expired. Please create a new subscription to start fresh.`,
            },
            'Data retention period expired'
          )
        }
      }
    }

    // No subscription found to reactivate
    logger.warn('No subscription found to reactivate', request, {
      userId: user.id,
    })

    return ApiResponse.success(
      {
        reactivated: false,
        reactivationType: 'no_subscription',
        message: 'No canceled subscription found to reactivate. Please create a new subscription.',
      },
      'No subscription to reactivate'
    )
  } catch (error) {
    return ApiErrorHandler.handle(error, {
      request,
      logContext: {
        route: 'POST /api/v1/billing/subscription/reactivate',
      },
    })
  }
}

/**
 * Get Stripe price ID for a plan and billing cycle
 */
async function getPriceIdForPlan(
  planType: string,
  billingCycle: string
): Promise<string> {
  // Map plan type and billing cycle to environment variable name
  const envKey = `STRIPE_PRICE_${planType.toUpperCase()}_${billingCycle.toUpperCase()}`
  const priceId = process.env[envKey]

  if (!priceId) {
    throw new Error(`Price ID not found for ${planType} ${billingCycle}`)
  }

  return priceId
}
