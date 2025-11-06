import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/user/usage
 *
 * Returns current usage and quota limits for the authenticated user
 *
 * Response:
 * {
 *   currentMonth: string,
 *   screenshotCount: number,
 *   storageBytes: number,
 *   bandwidthBytes: number,
 *   quota: {
 *     screenshots: number | 'unlimited',
 *     storage: number | 'unlimited',
 *     bandwidth: number | 'unlimited'
 *   },
 *   plan: 'free' | 'pro' | 'team'
 * }
 */
export async function GET() {
  try {
    const supabase = await createServerClient()

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's plan
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      )
    }

    const plan = profile.plan || 'free'
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format

    // Get current month's usage
    const { data: usage, error: usageError } = await supabase
      .from('monthly_usage')
      .select('screenshot_count, storage_bytes, bandwidth_bytes')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .single()

    if (usageError && usageError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine for first usage
      console.error('Error fetching usage:', usageError)
      return NextResponse.json(
        { error: 'Failed to fetch usage data' },
        { status: 500 }
      )
    }

    // Default to zero if no usage record exists yet
    const screenshotCount = usage?.screenshot_count || 0
    const storageBytes = usage?.storage_bytes || 0
    const bandwidthBytes = usage?.bandwidth_bytes || 0

    // Define quota limits based on plan
    const quotas = {
      free: {
        screenshots: 10,
        storage: 100 * 1024 * 1024, // 100MB in bytes
        bandwidth: 1 * 1024 * 1024 * 1024, // 1GB in bytes
      },
      pro: {
        screenshots: 'unlimited' as const,
        storage: 'unlimited' as const,
        bandwidth: 'unlimited' as const,
      },
      team: {
        screenshots: 'unlimited' as const,
        storage: 'unlimited' as const,
        bandwidth: 'unlimited' as const,
      },
    }

    const quota = quotas[plan as keyof typeof quotas] || quotas.free

    return NextResponse.json({
      currentMonth,
      screenshotCount,
      storageBytes,
      bandwidthBytes,
      quota,
      plan,
    })
  } catch (error) {
    console.error('Error in /api/user/usage:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
