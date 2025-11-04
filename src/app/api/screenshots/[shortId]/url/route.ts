/**
 * GET /api/screenshots/[shortId]/url
 *
 * Returns optimized and thumbnail URLs for a screenshot using Supabase's
 * built-in image transformation API. No additional storage required - URLs
 * are generated on-the-fly with CDN caching.
 *
 * Response includes:
 * - original: Direct public URL
 * - optimized: Quality-optimized version (quality: 75)
 * - thumbnail: 200x150px thumbnail (cover mode, quality: 75)
 *
 * All transformed images are automatically cached by Supabase CDN.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import {
  getPublicUrl,
  getOptimizedUrl,
  getThumbnailUrl
} from '@/lib/uploads/storage'

interface RouteParams {
  params: Promise<{
    shortId: string
  }>
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { shortId } = await params

    // Validate shortId format
    if (!shortId || shortId.length < 6) {
      return NextResponse.json(
        {
          error: 'Invalid screenshot ID',
          message: 'Screenshot ID must be at least 6 characters'
        },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()

    // Fetch screenshot record
    const { data: screenshot, error } = await supabase
      .from('screenshots')
      .select('id, storage_path, is_public, user_id')
      .eq('short_id', shortId)
      .single()

    if (error || !screenshot) {
      return NextResponse.json(
        {
          error: 'Screenshot not found',
          message: 'The requested screenshot does not exist or has been deleted'
        },
        { status: 404 }
      )
    }

    // Check access permissions for private screenshots
    if (!screenshot.is_public) {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user || user.id !== screenshot.user_id) {
        return NextResponse.json(
          {
            error: 'Access denied',
            message: 'This screenshot is private'
          },
          { status: 403 }
        )
      }
    }

    // Generate URLs using Supabase image transformation API
    const urls = {
      original: getPublicUrl(screenshot.storage_path),
      optimized: getOptimizedUrl(screenshot.storage_path),
      thumbnail: getThumbnailUrl(screenshot.storage_path)
    }

    return NextResponse.json(
      {
        shortId,
        urls,
        metadata: {
          cached: true,
          description: 'All URLs use Supabase CDN caching for fast global delivery'
        }
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
          'CDN-Cache-Control': 'public, s-maxage=86400'
        }
      }
    )
  } catch (error) {
    console.error('Error fetching screenshot URLs:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch screenshot URLs'
      },
      { status: 500 }
    )
  }
}
