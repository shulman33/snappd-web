/**
 * GET /api/v1/billing/subscription
 *
 * Get current user's subscription details
 *
 * Features:
 * - Returns active subscription information
 * - Includes plan details, billing cycle, and trial status
 * - Returns quota limits based on plan
 * - Handles users with no subscription (free tier)
 *
 * Authentication:
 * - Requires valid session (authenticated user)
 *
 * Response:
 * - 200: Subscription details (or null if no active subscription)
 * - 401: Unauthorized (not authenticated)
 * - 500: Internal server error
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiErrorHandler, ApiErrorCode } from '@/lib/api/errors';
import { ApiResponse } from '@/lib/api/response';
import { logger } from '@/lib/logger';

/**
 * Get subscription details for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    logger.info('Get subscription request', request);

    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn('Unauthorized subscription access attempt', request);
      return ApiErrorHandler.unauthorized(
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required',
        undefined,
        request
      );
    }

    logger.info('Fetching subscription for user', request, { userId: user.id });

    // Query for active subscription
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['trialing', 'active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionError) {
      logger.error('Failed to fetch subscription', request, {
        error: subscriptionError,
        userId: user.id,
      });
      return ApiErrorHandler.handle(subscriptionError, {
        request,
        logContext: {
          route: 'GET /api/v1/billing/subscription',
          userId: user.id,
        },
      });
    }

    // If no active subscription, return free tier information
    if (!subscription) {
      logger.info('No active subscription found, returning free tier', request, {
        userId: user.id,
      });

      return ApiResponse.success({
        subscription: null,
        plan: {
          type: 'free',
          name: 'Free',
          billingCycle: null,
          status: 'active',
          quotas: {
            screenshots: 10,
            storage: null,
            bandwidth: null,
          },
        },
      });
    }

    // Determine quota limits based on plan
    const quotas = getQuotasForPlan(subscription.plan_type);

    // Format subscription response
    const response = {
      subscription: {
        id: subscription.id,
        stripeSubscriptionId: subscription.stripe_subscription_id,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        trialEnd: subscription.trial_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at,
        seatCount: subscription.seat_count,
        teamId: subscription.team_id,
        createdAt: subscription.created_at,
      },
      plan: {
        type: subscription.plan_type,
        name: getPlanName(subscription.plan_type),
        billingCycle: subscription.billing_cycle,
        status: subscription.status,
        quotas,
      },
    };

    logger.info('Subscription fetched successfully', request, {
      userId: user.id,
      planType: subscription.plan_type,
      status: subscription.status,
    });

    return ApiResponse.success(response);
  } catch (error) {
    logger.error('Subscription fetch error', request, { error });
    return ApiErrorHandler.handle(error, {
      request,
      logContext: {
        route: 'GET /api/v1/billing/subscription',
      },
    });
  }
}

/**
 * Get quota limits based on plan type
 */
function getQuotasForPlan(planType: string) {
  switch (planType) {
    case 'free':
      return {
        screenshots: 10,
        storage: null,
        bandwidth: null,
      };
    case 'pro':
    case 'team':
      return {
        screenshots: null, // unlimited
        storage: null, // unlimited
        bandwidth: null, // unlimited
      };
    default:
      return {
        screenshots: 10,
        storage: null,
        bandwidth: null,
      };
  }
}

/**
 * Get human-readable plan name
 */
function getPlanName(planType: string): string {
  switch (planType) {
    case 'free':
      return 'Free';
    case 'pro':
      return 'Pro';
    case 'team':
      return 'Team';
    default:
      return 'Unknown';
  }
}
