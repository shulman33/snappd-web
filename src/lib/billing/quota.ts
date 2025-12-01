/**
 * Quota Management and Enforcement
 *
 * Provides utilities for checking upload quotas, tracking usage,
 * and enforcing plan limits.
 */

import { createServiceClient } from '../supabase/service';
import { logger } from '@/lib/logger';

/**
 * Plan quota limits
 *
 * Defines the upload limits for each plan tier.
 */
export const PLAN_QUOTAS = {
  free: {
    monthly_uploads: 10,
    storage_bytes: null, // No limit for now
    bandwidth_bytes: null, // No limit for now
  },
  pro: {
    monthly_uploads: null, // Unlimited
    storage_bytes: null, // Unlimited
    bandwidth_bytes: null, // Unlimited
  },
  team: {
    monthly_uploads: null, // Unlimited
    storage_bytes: null, // Unlimited
    bandwidth_bytes: null, // Unlimited
  },
} as const;

/**
 * Quota check result
 */
export interface QuotaCheckResult {
  /** Whether the upload is allowed */
  allowed: boolean;
  /** Current usage count */
  currentUsage: number;
  /** Quota limit (null = unlimited) */
  limit: number | null;
  /** User's current plan */
  plan: 'free' | 'pro' | 'team';
  /** When the quota resets (ISO timestamp) */
  resetAt?: string;
  /** Reason if not allowed */
  reason?: string;
}

/**
 * Get user's effective plan based on subscription status
 *
 * Checks the user's active subscription to determine their current plan.
 * Returns the plan from the subscription if active, otherwise falls back to profile plan.
 *
 * @param userId - Supabase user ID
 * @returns Effective plan and subscription status
 */
export async function getUserPlan(userId: string): Promise<{
  plan: 'free' | 'pro' | 'team';
  subscriptionStatus?: string;
  isTrialing?: boolean;
  isPastDue?: boolean;
}> {
  const supabase = createServiceClient();

  // Get user's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single();

  // Check for active subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, plan_type, status, trial_end, cancel_at_period_end, current_period_end')
    .eq('user_id', userId)
    .in('status', ['trialing', 'active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscription) {
    const isPastDue = subscription.status === 'past_due';
    const isTrialing = subscription.status === 'trialing';
    const now = new Date();
    const trialEnd = subscription.trial_end ? new Date(subscription.trial_end) : null;
    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end)
      : null;

    // Check grace period for past_due subscriptions (T049 - 14 days from first payment failure)
    let inGracePeriod = false;
    if (isPastDue) {
      // Get the first dunning attempt to determine grace period start
      const { data: firstAttempt } = await supabase
        .from('dunning_attempts')
        .select('attempt_date')
        .eq('subscription_id', subscription.id)
        .eq('attempt_number', 1)
        .single();

      if (firstAttempt) {
        const GRACE_PERIOD_DAYS = 14;
        const gracePeriodStart = new Date(firstAttempt.attempt_date);
        const gracePeriodEnd = new Date(gracePeriodStart);
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + GRACE_PERIOD_DAYS);

        inGracePeriod = now < gracePeriodEnd;
      }
    }

    // Allow access during:
    // - Active subscription
    // - Trial period
    // - Grace period (14 days after first payment failure)
    const hasAccess =
      subscription.status === 'active' ||
      subscription.status === 'trialing' ||
      (isPastDue && inGracePeriod);

    // CRITICAL: Grace period expiration must be enforced first, regardless of scheduled downgrade.
    // If past_due and grace period expired, user loses premium access immediately.
    // This prevents users with scheduled downgrades from retaining premium features
    // indefinitely when their payment fails and grace period expires.
    if (!hasAccess) {
      return {
        plan: 'free',
        subscriptionStatus: subscription.status,
        isTrialing,
        isPastDue,
      };
    }

    // T095-T096: If subscription is scheduled for downgrade (cancel_at_period_end=true),
    // user maintains current plan privileges until current_period_end.
    // This only applies when user still has access (active, trialing, or within grace period).
    if (subscription.cancel_at_period_end && currentPeriodEnd && now < currentPeriodEnd) {
      return {
        plan: subscription.plan_type as 'pro' | 'team',
        subscriptionStatus: subscription.status,
        isTrialing,
        isPastDue,
      };
    }

    // Normal case: user has access and no scheduled downgrade
    return {
      plan: subscription.plan_type as 'pro' | 'team',
      subscriptionStatus: subscription.status,
      isTrialing,
      isPastDue,
    };
  }

  // No active subscription, use profile plan (likely 'free')
  return {
    plan: (profile?.plan || 'free') as 'free' | 'pro' | 'team',
  };
}

