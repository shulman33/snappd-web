/**
 * POST /api/v1/billing/subscription/cancel
 *
 * Cancel user's subscription with options for immediate or end-of-period cancellation
 *
 * Features:
 * - Authentication required
 * - Supports immediate cancellation with proration
 * - Supports end-of-period cancellation (service continues until period end)
 * - Sends confirmation email
 * - Creates audit trail in subscription_events
 * - Calculates data retention period (90 days)
 *
 * Cancellation Types:
 * - immediate: Cancels now, prorates refund
 * - end_of_period: Cancels at billing period end, service continues until then
 */

import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe } from '@/lib/billing/stripe'
import { ApiErrorHandler, ApiErrorCode } from '@/lib/api/errors'
import { ApiResponse } from '@/lib/api/response'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { SendGridEmailService } from '@/lib/email/sendgrid'

// Validation schema for cancel request
const CancelRequestSchema = z.object({
  cancellationType: z.enum(['immediate', 'end_of_period']).default('end_of_period'),
  reason: z.string().max(500).optional(),
  feedback: z.string().max(1000).optional(),
})

// Data retention period in days
const DATA_RETENTION_DAYS = 90

export async function POST(request: NextRequest) {
  try {
    logger.info('Subscription cancellation requested', request)

    const supabase = await createServerClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return ApiErrorHandler.unauthorized(
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required to cancel subscription',
        undefined,
        request
      )
    }

    logger.debug('User authenticated for cancellation', request, { userId: user.id })

    // Parse and validate request body
    const body = await request.json()
    const validationResult = CancelRequestSchema.safeParse(body)

    if (!validationResult.success) {
      return ApiErrorHandler.badRequest(
        ApiErrorCode.VALIDATION_ERROR,
        'Invalid cancellation request',
        validationResult.error.flatten().fieldErrors,
        request
      )
    }

    const { cancellationType, reason, feedback } = validationResult.data

    // Get user's active subscription
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['trialing', 'active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (subscriptionError) {
      logger.error('Failed to fetch subscription for cancellation', request, {
        error: subscriptionError,
        userId: user.id,
      })
      return ApiErrorHandler.internal(
        ApiErrorCode.DATABASE_ERROR,
        'Failed to fetch subscription information',
        undefined,
        request
      )
    }

    if (!subscription) {
      logger.warn('No active subscription found for cancellation', request, {
        userId: user.id,
      })
      return ApiErrorHandler.notFound(
        ApiErrorCode.NOT_FOUND,
        'No active subscription found to cancel',
        undefined,
        request
      )
    }

    logger.info('Canceling subscription', request, {
      userId: user.id,
      subscriptionId: subscription.id,
      stripeSubscriptionId: subscription.stripe_subscription_id,
      cancellationType,
      currentStatus: subscription.status,
    })

    // Cancel subscription in Stripe
    let canceledSubscription
    try {
      if (cancellationType === 'immediate') {
        // Immediate cancellation with proration
        canceledSubscription = await stripe.subscriptions.cancel(
          subscription.stripe_subscription_id,
          {
            prorate: true,
            invoice_now: true, // Generate final invoice immediately
          }
        )
      } else {
        // End-of-period cancellation
        canceledSubscription = await stripe.subscriptions.update(
          subscription.stripe_subscription_id,
          {
            cancel_at_period_end: true,
          }
        )
      }
    } catch (error) {
      logger.error('Stripe subscription cancellation failed', request, {
        userId: user.id,
        stripeSubscriptionId: subscription.stripe_subscription_id,
        cancellationType,
        stripeError: error instanceof Error ? error.message : 'Unknown error',
      })
      return ApiErrorHandler.internal(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to cancel subscription. Please try again or contact support.',
        undefined,
        request
      )
    }

    // Use service client for database updates
    const serviceClient = createServiceClient()

    // Calculate data retention end date (90 days from cancellation)
    const dataRetentionUntil = new Date()
    dataRetentionUntil.setDate(dataRetentionUntil.getDate() + DATA_RETENTION_DAYS)

    // Update subscription record in database
    const updateData: Record<string, any> = {
      cancel_at_period_end: canceledSubscription.cancel_at_period_end,
    }

    // For immediate cancellation, update status and canceled_at
    if (cancellationType === 'immediate') {
      updateData.status = 'canceled'
      updateData.canceled_at = new Date().toISOString()
    }

    const { error: updateError } = await serviceClient
      .from('subscriptions')
      .update(updateData)
      .eq('id', subscription.id)

    if (updateError) {
      logger.error('Failed to update subscription record after cancellation', request, {
        error: updateError,
        subscriptionId: subscription.id,
      })
      // Don't throw - Stripe cancellation succeeded, so we should continue
    }

    // Create subscription event audit log
    const { error: eventError } = await serviceClient.from('subscription_events').insert({
      subscription_id: subscription.id,
      user_id: user.id,
      event_type: 'canceled',
      previous_status: subscription.status,
      new_status: cancellationType === 'immediate' ? 'canceled' : subscription.status,
      metadata: {
        cancellation_type: cancellationType,
        reason: reason || null,
        feedback: feedback || null,
        stripe_subscription_id: subscription.stripe_subscription_id,
        cancel_at_period_end: canceledSubscription.cancel_at_period_end,
        current_period_end: subscription.current_period_end,
        data_retention_until: dataRetentionUntil.toISOString(),
        effective_date: cancellationType === 'immediate'
          ? new Date().toISOString()
          : subscription.current_period_end,
      },
    })

    if (eventError) {
      logger.warn('Failed to create subscription event log for cancellation', request, {
        error: eventError,
        subscriptionId: subscription.id,
      })
      // Don't throw - audit log failure shouldn't fail the cancellation
    }

    // Get user email for confirmation
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single()

    // Send cancellation confirmation email
    if (profile?.email) {
      try {
        await sendCancellationConfirmationEmail(
          profile.email,
          {
            userName: profile.full_name || undefined,
            planName: getPlanName(subscription.plan_type),
            cancellationType,
            effectiveDate: cancellationType === 'immediate'
              ? new Date()
              : new Date(subscription.current_period_end),
            dataRetentionUntil,
          }
        )
        logger.info('Cancellation confirmation email sent', request, {
          userId: user.id,
          email: profile.email,
        })
      } catch (emailError) {
        logger.error('Failed to send cancellation confirmation email', request, {
          error: emailError,
          userId: user.id,
        })
        // Don't throw - email failure shouldn't fail the cancellation
      }
    }

    logger.info('Subscription canceled successfully', request, {
      userId: user.id,
      subscriptionId: subscription.id,
      cancellationType,
      effectiveDate: cancellationType === 'immediate'
        ? 'immediate'
        : subscription.current_period_end,
    })

    // Return cancellation details
    return ApiResponse.success(
      {
        canceled: true,
        cancellationType,
        effectiveDate: cancellationType === 'immediate'
          ? new Date().toISOString()
          : subscription.current_period_end,
        serviceActiveUntil: cancellationType === 'immediate'
          ? new Date().toISOString()
          : subscription.current_period_end,
        dataRetentionUntil: dataRetentionUntil.toISOString(),
        message: cancellationType === 'immediate'
          ? 'Your subscription has been canceled immediately. You will receive a prorated refund.'
          : `Your subscription will be canceled at the end of your current billing period. You can continue using premium features until ${new Date(subscription.current_period_end).toLocaleDateString()}.`,
      },
      'Subscription canceled successfully'
    )
  } catch (error) {
    return ApiErrorHandler.handle(error, {
      request,
      logContext: {
        route: 'POST /api/v1/billing/subscription/cancel',
      },
    })
  }
}

