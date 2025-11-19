/**
 * GET /api/v1/billing/analytics
 *
 * Retrieve subscription analytics and revenue metrics
 *
 * Features:
 * - Authentication required (admin only)
 * - Date range filtering (startDate, endDate)
 * - Metrics selection (metrics query param)
 * - Returns MRR, ARR, conversion rate, churn rate, etc.
 *
 * Query Parameters:
 * - startDate: ISO date string for period start
 * - endDate: ISO date string for period end
 * - metrics: Comma-separated list of metrics to include (optional)
 *   Available: mrr, arr, activeSubscriptions, trialSubscriptions,
 *              churnedSubscriptions, conversionRate, churnRate,
 *              averageRevenuePerUser, lifetimeValue, paymentSuccessRate,
 *              dunningRecoveryRate, revenueByPlan, subscriptionsByPlan
 */

import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { ApiErrorHandler, ApiErrorCode } from '@/lib/api/errors'
import { ApiResponse } from '@/lib/api/response'
import { logger } from '@/lib/logger'
import { isAdmin } from '@/lib/auth/admin'
import { z } from 'zod'
import {
  getSubscriptionAnalytics,
  getPaymentSuccessRate,
  getDunningRecoveryRate,
  getRevenueByPlan,
  getSubscriptionsByPlan,
  AnalyticsOptions
} from '@/lib/billing/analytics'

// Validation schema for query parameters
const AnalyticsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  metrics: z.string().optional(),
})

// Available metrics
const AVAILABLE_METRICS = [
  'mrr',
  'arr',
  'activeSubscriptions',
  'trialSubscriptions',
  'churnedSubscriptions',
  'conversionRate',
  'churnRate',
  'averageRevenuePerUser',
  'lifetimeValue',
  'paymentSuccessRate',
  'dunningRecoveryRate',
  'revenueByPlan',
  'subscriptionsByPlan'
] as const

type MetricName = typeof AVAILABLE_METRICS[number]

export async function GET(request: NextRequest) {
  try {
    logger.info('Analytics request received', request)

    const supabase = await createServerClient()

    // Check authentication
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return ApiErrorHandler.unauthorized(
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required to access analytics',
        undefined,
        request
      )
    }

    // Check for admin role
    if (!isAdmin(user)) {
      logger.warn('Unauthorized analytics access attempt', request, {
        userId: user.id,
        userEmail: user.email,
        userRole: user.app_metadata?.role || 'none'
      })

      return ApiErrorHandler.forbidden(
        ApiErrorCode.FORBIDDEN,
        'Admin access required to view analytics',
        undefined,
        request
      )
    }

    logger.info('Admin analytics access granted', request, {
      userId: user.id,
      userEmail: user.email
    })

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = {
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      metrics: searchParams.get('metrics') || undefined,
    }

    const validationResult = AnalyticsQuerySchema.safeParse(queryParams)

    if (!validationResult.success) {
      return ApiErrorHandler.badRequest(
        ApiErrorCode.VALIDATION_ERROR,
        'Invalid query parameters',
        validationResult.error.flatten().fieldErrors,
        request
      )
    }

    const { startDate, endDate, metrics } = validationResult.data

    // Build analytics options
    const options: AnalyticsOptions = {}

    if (startDate || endDate) {
      options.dateRange = {
        startDate: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate) : new Date()
      }
    }

    // Parse requested metrics
    let requestedMetrics: MetricName[] = [...AVAILABLE_METRICS]

    if (metrics) {
      const metricList = metrics.split(',').map(m => m.trim()) as MetricName[]
      const invalidMetrics = metricList.filter(m => !AVAILABLE_METRICS.includes(m))

      if (invalidMetrics.length > 0) {
        return ApiErrorHandler.badRequest(
          ApiErrorCode.VALIDATION_ERROR,
          `Invalid metrics requested: ${invalidMetrics.join(', ')}. Available metrics: ${AVAILABLE_METRICS.join(', ')}`,
          undefined,
          request
        )
      }

      requestedMetrics = metricList
    }

    // Fetch analytics data
    const timer = logger.startTimer()

    // Get base subscription analytics
    const baseAnalytics = await getSubscriptionAnalytics(supabase, options)

    // Build response based on requested metrics
    const response: Record<string, unknown> = {}

    // Add base metrics from SubscriptionAnalytics
    const baseMetricKeys = [
      'mrr', 'arr', 'activeSubscriptions', 'trialSubscriptions',
      'churnedSubscriptions', 'conversionRate', 'churnRate',
      'averageRevenuePerUser', 'lifetimeValue'
    ] as const

    for (const key of baseMetricKeys) {
      if (requestedMetrics.includes(key as MetricName)) {
        response[key] = baseAnalytics[key]
      }
    }

    // Fetch additional metrics if requested
    if (requestedMetrics.includes('paymentSuccessRate')) {
      response.paymentSuccessRate = Math.round(
        await getPaymentSuccessRate(supabase, options) * 100
      ) / 100
    }

    if (requestedMetrics.includes('dunningRecoveryRate')) {
      response.dunningRecoveryRate = Math.round(
        await getDunningRecoveryRate(supabase, options) * 100
      ) / 100
    }

    if (requestedMetrics.includes('revenueByPlan')) {
      response.revenueByPlan = await getRevenueByPlan(supabase)
    }

    if (requestedMetrics.includes('subscriptionsByPlan')) {
      response.subscriptionsByPlan = await getSubscriptionsByPlan(supabase)
    }

    // Add metadata
    const analyticsResponse = {
      ...response,
      dateRange: {
        startDate: options.dateRange?.startDate.toISOString() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: options.dateRange?.endDate.toISOString() || new Date().toISOString()
      },
      generatedAt: new Date().toISOString()
    }

    const duration = timer.end()

    logger.info('Analytics generated successfully', request, {
      userId: user.id,
      metricsCount: Object.keys(response).length,
      durationMs: duration
    })

    return ApiResponse.success(analyticsResponse, 'Analytics retrieved successfully')
  } catch (error) {
    return ApiErrorHandler.handle(error, {
      request,
      logContext: {
        route: 'GET /api/v1/billing/analytics'
      }
    })
  }
}