/**
 * Check if user can upload based on their plan quota
 *
 * Verifies the user hasn't exceeded their monthly upload limit.
 * Free users: 10 uploads/month
 * Pro/Team users: Unlimited
 *
 * @param userId - Supabase user ID
 * @returns Quota check result
 *
 * @example
 * ```typescript
 * const quota = await checkUploadQuota('user_123');
 * if (!quota.allowed) {
 *   return res.status(403).json({
 *     error: 'QUOTA_EXCEEDED',
 *     message: quota.reason,
 *     quota: {
 *       current: quota.currentUsage,
 *       limit: quota.limit,
 *       resetAt: quota.resetAt
 *     }
 *   });
 * }
 * ```
 */
export async function checkUploadQuota(userId: string): Promise<QuotaCheckResult> {
  try {
    const supabase = createServiceClient();

    logger.info('Checking upload quota', undefined, { userId });

    // Get user's effective plan based on subscription status
    const { plan } = await getUserPlan(userId);
    const planQuota = PLAN_QUOTAS[plan];

    // Pro and Team plans have unlimited uploads
    if (planQuota.monthly_uploads === null) {
      logger.info('User has unlimited quota', undefined, { userId, plan });
      return {
        allowed: true,
        currentUsage: 0,
        limit: null,
        plan,
      };
    }

    const now = new Date();

    // Calculate period end for quota reset info (next month for free users)
    const periodEnd = new Date(now);
    periodEnd.setDate(1);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    periodEnd.setHours(0, 0, 0, 0);

    // Try usage_records first using date range matching
    // This works for both subscription-aligned periods and calendar months
    const { data: usageRecord, error: usageError } = await supabase
      .from('usage_records')
      .select('screenshot_count, period_end')
      .eq('user_id', userId)
      .lte('period_start', now.toISOString())
      .gt('period_end', now.toISOString())
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (usageError) {
      logger.error('Failed to fetch usage record', undefined, {
        error: usageError,
        userId,
      });
      throw usageError;
    }

    let currentUsage = 0;
    let resetAt = periodEnd.toISOString();

    if (usageRecord) {
      // Found usage_records entry - use it
      currentUsage = usageRecord.screenshot_count ?? 0;
      resetAt = usageRecord.period_end;
    } else {
      // Fallback to monthly_usage for existing users without usage_records
      const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM format
      const { data: monthlyUsage, error: monthlyError } = await supabase
        .from('monthly_usage')
        .select('screenshot_count')
        .eq('user_id', userId)
        .eq('month', currentMonth)
        .maybeSingle();

      if (monthlyError) {
        logger.error('Failed to fetch monthly usage', undefined, {
          error: monthlyError,
          userId,
        });
        throw monthlyError;
      }

      currentUsage = monthlyUsage?.screenshot_count ?? 0;
    }

    const limit = planQuota.monthly_uploads;

    // Check if quota is exceeded
    const allowed = currentUsage < limit;

    const result: QuotaCheckResult = {
      allowed,
      currentUsage,
      limit,
      plan,
      resetAt,
    };

    if (!allowed) {
      result.reason = `Monthly upload limit of ${limit} reached. Upgrade to Pro for unlimited uploads.`;
    }

    logger.info('Quota check completed', undefined, {
      userId,
      plan,
      currentUsage,
      limit,
      allowed,
    });

    return result;
  } catch (error) {
    logger.error('Failed to check upload quota', undefined, {
      error,
      userId,
    });
    throw error;
  }
}

/**
 * Get usage statistics for a specific period
 *
 * Retrieves upload count, storage, and bandwidth usage for a billing period.
 * Uses date range matching to find the usage record that contains the given date.
 *
 * @param userId - Supabase user ID
 * @param dateInPeriod - Any date within the billing period (ISO timestamp)
 * @returns Usage statistics or null if no data
 *
 * @example
 * ```typescript
 * const usage = await getUsageForPeriod('user_123', new Date().toISOString());
 * console.log(`Uploads this period: ${usage?.screenshot_count || 0}`);
 * ```
 */
