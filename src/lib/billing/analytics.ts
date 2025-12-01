/**
 * Billing Analytics Utilities
 *
 * Provides functions for calculating subscription metrics and revenue analytics:
 * - MRR (Monthly Recurring Revenue)
 * - Active subscriptions count
 * - Conversion rate (free → paid)
 * - Churn rate
 * - Payment success rate
 * - Dunning recovery rate
 * - Average Revenue Per User (ARPU)
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/supabase'
import { SubscriptionAnalytics, PlanType } from '@/types/billing'

// Plan pricing in cents (monthly)
const PLAN_PRICES: Record<PlanType, { monthly: number; annual: number }> = {
  free: { monthly: 0, annual: 0 },
  pro: { monthly: 900, annual: 9000 }, // $9/month or $90/year
  team: { monthly: 900, annual: 9000 }, // $9/user/month base
}

/**
 * Date range for analytics queries
 */
export interface AnalyticsDateRange {
  startDate: Date
  endDate: Date
}

/**
 * Analytics query options
 */
export interface AnalyticsOptions {
  dateRange?: AnalyticsDateRange
}

/**
 * Calculate Monthly Recurring Revenue (MRR)
 *
 * MRR = Sum of monthly revenue from all active subscriptions
 * - Pro: $9/month
 * - Team: $9 × seat_count per month
 * - Annual subscriptions are normalized to monthly value
 */
export async function calculateMRR(
  supabase: SupabaseClient<Database>
): Promise<number> {
  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select('plan_type, billing_cycle, seat_count')
    .in('status', ['active', 'trialing'])

  if (error) {
    throw new Error(`Failed to calculate MRR: ${error.message}`)
  }

  let mrr = 0

  for (const sub of subscriptions || []) {
    const planType = sub.plan_type as PlanType
    const prices = PLAN_PRICES[planType]

    if (planType === 'team' && sub.seat_count) {
      // Team plan: $9 per seat per month
      const monthlyPerSeat = sub.billing_cycle === 'annual'
        ? prices.annual / 12
        : prices.monthly
      mrr += monthlyPerSeat * sub.seat_count
    } else if (planType === 'pro') {
      // Pro plan: $9/month or $90/year normalized to monthly
      mrr += sub.billing_cycle === 'annual'
        ? prices.annual / 12
        : prices.monthly
    }
    // Free plan contributes $0 to MRR
  }

  return mrr
}

/**
 * Get count of active subscriptions
 */
export async function getActiveSubscriptions(
  supabase: SupabaseClient<Database>
): Promise<{ active: number; trialing: number; total: number }> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status')
    .in('status', ['active', 'trialing'])

  if (error) {
    throw new Error(`Failed to get active subscriptions: ${error.message}`)
  }

  const active = (data || []).filter(s => s.status === 'active').length
  const trialing = (data || []).filter(s => s.status === 'trialing').length

  return {
    active,
    trialing,
    total: active + trialing
  }
}

/**
 * Calculate conversion rate from free to paid
 *
 * Conversion rate = (Users who upgraded from free to paid / Total free users who could upgrade) × 100
 *
 * Uses subscription_events to track 'upgraded' and 'trial_converted' events
 */
export async function getConversionRate(
  supabase: SupabaseClient<Database>,
  options?: AnalyticsOptions
): Promise<number> {
  // Get total upgrades (free → paid conversions)
  let upgradeQuery = supabase
    .from('subscription_events')
    .select('id', { count: 'exact' })
    .in('event_type', ['upgraded', 'trial_converted'])
    .eq('previous_plan', 'free')

  if (options?.dateRange) {
    upgradeQuery = upgradeQuery
      .gte('created_at', options.dateRange.startDate.toISOString())
      .lte('created_at', options.dateRange.endDate.toISOString())
  }

  const { count: upgradeCount, error: upgradeError } = await upgradeQuery

  if (upgradeError) {
    throw new Error(`Failed to get upgrade count: ${upgradeError.message}`)
  }

  // Get total free users who had the opportunity to upgrade
  // This includes users who registered and remained free + users who upgraded
  const freeUsersQuery = supabase
    .from('profiles')
    .select('id', { count: 'exact' })

  // For a more accurate conversion rate, we could also consider
  // users who were created in the date range

  const { count: totalUsers, error: usersError } = await freeUsersQuery

  if (usersError) {
    throw new Error(`Failed to get user count: ${usersError.message}`)
  }

  if (!totalUsers || totalUsers === 0) {
    return 0
  }

  // Conversion rate = (upgrades / total users) × 100
  return ((upgradeCount || 0) / totalUsers) * 100
}

