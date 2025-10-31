/**
 * GET /api/usage
 * Get current month usage statistics
 * Includes upgrade prompts and limit status
 * 
 * @requires Authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUserClient, getUserIdFromToken } from '@/lib/supabase';
import { handleApiError, UnauthorizedError } from '@/lib/errors';
import type { UsageResponse } from '@/types/api';

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

    // 2. Get user profile
    const supabase = createUserClient(accessToken);
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, downgraded_at')
      .eq('id', userId)
      .single();

    if (!profile) {
      throw new UnauthorizedError('User profile not found');
    }

    // 3. Get current month usage
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    // Count screenshots uploaded this month (after downgrade if applicable)
    const { count: screenshotCount } = await supabase
      .from('screenshots')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', profile.downgraded_at || '1970-01-01')
      .gte('created_at', `${currentMonth}-01`);

    // Get monthly usage stats
    const { data: monthlyUsage } = await supabase
      .from('monthly_usage')
      .select('screenshot_count, storage_bytes, bandwidth_bytes')
      .eq('user_id', userId)
      .eq('month', currentMonth)
      .single();

    // 4. Calculate limits and status
    const plan = profile.plan;
    const screenshotLimit = plan === 'free' ? 10 : Infinity;
    const currentCount = screenshotCount || 0;
    const remaining = plan === 'free' ? Math.max(0, screenshotLimit - currentCount) : Infinity;
    const atLimit = plan === 'free' && currentCount >= screenshotLimit;

    // Calculate next reset date (1st of next month)
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const resetsAt = `${nextMonth.toISOString().slice(0, 7)}-01T00:00:00Z`;

    // 5. Generate upgrade prompt
    let upgradePrompt: UsageResponse['upgrade_prompt'];
    
    if (plan === 'free') {
      const usagePercent = (currentCount / screenshotLimit) * 100;
      
      if (usagePercent >= 100) {
        upgradePrompt = {
          show_prompt: true,
          message: `You've used all ${screenshotLimit} free screenshots this month. Upgrade to Pro for unlimited uploads!`,
          cta_text: 'Upgrade to Pro - $9/month',
          urgency_level: 'high',
        };
      } else if (usagePercent >= 80) {
        upgradePrompt = {
          show_prompt: true,
          message: `You've used ${currentCount} of ${screenshotLimit} free screenshots this month. Upgrade to Pro for unlimited uploads!`,
          cta_text: 'Upgrade to Pro - $9/month',
          urgency_level: 'high',
        };
      } else {
        upgradePrompt = {
          show_prompt: false,
          message: `You've used ${currentCount} of ${screenshotLimit} free screenshots this month.`,
          cta_text: 'Upgrade to Pro - $9/month',
          urgency_level: 'low',
        };
      }
    } else {
      upgradePrompt = {
        show_prompt: false,
        message: 'You have unlimited uploads on Pro plan!',
        cta_text: '',
        urgency_level: 'low',
      };
    }

    // 6. Return usage response
    const response: UsageResponse = {
      month: currentMonth,
      screenshot_count: currentCount,
      screenshot_limit: screenshotLimit === Infinity ? -1 : screenshotLimit,
      storage_bytes: monthlyUsage?.storage_bytes || 0,
      storage_mb: Math.round((monthlyUsage?.storage_bytes || 0) / (1024 * 1024) * 100) / 100,
      bandwidth_bytes: monthlyUsage?.bandwidth_bytes || 0,
      bandwidth_mb: Math.round((monthlyUsage?.bandwidth_bytes || 0) / (1024 * 1024) * 100) / 100,
      plan,
      limit_status: {
        at_limit: atLimit,
        remaining: remaining === Infinity ? -1 : remaining,
        resets_at: resetsAt,
      },
      upgrade_prompt: upgradePrompt,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

