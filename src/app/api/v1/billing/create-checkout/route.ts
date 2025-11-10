/**
 * POST /api/v1/billing/create-checkout
 *
 * Create a Stripe Checkout session for plan upgrades
 *
 * Features:
 * - Authentication required
 * - Supports Pro and Team plan subscriptions
 * - Configures 14-day free trial with payment method required
 * - Handles monthly and annual billing cycles
 * - Automatic proration for team seat management
 * - Returns Checkout session URL for client redirect
 */

import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { stripe, getStripePriceId, type Stripe } from '@/lib/billing/stripe'
import { getOrCreateStripeCustomer } from '@/lib/billing/subscription'
import { ApiErrorHandler, ApiErrorCode } from '@/lib/api/errors'
import { ApiResponse } from '@/lib/api/response'
import { logger } from '@/lib/logger'
import { z } from 'zod'

// Validation schema for checkout request
const CheckoutRequestSchema = z.object({
  planType: z.enum(['pro', 'team'], {
    message: 'Plan type must be either "pro" or "team"'
  }),
  billingCycle: z.enum(['monthly', 'annual'], {
    message: 'Billing cycle must be either "monthly" or "annual"'
  }).default('monthly'),
  seatCount: z.number().int().min(3).optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional()
})

export async function POST(request: NextRequest) {
  try {
    logger.info('Checkout session creation requested', request)

    const supabase = await createServerClient()

    // Check authentication
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return ApiErrorHandler.unauthorized(
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required to create checkout session',
        undefined,
        request
      )
    }

    logger.debug('User authenticated for checkout', request, { userId: user.id })

    // Parse and validate request body
    const body = await request.json()
    const validationResult = CheckoutRequestSchema.safeParse(body)

    if (!validationResult.success) {
      return ApiErrorHandler.badRequest(
        ApiErrorCode.VALIDATION_ERROR,
        'Invalid checkout request',
        validationResult.error.flatten().fieldErrors,
        request
      )
    }

    const { planType, billingCycle, seatCount, successUrl, cancelUrl } = validationResult.data

    // Validate team plan requirements
    if (planType === 'team') {
      if (!seatCount) {
        return ApiErrorHandler.badRequest(
          ApiErrorCode.VALIDATION_ERROR,
          'seatCount is required for team plans',
          undefined,
          request
        )
      }

      if (seatCount < 3) {
        return ApiErrorHandler.badRequest(
          ApiErrorCode.VALIDATION_ERROR,
          'Team plans require a minimum of 3 seats',
          { seatCount, minimum: 3 },
          request
        )
      }
    }

    // Get user profile for email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      logger.error('Failed to fetch user profile', request, {
        userId: user.id,
        error: profileError
      })
      return ApiErrorHandler.internal(
        ApiErrorCode.DATABASE_ERROR,
        'Failed to fetch user profile',
        undefined,
        request
      )
    }

    // Get or create Stripe customer
    let stripeCustomerId: string
    try {
      stripeCustomerId = await getOrCreateStripeCustomer(user.id, profile.email, profile.full_name || undefined)
    } catch (error) {
      logger.error('Failed to create Stripe customer', request, {
        userId: user.id,
        error
      })
      return ApiErrorHandler.internal(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to initialize billing account',
        undefined,
        request
      )
    }

    // Get Stripe Price ID
    let priceId: string
    try {
      priceId = getStripePriceId(planType, billingCycle)
    } catch (error) {
      logger.error('Stripe price configuration error', request, {
        planType,
        billingCycle,
        error
      })
      return ApiErrorHandler.internal(
        ApiErrorCode.INTERNAL_ERROR,
        'Billing configuration error. Please contact support.',
        undefined,
        request
      )
    }

    // Determine base URL for success/cancel redirects
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const defaultSuccessUrl = `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`
    const defaultCancelUrl = `${baseUrl}/billing/canceled`

    // Create Checkout Session
    logger.debug('Creating Stripe Checkout session', request, {
      userId: user.id,
      planType,
      billingCycle,
      seatCount,
      priceId
    })

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: planType === 'team' ? seatCount : 1
        }
      ],
      success_url: successUrl || defaultSuccessUrl,
      cancel_url: cancelUrl || defaultCancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      subscription_data: {
        trial_period_days: 14,
        trial_settings: {
          end_behavior: {
            missing_payment_method: 'cancel'
          }
        },
        metadata: {
          plan_type: planType,
          billing_cycle: billingCycle,
          user_id: user.id,
          ...(planType === 'team' && { seat_count: seatCount?.toString() })
        }
      },
      metadata: {
        plan_type: planType,
        billing_cycle: billingCycle,
        user_id: user.id,
        ...(planType === 'team' && { seat_count: seatCount?.toString() })
      }
    }

    let session
    try {
      session = await stripe.checkout.sessions.create(sessionParams)
    } catch (error) {
      logger.error('Stripe Checkout session creation failed', request, {
        userId: user.id,
        stripeError: error instanceof Error ? error.message : 'Unknown error',
        planType,
        billingCycle
      })
      return ApiErrorHandler.internal(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to create checkout session. Please try again.',
        undefined,
        request
      )
    }

    logger.info('Checkout session created successfully', request, {
      userId: user.id,
      sessionId: session.id,
      planType,
      billingCycle
    })

    return ApiResponse.success(
      {
        sessionId: session.id,
        url: session.url,
        expiresAt: new Date(session.expires_at * 1000).toISOString()
      },
      'Checkout session created successfully'
    )
  } catch (error) {
    return ApiErrorHandler.handle(error, {
      request,
      logContext: {
        route: 'POST /api/v1/billing/create-checkout'
      }
    })
  }
}
