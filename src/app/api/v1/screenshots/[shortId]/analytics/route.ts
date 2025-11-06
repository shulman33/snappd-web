/**
 * GET /api/v1/screenshots/[shortId]/analytics
 *
 * Returns analytics data for a screenshot including:
 * - Total views and unique viewers
 * - Daily view statistics
 * - Geographic distribution (country-level)
 * - Owner views are excluded from public analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import type { AnalyticsResponse, DailyStat, CountryStats } from '@/types/analytics';
import { ApiErrorHandler, ApiErrorCode } from '@/lib/api/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortId: string }> }
): Promise<NextResponse<AnalyticsResponse | { error: string; message: string }>> {
  try {
    const { shortId } = await params;
    const supabase = await createServerClient();

    // Get screenshot details
    const { data: screenshot, error: screenshotError } = await supabase
      .from('screenshots')
      .select('id, user_id, created_at, updated_at')
      .eq('short_id', shortId)
      .single();

    if (screenshotError || !screenshot) {
      return ApiErrorHandler.notFound(
        ApiErrorCode.SCREENSHOT_NOT_FOUND,
        'Screenshot not found'
      );
    }

    // Check if authenticated user is the owner (for access control)
    const { data: { user } } = await supabase.auth.getUser();
    const isOwner = user?.id === screenshot.user_id;

    // Only owners can view analytics
    if (!isOwner) {
      return ApiErrorHandler.forbidden(
        ApiErrorCode.SCREENSHOT_ACCESS_DENIED,
        'Only screenshot owners can view analytics'
      );
    }

    // Get daily view statistics (excluding owner views)
    const { data: dailyData, error: dailyError } = await supabase
      .from('view_events')
      .select('viewed_at')
      .eq('screenshot_id', screenshot.id)
      .eq('is_owner', false)
      .order('viewed_at', { ascending: true });

    if (dailyError) {
      throw dailyError;
    }

    // Aggregate daily stats in memory (alternative to creating a database function)
    const dailyStatsMap = new Map<string, { count: number; ips: Set<string> }>();

    for (const event of dailyData || []) {
      if (!event.viewed_at) continue;
      const date = new Date(event.viewed_at).toISOString().split('T')[0];
      if (!dailyStatsMap.has(date)) {
        dailyStatsMap.set(date, { count: 0, ips: new Set() });
      }
      const stat = dailyStatsMap.get(date)!;
      stat.count++;
    }

    const daily_stats: DailyStat[] = Array.from(dailyStatsMap.entries()).map(
      ([date, stats]) => ({
        date,
        view_count: stats.count,
        unique_viewers: stats.ips.size,
      })
    );

    // Get country distribution (excluding owner views)
    const { data: countryData, error: countryError } = await supabase
      .from('view_events')
      .select('country')
      .eq('screenshot_id', screenshot.id)
      .eq('is_owner', false)
      .not('country', 'is', null);

    if (countryError) {
      throw countryError;
    }

    // Aggregate country stats
    const country_distribution: CountryStats = {};
    for (const event of countryData || []) {
      if (event.country) {
        country_distribution[event.country] = (country_distribution[event.country] || 0) + 1;
      }
    }

    // Calculate total views and unique viewers from view_events (excluding owner)
    const { data: viewStats } = await supabase
      .from('view_events')
      .select('ip_hash', { count: 'exact' })
      .eq('screenshot_id', screenshot.id)
      .eq('is_owner', false);

    const total_views = viewStats?.length || 0;

    // Count unique IP hashes
    const uniqueIPs = new Set(viewStats?.map(v => v.ip_hash) || []);
    const unique_viewers = uniqueIPs.size;

    const response: AnalyticsResponse = {
      screenshot_id: screenshot.id,
      total_views,
      unique_viewers,
      daily_stats,
      country_distribution,
      created_at: screenshot.created_at || new Date().toISOString(),
      updated_at: screenshot.updated_at || new Date().toISOString(),
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        // Cache analytics for 5 minutes, allow stale for 15 minutes while revalidating
        'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=900',
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch analytics data',
      },
      { status: 500 }
    );
  }
}