/**
 * Get human-readable plan name
 */
function getPlanName(planType: string): string {
  switch (planType) {
    case 'pro':
      return 'Pro'
    case 'team':
      return 'Team'
    default:
      return 'Premium'
  }
}

/**
 * Send cancellation confirmation email
 */
async function sendCancellationConfirmationEmail(
  email: string,
  data: {
    userName?: string
    planName: string
    cancellationType: 'immediate' | 'end_of_period'
    effectiveDate: Date
    dataRetentionUntil: Date
  }
) {
  const appName = 'Snappd'
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const reactivateUrl = `${baseUrl}/billing`

  const subject = data.cancellationType === 'immediate'
    ? `Your ${appName} subscription has been canceled`
    : `Your ${appName} subscription will be canceled`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #4F46E5;">Subscription Cancellation Confirmation</h1>
        ${data.userName ? `<p>Hi ${data.userName},</p>` : '<p>Hi there,</p>'}

        ${data.cancellationType === 'immediate' ? `
          <p>Your ${data.planName} subscription has been canceled immediately.</p>
          <p>You will receive a prorated refund for the unused portion of your billing period.</p>
        ` : `
          <p>Your ${data.planName} subscription has been scheduled for cancellation.</p>
          <p><strong>Your premium features will remain active until ${data.effectiveDate.toLocaleDateString()}.</strong></p>
        `}

        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #4F46E5;">What happens next?</h3>
          <ul style="margin-bottom: 0;">
            <li>Your screenshots and data will be retained for ${DATA_RETENTION_DAYS} days (until ${data.dataRetentionUntil.toLocaleDateString()})</li>
            <li>After ${DATA_RETENTION_DAYS} days, your data may be permanently deleted</li>
            <li>You can reactivate your subscription at any time during this period</li>
          </ul>
        </div>

        <p>Changed your mind? You can reactivate your subscription at any time:</p>

        <div style="margin: 30px 0;">
          <a href="${reactivateUrl}"
             style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Reactivate Subscription
          </a>
        </div>

        <p style="color: #666; font-size: 14px;">
          If you have any questions or feedback, please reply to this email. We'd love to hear how we can improve.
        </p>

        <p>Thank you for being a ${appName} customer!</p>
      </div>
    </body>
    </html>
  `

  const text = `Subscription Cancellation Confirmation

${data.userName ? `Hi ${data.userName},` : 'Hi there,'}

${data.cancellationType === 'immediate'
  ? `Your ${data.planName} subscription has been canceled immediately. You will receive a prorated refund for the unused portion of your billing period.`
  : `Your ${data.planName} subscription has been scheduled for cancellation. Your premium features will remain active until ${data.effectiveDate.toLocaleDateString()}.`
}

What happens next?
- Your screenshots and data will be retained for ${DATA_RETENTION_DAYS} days (until ${data.dataRetentionUntil.toLocaleDateString()})
- After ${DATA_RETENTION_DAYS} days, your data may be permanently deleted
- You can reactivate your subscription at any time during this period

Changed your mind? Reactivate your subscription at: ${reactivateUrl}

If you have any questions or feedback, please reply to this email.

Thank you for being a ${appName} customer!`

  await SendGridEmailService.send({
    to: email,
    subject,
    html,
    text,
    categories: ['subscription-canceled'],
    customArgs: {
      type: 'subscription-canceled',
    },
  })
}