/**
 * Calculate churn rate
 *
 * Churn rate = (Canceled subscriptions in period / Active subscriptions at start) × 100
 */
export async function getChurnRate(
  supabase: SupabaseClient<Database>,
  options?: AnalyticsOptions
): Promise<number> {
  const startDate = options?.dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Default: last 30 days
  const endDate = options?.dateRange?.endDate || new Date()

  // Get canceled subscriptions in the period
  const { count: canceledCount, error: canceledError } = await supabase
    .from('subscription_events')
    .select('id', { count: 'exact' })
    .eq('event_type', 'canceled')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  if (canceledError) {
    throw new Error(`Failed to get canceled count: ${canceledError.message}`)
  }

  // Get active subscriptions at the start of the period
  // We use a combination of current active + canceled during period
  const { count: currentActive, error: activeError } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact' })
    .in('status', ['active', 'trialing'])

  if (activeError) {
    throw new Error(`Failed to get active count: ${activeError.message}`)
  }

  // Approximate active at start = current active + canceled during period
  const activeAtStart = (currentActive || 0) + (canceledCount || 0)

  if (activeAtStart === 0) {
    return 0
  }

  // Churn rate = (canceled / active at start) × 100
  return ((canceledCount || 0) / activeAtStart) * 100
}

/**
 * Calculate payment success rate
 *
 * Payment success rate = (Successful payments / Total payment attempts) × 100
 */
export async function getPaymentSuccessRate(
  supabase: SupabaseClient<Database>,
  options?: AnalyticsOptions
): Promise<number> {
  const startDate = options?.dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const endDate = options?.dateRange?.endDate || new Date()

  // Get successful payments
  const { count: successCount, error: successError } = await supabase
    .from('invoices')
    .select('id', { count: 'exact' })
    .eq('status', 'paid')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  if (successError) {
    throw new Error(`Failed to get success payment count: ${successError.message}`)
  }

  // Get total payment attempts (all non-draft invoices)
  const { count: totalCount, error: totalError } = await supabase
    .from('invoices')
    .select('id', { count: 'exact' })
    .neq('status', 'draft')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  if (totalError) {
    throw new Error(`Failed to get total payment count: ${totalError.message}`)
  }

  if (!totalCount || totalCount === 0) {
    return 100 // No payments attempted = 100% success (no failures)
  }

  return ((successCount || 0) / totalCount) * 100
}

/**
 * Calculate dunning recovery rate
 *
 * Dunning recovery rate = (Recovered payments / Total dunning attempts) × 100
 */
export async function getDunningRecoveryRate(
  supabase: SupabaseClient<Database>,
  options?: AnalyticsOptions
): Promise<number> {
  const startDate = options?.dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const endDate = options?.dateRange?.endDate || new Date()

  // Get successful dunning recoveries
  const { count: recoveredCount, error: recoveredError } = await supabase
    .from('dunning_attempts')
    .select('id', { count: 'exact' })
    .eq('payment_result', 'success')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  if (recoveredError) {
    throw new Error(`Failed to get recovery count: ${recoveredError.message}`)
  }

  // Get total dunning attempts
  const { count: totalCount, error: totalError } = await supabase
    .from('dunning_attempts')
    .select('id', { count: 'exact' })
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  if (totalError) {
    throw new Error(`Failed to get total dunning count: ${totalError.message}`)
  }

  if (!totalCount || totalCount === 0) {
    return 0 // No dunning attempts = 0% recovery rate (nothing to recover)
  }

  return ((recoveredCount || 0) / totalCount) * 100
}

/**
 * Calculate Average Revenue Per User (ARPU)
 *
 * ARPU = MRR / Total active subscriptions
 */
