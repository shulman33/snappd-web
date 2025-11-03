/**
 * Quota checking and management utilities
 *
 * Provides functions for:
 * - Checking user upload quotas
 * - Retrieving usage statistics
 * - Determining quota limits based on plan
 */

import { createServerClient } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

type Profile = Database['public']['Tables']['profiles']['Row']
type MonthlyUsage = Database['public']['Tables']['monthly_usage']['Row']

/**
 * Get quota limit based on user plan
 */
export function getQuotaLimit(plan: Profile['plan']): number {
  switch (plan) {
    case 'free':
      return 10 // 10 screenshots per month
    case 'pro':
    case 'team':
      return -1 // Unlimited (represented as -1)
    default:
      return 10 // Default to free tier
  }
}

/**
 * Check if user can upload more screenshots
 *
 * @param userId - User ID to check
 * @returns Object with canUpload boolean and usage details
 */
export async function checkUploadQuota(userId: string): Promise<{
  canUpload: boolean
  plan: Profile['plan']
  limit: number
  used: number
  remaining: number
  error?: string
}> {
  const supabase = await createServerClient()

  // Get user profile to determine plan
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    return {
      canUpload: false,
      plan: 'free',
      limit: 10,
      used: 0,
      remaining: 0,
      error: 'Failed to fetch user profile'
    }
  }

  const limit = getQuotaLimit(profile.plan)

  // If unlimited plan, always allow upload
  if (limit === -1) {
    return {
      canUpload: true,
      plan: profile.plan,
      limit: -1,
      used: 0,
      remaining: -1
    }
  }

  // Get current month's usage
  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format

  const { data: usage, error: usageError } = await supabase
    .from('monthly_usage')
    .select('screenshot_count')
    .eq('user_id', userId)
    .eq('month', currentMonth)
    .single()

  if (usageError && usageError.code !== 'PGRST116') {
    // PGRST116 is "no rows returned", which is fine for first upload
    console.error('Error fetching usage:', usageError)
    return {
      canUpload: false,
      plan: profile.plan,
      limit,
      used: 0,
      remaining: limit,
      error: 'Failed to fetch usage data'
    }
  }

  const used = usage?.screenshot_count || 0
  const remaining = Math.max(0, limit - used)
  const canUpload = used < limit

  return {
    canUpload,
    plan: profile.plan,
    limit,
    used,
    remaining
  }
}

/**
 * Get detailed usage statistics for a user
 *
 * @param userId - User ID to check
 * @returns Usage statistics including screenshots, storage, and bandwidth
 */
export async function getUserUsage(userId: string): Promise<{
  month: string
  screenshotCount: number
  storageBytes: number
  bandwidthBytes: number
  error?: string
} | null> {
  const supabase = await createServerClient()

  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format

  const { data: usage, error } = await supabase
    .from('monthly_usage')
    .select('*')
    .eq('user_id', userId)
    .eq('month', currentMonth)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching usage:', error)
    return {
      month: currentMonth,
      screenshotCount: 0,
      storageBytes: 0,
      bandwidthBytes: 0,
      error: 'Failed to fetch usage data'
    }
  }

  if (!usage) {
    // No usage record yet for this month
    return {
      month: currentMonth,
      screenshotCount: 0,
      storageBytes: 0,
      bandwidthBytes: 0
    }
  }

  return {
    month: usage.month,
    screenshotCount: usage.screenshot_count ?? 0,
    storageBytes: usage.storage_bytes ?? 0,
    bandwidthBytes: usage.bandwidth_bytes ?? 0
  }
}

/**
 * Get historical usage data for a user
 *
 * @param userId - User ID to check
 * @param months - Number of months of history to retrieve (default: 6)
 * @returns Array of monthly usage records
 */
export async function getUserUsageHistory(
  userId: string,
  months = 6
): Promise<MonthlyUsage[]> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('monthly_usage')
    .select('*')
    .eq('user_id', userId)
    .order('month', { ascending: false })
    .limit(months)

  if (error) {
    console.error('Error fetching usage history:', error)
    return []
  }

  return data || []
}

/**
 * Format storage bytes to human-readable string
 */
export function formatStorageSize(bytes: number | bigint): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = Number(bytes)
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}

/**
 * Calculate storage used percentage
 */
export function getStoragePercentage(
  usedBytes: number,
  plan: Profile['plan']
): number {
  // Define storage limits per plan (in bytes)
  const limits: Record<string, number> = {
    free: 100 * 1024 * 1024, // 100MB
    pro: 10 * 1024 * 1024 * 1024, // 10GB
    team: 100 * 1024 * 1024 * 1024 // 100GB
  }

  const limit = (plan ? limits[plan] : undefined) ?? limits.free
  return Math.min(100, (usedBytes / limit) * 100)
}
