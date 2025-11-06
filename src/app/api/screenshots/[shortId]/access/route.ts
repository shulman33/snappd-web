/**
 * GET /api/screenshots/[shortId]/access
 *
 * Check access control for a screenshot
 *
 * Features:
 * - Returns sharing mode and access requirements
 * - Checks if screenshot is expired
 * - Validates authentication for private screenshots
 * - Allows owner to bypass expiration and access restrictions
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { screenshotAccessLimiter, getRateLimitHeaders } from '@/lib/auth/rate-limit'
import { ApiErrorHandler, ApiErrorCode } from '@/lib/api/errors'

interface RouteContext {
  params: Promise<{ shortId: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // Apply rate limiting based on IP address
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               '127.0.0.1'
    const { success, pending, ...rateLimitInfo } = await screenshotAccessLimiter.limit(ip)

    // Don't block the request, but add rate limit headers
    // This allows monitoring without breaking functionality initially
    const headers = getRateLimitHeaders({ success, pending, ...rateLimitInfo })

    if (!success) {
      return NextResponse.json(
        {
          accessible: false,
          error: 'Too many requests. Please slow down.',
          sharingMode: null
        },
        { status: 429, headers }
      )
    }

    const supabase = await createServerClient()
    const { shortId } = await context.params

    // Get current user (may be null for anonymous viewers)
    const {
      data: { user }
    } = await supabase.auth.getUser()

    // For public-facing endpoints, we need to use service role to bypass RLS
    // This allows us to check sharing_mode before enforcing access control
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

    // Fetch screenshot metadata using admin client (bypasses RLS)
    const { data: screenshot, error: screenshotError} = await supabaseAdmin
      .from('screenshots')
      .select('id, short_id, user_id, sharing_mode, expires_at, is_public, created_at')
      .eq('short_id', shortId)
      .single()

    if (screenshotError || !screenshot) {
      return NextResponse.json(
        {
          accessible: false,
          error: 'Screenshot not found',
          sharingMode: null
        },
        { status: 404 }
      )
    }

    // Check if user is the owner
    const isOwner = user && user.id === screenshot.user_id

    // Check expiration (owners can bypass)
    const now = new Date()
    const isExpired =
      screenshot.expires_at && new Date(screenshot.expires_at) < now

    if (isExpired && !isOwner) {
      return NextResponse.json(
        {
          accessible: false,
          error: 'Screenshot has expired',
          sharingMode: screenshot.sharing_mode,
          expiresAt: screenshot.expires_at
        },
        { status: 410 } // 410 Gone
      )
    }

    // Check sharing mode and access control
    switch (screenshot.sharing_mode) {
      case 'public':
        // Public screenshots are accessible to everyone
        return NextResponse.json(
          {
            accessible: true,
            sharingMode: 'public',
            requiresAuth: false,
            requiresPassword: false,
            isOwner,
            expiresAt: screenshot.expires_at,
            isExpired: isExpired && isOwner // Only show expiration status to owner
          },
          { status: 200 }
        )

      case 'private':
        // Private screenshots require authentication
        if (!user) {
          return NextResponse.json(
            {
              accessible: false,
              sharingMode: 'private',
              requiresAuth: true,
              requiresPassword: false,
              error: 'Authentication required to view this screenshot'
            },
            { status: 401 }
          )
        }

        // Only the owner can access private screenshots
        if (!isOwner) {
          return NextResponse.json(
            {
              accessible: false,
              sharingMode: 'private',
              requiresAuth: true,
              requiresPassword: false,
              error: 'You do not have permission to view this screenshot'
            },
            { status: 403 }
          )
        }

        return NextResponse.json(
          {
            accessible: true,
            sharingMode: 'private',
            requiresAuth: true,
            requiresPassword: false,
            isOwner: true,
            expiresAt: screenshot.expires_at,
            isExpired: isExpired && isOwner
          },
          { status: 200 }
        )

      case 'password':
        // Password-protected screenshots require password verification
        // Owner can bypass password requirement
        if (isOwner) {
          return NextResponse.json(
            {
              accessible: true,
              sharingMode: 'password',
              requiresAuth: false,
              requiresPassword: false,
              isOwner: true,
              expiresAt: screenshot.expires_at,
              isExpired: isExpired && isOwner
            },
            { status: 200 }
          )
        }

        // Non-owners need to verify password
        // Check if password has been verified in this session
        // This would typically be done via a session token or cookie
        // For now, we'll require the client to call verify-password first
        return NextResponse.json(
          {
            accessible: false,
            sharingMode: 'password',
            requiresAuth: false,
            requiresPassword: true,
            error: 'Password verification required',
            verifyEndpoint: `/api/screenshots/${shortId}/verify-password`
          },
          { status: 401 }
        )

      default:
        // Unknown sharing mode (should never happen with DB constraints)
        console.error(`Unknown sharing mode: ${screenshot.sharing_mode}`)
        return ApiErrorHandler.internal(
          ApiErrorCode.INTERNAL_ERROR,
          'Invalid screenshot configuration'
        )
    }
  } catch (error) {
    console.error('Error in /api/screenshots/[shortId]/access:', error)
    return ApiErrorHandler.handle(error)
  }
}