export async function getUsageForPeriod(userId: string, dateInPeriod: string) {
  try {
    const supabase = createServiceClient();

    // Use date range matching to find usage record containing the date
    const { data, error } = await supabase
      .from('usage_records')
      .select('*')
      .eq('user_id', userId)
      .lte('period_start', dateInPeriod)
      .gt('period_end', dateInPeriod)
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch usage for period', undefined, {
        error,
        userId,
        dateInPeriod,
      });
      throw error;
    }

    return data;
  } catch (error) {
    logger.error('Error fetching usage for period', undefined, {
      error,
      userId,
      dateInPeriod,
    });
    throw error;
  }
}

/**
 * Get current period's usage record
 *
 * Helper to get usage for the current billing period.
 * Uses date range matching to find the active period.
 *
 * @param userId - Supabase user ID
 * @returns Current period's usage record or null
 */
export async function getCurrentMonthUsage(userId: string) {
  return getUsageForPeriod(userId, new Date().toISOString());
}

/**
 * Reset monthly usage for a user
 *
 * Creates a new usage record for the current billing period with zero counts.
 * This is typically called automatically by the monthly reset job or when
 * a subscription billing cycle renews.
 *
 * @param userId - Supabase user ID
 * @param periodStart - Start of new billing period (ISO timestamp)
 * @param periodEnd - End of new billing period (ISO timestamp)
 * @returns Created usage record
 *
 * @example
 * ```typescript
 * // Reset usage at the start of a new month
 * const periodStart = new Date('2025-12-01').toISOString();
 * const periodEnd = new Date('2026-01-01').toISOString();
 * await resetMonthlyUsage('user_123', periodStart, periodEnd);
 * ```
 */
export async function resetMonthlyUsage(
  userId: string,
  periodStart: string,
  periodEnd: string
) {
  try {
    const supabase = createServiceClient();

    logger.info('Resetting monthly usage', undefined, {
      userId,
      periodStart,
      periodEnd,
    });

    const { data, error } = await supabase
      .from('usage_records')
      .insert({
        user_id: userId,
        period_start: periodStart,
        period_end: periodEnd,
        screenshot_count: 0,
        storage_bytes: 0,
        bandwidth_bytes: 0,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to reset monthly usage', undefined, {
        error,
        userId,
      });
      throw error;
    }

    logger.info('Successfully reset monthly usage', undefined, {
      userId,
      usageRecordId: data.id,
    });

    return data;
  } catch (error) {
    logger.error('Error resetting monthly usage', undefined, {
      error,
      userId,
    });
    throw error;
  }
}

/**
 * Increment upload count for current period
 *
 * Increments the screenshot_count in the usage_records table.
 * Creates a new record if one doesn't exist for the current period.
 * Uses date range matching to find the correct billing period.
 *
 * NOTE: This is typically handled automatically by database triggers,
 * but this function can be used for manual adjustments or corrections.
 *
 * @param userId - Supabase user ID
 * @returns Updated usage record
 */
export async function incrementUploadCount(userId: string) {
  try {
    const supabase = createServiceClient();
    const now = new Date();

    // Try to find existing usage record using date range matching
    const { data: existing } = await supabase
      .from('usage_records')
      .select('*')
      .eq('user_id', userId)
      .lte('period_start', now.toISOString())
      .gt('period_end', now.toISOString())
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Increment existing record
      const { data, error } = await supabase
        .from('usage_records')
        .update({
          screenshot_count: (existing.screenshot_count ?? 0) + 1,
          updated_at: now.toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // No usage_records entry found - create one for the current calendar month
      // This handles free users who don't have subscription-aligned periods
      const periodStart = new Date(now);
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);

      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const { data, error } = await supabase
        .from('usage_records')
        .insert({
          user_id: userId,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          screenshot_count: 1,
          storage_bytes: 0,
          bandwidth_bytes: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  } catch (error) {
    logger.error('Failed to increment upload count', undefined, {
      error,
      userId,
    });
    throw error;
  }
}

/**
 * Get quota information for upgrade prompts
 *
 * Returns formatted quota information suitable for displaying in error responses
 * or upgrade prompts in the UI.
 *
 * @param userId - Supabase user ID
 * @returns Formatted quota information
 */
export async function getQuotaInfo(userId: string) {
  const quota = await checkUploadQuota(userId);

  return {
    current: quota.currentUsage,
    limit: quota.limit,
    plan: quota.plan,
    resetAt: quota.resetAt,
    upgradeRequired: !quota.allowed,
    upgradeMessage:
      quota.plan === 'free'
        ? 'Upgrade to Pro for unlimited uploads'
        : undefined,
    upgradePlan: quota.plan === 'free' ? 'pro' : undefined,
  };
}
