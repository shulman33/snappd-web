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

    // Get user's current plan
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      logger.error('Failed to fetch user profile for quota check', undefined, {
        error: profileError,
        userId,
      });
      throw new Error('Could not fetch user profile');
    }

    const plan = (profile.plan || 'free') as 'free' | 'pro' | 'team';
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

    // Get current billing period (calendar month for free users)
    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Get current usage for this period
    const { data: usageRecord, error: usageError } = await supabase
      .from('usage_records')
      .select('screenshot_count')
      .eq('user_id', userId)
      .eq('period_start', periodStart.toISOString())
      .single();

    if (usageError && usageError.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      logger.error('Failed to fetch usage record', undefined, {
        error: usageError,
        userId,
      });
      throw usageError;
    }

    const currentUsage = usageRecord?.screenshot_count || 0;
    const limit = planQuota.monthly_uploads;

    // Check if quota is exceeded
    const allowed = currentUsage < limit;

    const result: QuotaCheckResult = {
      allowed,
      currentUsage,
      limit,
      plan,
      resetAt: periodEnd.toISOString(),
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
 *
 * @param userId - Supabase user ID
 * @param periodStart - Start of billing period (ISO timestamp)
 * @returns Usage statistics or null if no data
 *
 * @example
 * ```typescript
 * const periodStart = new Date('2025-11-01').toISOString();
 * const usage = await getUsageForPeriod('user_123', periodStart);
 * console.log(`Uploads this period: ${usage?.screenshot_count || 0}`);
 * ```
 */
export async function getUsageForPeriod(userId: string, periodStart: string) {
  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from('usage_records')
      .select('*')
      .eq('user_id', userId)
      .eq('period_start', periodStart)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.error('Failed to fetch usage for period', undefined, {
        error,
        userId,
        periodStart,
      });
      throw error;
    }

    return data;
  } catch (error) {
    logger.error('Error fetching usage for period', undefined, {
      error,
      userId,
      periodStart,
    });
    throw error;
  }
}

/**
 * Get current month's usage record
 *
 * Helper to get usage for the current calendar month.
 *
 * @param userId - Supabase user ID
 * @returns Current month's usage record or null
 */
export async function getCurrentMonthUsage(userId: string) {
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  return getUsageForPeriod(userId, periodStart.toISOString());
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

    // Get current period
    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // Check if usage record exists
    const { data: existing } = await supabase
      .from('usage_records')
      .select('*')
      .eq('user_id', userId)
      .eq('period_start', periodStart.toISOString())
      .single();

    if (existing) {
      // Increment existing record
      const { data, error } = await supabase
        .from('usage_records')
        .update({
          screenshot_count: (existing.screenshot_count ?? 0) + 1,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Create new record
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
