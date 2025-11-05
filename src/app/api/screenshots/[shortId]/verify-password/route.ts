/**
 * POST /api/screenshots/[shortId]/verify-password
 *
 * Verify password for password-protected screenshots
 *
 * Features:
 * - Validates password against stored hash
 * - Returns access token on success
 * - Rate limited to prevent brute force attacks (3 attempts per 5 minutes per screenshot)
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword } from '@/lib/uploads/security'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// Create rate limiter for password attempts
// 3 attempts per 5 minutes using sliding window, per screenshot
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, '5 m'),
  prefix: '@upstash/ratelimit/password-verify',
  analytics: true
})

interface RouteContext {
  params: Promise<{ shortId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { shortId } = await context.params

    // Rate limit password attempts per screenshot
    // Use shortId as identifier to prevent brute force on specific screenshots
    const { success, limit, reset } = await ratelimit.limit(shortId)

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000)

      return NextResponse.json(
        {
          error: 'Too many password attempts. Please try again later.',
          retryAfter,
          limit,
          remaining: 0
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(reset).toISOString(),
            'Retry-After': retryAfter.toString()
          }
        }
      )
    }

    // Parse request body
    const body = await request.json()
    const { password } = body

    // Validate required fields
    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      )
    }

    // Use admin client to bypass RLS for password verification
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Fetch screenshot using admin client
    const { data: screenshot, error: screenshotError } = await supabaseAdmin
      .from('screenshots')
      .select('id, short_id, sharing_mode, password_hash, user_id')
      .eq('short_id', shortId)
      .single()

    if (screenshotError || !screenshot) {
      return NextResponse.json(
        { error: 'Screenshot not found' },
        { status: 404 }
      )
    }

    // Check if screenshot is password-protected
    if (screenshot.sharing_mode !== 'password') {
      return NextResponse.json(
        { error: 'Screenshot is not password-protected' },
        { status: 400 }
      )
    }

    // Verify password
    if (!screenshot.password_hash) {
      console.error(
        `Screenshot ${shortId} has password sharing mode but no password_hash`
      )
      return NextResponse.json(
        { error: 'Screenshot configuration error' },
        { status: 500 }
      )
    }

    const isValid = await verifyPassword(password, screenshot.password_hash)

    if (!isValid) {
      return NextResponse.json(
        {
          error: 'Invalid password',
          success: false
        },
        { status: 401 }
      )
    }

    // Password is valid - return success with screenshot ID
    return NextResponse.json(
      {
        success: true,
        message: 'Password verified successfully',
        screenshot: {
          id: screenshot.id,
          shortId: screenshot.short_id
        }
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error in /api/screenshots/[shortId]/verify-password:', error)
    return NextResponse.json(
      { error: 'Internal server error. Please try again later.' },
      { status: 500 }
    )
  }
}
