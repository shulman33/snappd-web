import { createServerClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';
import { ApiErrorHandler, ApiErrorCode } from '@/lib/api/errors';
import { ApiResponse } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { getUserPlan } from '@/lib/billing/quota';

/**
 * GET /api/v1/auth/user/usage
 *
 * Returns current usage and quota limits for the authenticated user
 *
 * Response includes:
 * - Current month's usage statistics
 * - Plan-based quota limits
 * - Subscription information (if applicable)
 * - Reset date for quotas
 *
 * @example Response for free user:
 * {
 *   currentMonth: "2025-11",
 *   screenshotCount: 5,
 *   screenshotLimit: 10,
 *   storageBytes: 1048576,
 *   storageLimitBytes: null,
 *   plan: "free",
 *   subscription: null
 * }
 *
 * @example Response for pro user with active subscription:
 * {
 *   currentMonth: "2025-11",
 *   screenshotCount: 50,
 *   screenshotLimit: null,
 *   storageBytes: 104857600,
 *   storageLimitBytes: null,
 *   plan: "pro",
 *   subscription: {
 *     status: "active",
 *     isTrialing: false,
 *     currentPeriodEnd: "2025-12-01T00:00:00Z"
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    logger.info('Get user usage request', request);

    const supabase = await createServerClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn('Unauthorized usage request', request);
      return ApiErrorHandler.unauthorized(
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required',
        undefined,
        request
      );
    }

    logger.info('Fetching usage for user', request, { userId: user.id });

    // Get user's effective plan (considers subscription status)
    const { plan, subscriptionStatus, isTrialing, isPastDue } = await getUserPlan(
      user.id
    );
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

    // Get current month's usage
    const { data: usage, error: usageError } = await supabase
      .from('monthly_usage')
      .select('screenshot_count, storage_bytes, bandwidth_bytes')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .single()

    if (usageError && usageError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine for first usage
      logger.error('Error fetching usage', request, {
        error: usageError,
        userId: user.id,
      });
      return ApiErrorHandler.handle(usageError, {
        request,
        logContext: {
          route: 'GET /api/v1/auth/user/usage',
          userId: user.id,
        },
      });
    }

    // Default to zero if no usage record exists yet
    const screenshotCount = usage?.screenshot_count || 0;
    const storageBytes = usage?.storage_bytes || 0;
    const bandwidthBytes = usage?.bandwidth_bytes || 0;

    // Define quota limits based on plan (null = unlimited)
    const screenshotLimit = plan === 'free' ? 10 : null;
    const storageLimitBytes = null; // Unlimited for all plans for now
    const bandwidthLimitBytes = null; // Unlimited for all plans for now

    // Get subscription details if user has active subscription
    let subscriptionInfo = null;
    if (subscriptionStatus) {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('status, trial_end, current_period_end')
        .eq('user_id', user.id)
        .in('status', ['trialing', 'active', 'past_due'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subscription) {
        subscriptionInfo = {
          status: subscription.status,
          isTrialing: subscription.status === 'trialing',
          isPastDue: subscription.status === 'past_due',
          trialEnd: subscription.trial_end,
          currentPeriodEnd: subscription.current_period_end,
        };
      }
    }

    const response = {
      currentMonth,
      screenshotCount,
      screenshotLimit,
      storageBytes,
      storageLimitBytes,
      bandwidthBytes,
      bandwidthLimitBytes,
      plan,
      subscription: subscriptionInfo,
    };

    logger.info('Usage data fetched successfully', request, {
      userId: user.id,
      plan,
      screenshotCount,
    });

    return ApiResponse.success(response);
  } catch (error) {
    logger.error('Error fetching usage', request, { error });
    return ApiErrorHandler.handle(error, {
      request,
      logContext: {
        route: 'GET /api/v1/auth/user/usage',
      },
    });
  }
}
