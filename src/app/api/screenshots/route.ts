/**
 * GET /api/screenshots
 *
 * List screenshots for the authenticated user with pagination and sorting
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - sort: Sort field (created_at, views, file_size, default: created_at)
 * - order: Sort order (asc, desc, default: desc)
 *
 * Features:
 * - Pagination with metadata
 * - Multiple sort options (date, views, size)
 * - Returns complete metadata (dimensions, file_size, views, timestamps, mime_type)
 * - RLS automatically filters to user's screenshots
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

const VALID_SORT_FIELDS = ['created_at', 'views', 'file_size'] as const
const VALID_ORDERS = ['asc', 'desc'] as const
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

type SortField = typeof VALID_SORT_FIELDS[number]
type SortOrder = typeof VALID_ORDERS[number]

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Check authentication
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const pageParam = searchParams.get('page') || '1'
    const limitParam = searchParams.get('limit') || String(DEFAULT_LIMIT)
    const sortParam = searchParams.get('sort') || 'created_at'
    const orderParam = searchParams.get('order') || 'desc'

    // Validate and sanitize parameters
    const page = Math.max(1, parseInt(pageParam, 10) || 1)
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(limitParam, 10) || DEFAULT_LIMIT))
    const sort: SortField = VALID_SORT_FIELDS.includes(sortParam as SortField)
      ? (sortParam as SortField)
      : 'created_at'
    const order: SortOrder = VALID_ORDERS.includes(orderParam as SortOrder)
      ? (orderParam as SortOrder)
      : 'desc'

    // Calculate offset for pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    // Query screenshots with pagination and sorting
    // RLS policies automatically filter to user's screenshots
    const { data: screenshots, error: screenshotsError, count } = await supabase
      .from('screenshots')
      .select(`
        id,
        short_id,
        original_filename,
        file_size,
        width,
        height,
        mime_type,
        views,
        sharing_mode,
        expires_at,
        processing_status,
        created_at,
        updated_at,
        storage_path
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .order(sort, { ascending: order === 'asc' })
      .range(from, to)

    if (screenshotsError) {
      console.error('Error fetching screenshots:', screenshotsError)
      return NextResponse.json(
        { error: 'Failed to fetch screenshots' },
        { status: 500 }
      )
    }

    // Calculate pagination metadata
    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / limit)
    const hasNextPage = page < totalPages
    const hasPreviousPage = page > 1

    // Format screenshots for response
    const formattedScreenshots = screenshots.map(screenshot => ({
      id: screenshot.id,
      shortId: screenshot.short_id,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/${screenshot.short_id}`,
      originalFilename: screenshot.original_filename,
      fileSize: screenshot.file_size,
      dimensions: {
        width: screenshot.width,
        height: screenshot.height
      },
      mimeType: screenshot.mime_type,
      views: screenshot.views,
      sharingMode: screenshot.sharing_mode,
      expiresAt: screenshot.expires_at,
      processingStatus: screenshot.processing_status,
      createdAt: screenshot.created_at,
      updatedAt: screenshot.updated_at,
      storagePath: screenshot.storage_path
    }))

    // Return response with pagination metadata
    return NextResponse.json(
      {
        screenshots: formattedScreenshots,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage,
          hasPreviousPage,
          sort,
          order
        }
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error in /api/screenshots:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
