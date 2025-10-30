/**
 * GET /api/usage/history
 * Get usage history for multiple months
 * Includes aggregate statistics
 * 
 * @requires Authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUserClient, getUserIdFromToken } from '@/lib/supabase';
import { validateRequest, usageHistorySchema } from '@/lib/validation';
import { handleApiError, UnauthorizedError } from '@/lib/errors';
import type { UsageHistoryResponse } from '@/types/api';

export async function GET(request: NextRequest) {
  try {
    // 1. Extract and validate authentication
    const authHeader = request.headers.get('authorization');
    const accessToken = authHeader?.replace('Bearer ', '');

    if (!accessToken) {
      throw new UnauthorizedError('Missing authorization token');
    }

    const userId = await getUserIdFromToken(accessToken);
    if (!userId) {
      throw new UnauthorizedError('Invalid authorization token');
    }

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      months: parseInt(searchParams.get('months') || '6'),
    };

    const validated = validateRequest(usageHistorySchema, queryParams);

    // 3. Generate month range (last N months)
    const months: string[] = [];
    const currentDate = new Date();
    
    for (let i = 0; i < validated.months; i++) {
      const month = new Date(currentDate);
      month.setMonth(month.getMonth() - i);
      months.push(month.toISOString().slice(0, 7)); // YYYY-MM
    }

    // 4. Fetch usage data for all months
    const supabase = createUserClient(accessToken);
    const { data: usageData } = await supabase
      .from('monthly_usage')
      .select('month, screenshot_count, storage_bytes, bandwidth_bytes')
      .eq('user_id', userId)
      .in('month', months)
      .order('month', { ascending: false });

    // 5. Create monthly data array (fill missing months with zeros)
    const monthlyData = months.map((month) => {
      const usage = usageData?.find((u) => u.month === month);
      return {
        month,
        screenshot_count: usage?.screenshot_count || 0,
        storage_mb: Math.round((usage?.storage_bytes || 0) / (1024 * 1024) * 100) / 100,
        bandwidth_mb: Math.round((usage?.bandwidth_bytes || 0) / (1024 * 1024) * 100) / 100,
      };
    });

    // 6. Calculate totals
    const totals = monthlyData.reduce(
      (acc, month) => ({
        screenshots: acc.screenshots + month.screenshot_count,
        storage_mb: acc.storage_mb + month.storage_mb,
        bandwidth_mb: acc.bandwidth_mb + month.bandwidth_mb,
      }),
      { screenshots: 0, storage_mb: 0, bandwidth_mb: 0 }
    );

    // 7. Return usage history response
    const response: UsageHistoryResponse = {
      months: monthlyData,
      total: {
        screenshots: totals.screenshots,
        storage_mb: Math.round(totals.storage_mb * 100) / 100,
        bandwidth_mb: Math.round(totals.bandwidth_mb * 100) / 100,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