export async function getAverageRevenuePerUser(
  supabase: SupabaseClient<Database>
): Promise<number> {
  const mrr = await calculateMRR(supabase)
  const { total } = await getActiveSubscriptions(supabase)

  if (total === 0) {
    return 0
  }

  return mrr / total
}

/**
 * Calculate estimated Lifetime Value (LTV)
 *
 * LTV = ARPU / (Churn Rate / 100)
 *
 * If churn rate is 0 or very low, we cap at 24 months worth of ARPU
 */
export async function getLifetimeValue(
  supabase: SupabaseClient<Database>,
  options?: AnalyticsOptions
): Promise<number> {
  const arpu = await getAverageRevenuePerUser(supabase)
  const churnRate = await getChurnRate(supabase, options)

  // If churn rate is 0 or very low, cap at 24 months
  if (churnRate < 0.5) {
    return arpu * 24
  }

  // LTV = ARPU × (1 / monthly churn rate)
  // Since churn rate is already monthly percentage, divide by 100
  return arpu / (churnRate / 100)
}

/**
 * Get complete subscription analytics
 *
 * Returns all key metrics in a single call
 */
export async function getSubscriptionAnalytics(
  supabase: SupabaseClient<Database>,
  options?: AnalyticsOptions
): Promise<SubscriptionAnalytics> {
  // Run queries in parallel for better performance
  const [
    mrr,
    subscriptionCounts,
    conversionRate,
    churnRate,
    arpu,
    ltv
  ] = await Promise.all([
    calculateMRR(supabase),
    getActiveSubscriptions(supabase),
    getConversionRate(supabase, options),
    getChurnRate(supabase, options),
    getAverageRevenuePerUser(supabase),
    getLifetimeValue(supabase, options)
  ])

  // Get churned subscriptions count for the period
  const startDate = options?.dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const endDate = options?.dateRange?.endDate || new Date()

  const { count: churnedCount } = await supabase
    .from('subscription_events')
    .select('id', { count: 'exact' })
    .eq('event_type', 'canceled')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  return {
    mrr,
    arr: mrr * 12,
    activeSubscriptions: subscriptionCounts.active,
    trialSubscriptions: subscriptionCounts.trialing,
    churnedSubscriptions: churnedCount || 0,
    conversionRate: Math.round(conversionRate * 100) / 100,
    churnRate: Math.round(churnRate * 100) / 100,
    averageRevenuePerUser: Math.round(arpu),
    lifetimeValue: Math.round(ltv)
  }
}

/**
 * Get revenue breakdown by plan type
 */
export async function getRevenueByPlan(
  supabase: SupabaseClient<Database>
): Promise<Record<PlanType, number>> {
  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select('plan_type, billing_cycle, seat_count')
    .in('status', ['active', 'trialing'])

  if (error) {
    throw new Error(`Failed to get revenue by plan: ${error.message}`)
  }

  const revenueByPlan: Record<PlanType, number> = {
    free: 0,
    pro: 0,
    team: 0
  }

  for (const sub of subscriptions || []) {
    const planType = sub.plan_type as PlanType
    const prices = PLAN_PRICES[planType]

    if (planType === 'team' && sub.seat_count) {
      const monthlyPerSeat = sub.billing_cycle === 'annual'
        ? prices.annual / 12
        : prices.monthly
      revenueByPlan.team += monthlyPerSeat * sub.seat_count
    } else if (planType === 'pro') {
      revenueByPlan.pro += sub.billing_cycle === 'annual'
        ? prices.annual / 12
        : prices.monthly
    }
  }

  return revenueByPlan
}

/**
 * Get subscription counts by plan type
 */
export async function getSubscriptionsByPlan(
  supabase: SupabaseClient<Database>
): Promise<Record<PlanType, number>> {
  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select('plan_type')
    .in('status', ['active', 'trialing'])

  if (error) {
    throw new Error(`Failed to get subscriptions by plan: ${error.message}`)
  }

  const countByPlan: Record<PlanType, number> = {
    free: 0,
    pro: 0,
    team: 0
  }

  for (const sub of subscriptions || []) {
    const planType = sub.plan_type as PlanType
    countByPlan[planType]++
  }

  return countByPlan
}
