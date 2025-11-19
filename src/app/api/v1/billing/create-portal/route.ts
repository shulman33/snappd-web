/**
 * POST /api/v1/billing/create-portal
 *
 * Create a Stripe Customer Portal session for subscription management
 *
 * Features:
 * - Authentication required
 * - Allows customers to manage subscriptions, payment methods, and billing details
 * - Supports plan changes (upgrades/downgrades) with automatic proration
 * - Provides access to invoice history
 * - Returns Customer Portal URL for client redirect
 */

import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/billing/stripe'
import { ApiErrorHandler, ApiErrorCode } from '@/lib/api/errors'
import { ApiResponse } from '@/lib/api/response'
import { logger } from '@/lib/logger'
import { z } from 'zod'

// Validation schema for portal session request
const PortalRequestSchema = z.object({
  returnUrl: z.string().url().optional(),
  flowData: z
    .object({
      type: z.enum(['payment_method_update', 'subscription_cancel', 'subscription_update', 'subscription_update_confirm']),
      subscriptionId: z.string().optional(), // Stripe subscription ID for specific flows
      subscriptionUpdateConfirm: z
        .object({
          subscriptionId: z.string(),
          items: z
            .array(
              z.object({
                id: z.string(),
                price: z.string(),
                quantity: z.number().int().positive().optional()
              })
            )
            .optional()
        })
        .optional()
    })
    .optional()
})

export async function POST(request: NextRequest) {
  try {
    logger.info('Customer Portal session creation requested', request)

    const supabase = await createServerClient()

    // Check authentication
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return ApiErrorHandler.unauthorized(
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required to access Customer Portal',
        undefined,
        request
      )
    }

    logger.debug('User authenticated for portal access', request, { userId: user.id })

    // Parse and validate request body
    const body = await request.json()
    const validationResult = PortalRequestSchema.safeParse(body)

    if (!validationResult.success) {
      return ApiErrorHandler.badRequest(
        ApiErrorCode.VALIDATION_ERROR,
        'Invalid portal session request',
        validationResult.error.flatten().fieldErrors,
        request
      )
    }

    const { returnUrl, flowData } = validationResult.data

    // Get user's Stripe customer ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      logger.error('Failed to fetch user profile', request, {
        userId: user.id,
        error: profileError
      })
      return ApiErrorHandler.internal(
        ApiErrorCode.DATABASE_ERROR,
        'Failed to fetch billing account information',
        undefined,
        request
      )
    }

    if (!profile.stripe_customer_id) {
      logger.warn('User has no Stripe customer ID', request, { userId: user.id })
      return ApiErrorHandler.badRequest(
        ApiErrorCode.BAD_REQUEST,
        'No billing account found. Please create a subscription first.',
        { userId: user.id },
        request
      )
    }

    // Determine base URL for return redirect
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const defaultReturnUrl = `${baseUrl}/billing`

    // Create Customer Portal Session
    logger.debug('Creating Stripe Customer Portal session', request, {
      userId: user.id,
      stripeCustomerId: profile.stripe_customer_id,
      hasFlowData: !!flowData
    })

    const sessionParams: any = {
      customer: profile.stripe_customer_id,
      return_url: returnUrl || defaultReturnUrl
    }

    // Add flow data if provided (for specific customer journeys)
    if (flowData) {
      sessionParams.flow_data = {
        type: flowData.type
      }

      // Add flow-specific parameters
      if (flowData.type === 'subscription_cancel' && flowData.subscriptionId) {
        sessionParams.flow_data.subscription_cancel = {
          subscription: flowData.subscriptionId
        }
      } else if (flowData.type === 'subscription_update' && flowData.subscriptionId) {
        sessionParams.flow_data.subscription_update = {
          subscription: flowData.subscriptionId
        }
      } else if (flowData.type === 'subscription_update_confirm' && flowData.subscriptionUpdateConfirm) {
        sessionParams.flow_data.subscription_update_confirm = flowData.subscriptionUpdateConfirm
      }
    }

    let session
    try {
      session = await stripe.billingPortal.sessions.create(sessionParams)
    } catch (error) {
      logger.error('Stripe Customer Portal session creation failed', request, {
        userId: user.id,
        stripeCustomerId: profile.stripe_customer_id,
        stripeError: error instanceof Error ? error.message : 'Unknown error'
      })
      return ApiErrorHandler.internal(
        ApiErrorCode.INTERNAL_ERROR,
        'Failed to create portal session. Please try again.',
        undefined,
        request
      )
    }

    logger.info('Customer Portal session created successfully', request, {
      userId: user.id,
      sessionId: session.id,
      stripeCustomerId: profile.stripe_customer_id
    })

    return ApiResponse.success(
      {
        sessionId: session.id,
        url: session.url
      },
      'Customer Portal session created successfully'
    )
  } catch (error) {
    return ApiErrorHandler.handle(error, {
      request,
      logContext: {
        route: 'POST /api/v1/billing/create-portal'
      }
    })
  }
}
