/**
 * POST /api/screenshots/bulk-delete
 *
 * Delete multiple screenshots in a single operation
 *
 * Features:
 * - Bulk deletion of multiple screenshots by short IDs
 * - Atomic database operation (all or nothing)
 * - Batch storage file deletion
 * - Automatically updates monthly_usage via database trigger
 * - Returns detailed success/failure information for each screenshot
 *
 * Security:
 * - Requires authentication
 * - Ownership verification (RLS + explicit check)
 * - Only deletes screenshots owned by authenticated user
 *
 * Request Body:
 * {
 *   "shortIds": ["abc123", "def456", "ghi789"]
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "deleted": ["abc123", "def456"],
 *   "failed": [{"shortId": "ghi789", "error": "Not found"}],
 *   "totalDeleted": 2,
 *   "totalFailed": 1
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

interface BulkDeleteRequest {
  shortIds: string[]
}

interface DeleteResult {
  shortId: string
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Authenticate user
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required. Please sign in to delete screenshots.'
        },
        { status: 401 }
      )
    }

    // Parse request body
    const body: BulkDeleteRequest = await request.json()
    const { shortIds } = body

    // Validate input
    if (!Array.isArray(shortIds) || shortIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request. Please provide an array of shortIds.'
        },
        { status: 400 }
      )
    }

    // Limit batch size to prevent abuse
    if (shortIds.length > 100) {
      return NextResponse.json(
        {
          success: false,
          error: 'Batch size limit exceeded. Maximum 100 screenshots per request.'
        },
        { status: 400 }
      )
    }

    // Fetch all screenshots matching the provided short IDs
    // RLS ensures we only get screenshots owned by the authenticated user
    const { data: screenshots, error: fetchError } = await supabase
      .from('screenshots')
      .select('id, short_id, user_id, storage_path, file_size')
      .in('short_id', shortIds)

    if (fetchError) {
      console.error('Error fetching screenshots for bulk delete:', fetchError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch screenshots. Please try again later.'
        },
        { status: 500 }
      )
    }

    // If no screenshots found, all provided IDs are invalid or not owned by user
    if (!screenshots || screenshots.length === 0) {
      return NextResponse.json(
        {
          success: false,
          deleted: [],
          failed: shortIds.map((shortId) => ({
            shortId,
            error: 'Screenshot not found or you do not have permission to delete it'
          })),
          totalDeleted: 0,
          totalFailed: shortIds.length
        },
        { status: 404 }
      )
    }

    // Extra ownership verification (should be redundant with RLS, but adds safety)
    const unauthorizedScreenshots = screenshots.filter(
      (screenshot) => screenshot.user_id !== user.id
    )

    if (unauthorizedScreenshots.length > 0) {
      console.warn(
        `User ${user.id} attempted to delete unauthorized screenshots:`,
        unauthorizedScreenshots.map((s) => s.short_id)
      )
      return NextResponse.json(
        {
          success: false,
          error: 'You do not have permission to delete one or more screenshots'
        },
        { status: 403 }
      )
    }

    // Collect storage paths for batch deletion
    const storagePaths = screenshots
      .map((s) => s.storage_path)
      .filter((path): path is string => !!path)

    // Delete files from storage (batch operation)
    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('screenshots')
        .remove(storagePaths)

      if (storageError) {
        console.error('Failed to delete storage files:', storageError)
        // Continue with database deletion even if storage deletion fails
        // Storage cleanup can be handled by a separate cleanup job
      }
    }

    // Delete screenshot records from database (atomic operation)
    // This will trigger update_monthly_usage_on_delete for each deleted screenshot
    const screenshotIds = screenshots.map((s) => s.id)
    const { error: deleteError } = await supabase
      .from('screenshots')
      .delete()
      .in('id', screenshotIds)

    if (deleteError) {
      console.error('Failed to delete screenshots from database:', deleteError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to delete screenshots. Please try again later.'
        },
        { status: 500 }
      )
    }

    // Determine which screenshots were successfully deleted vs failed
    const deletedShortIds = screenshots.map((s) => s.short_id)
    const failedShortIds = shortIds.filter((id) => !deletedShortIds.includes(id))

    const failed: DeleteResult[] = failedShortIds.map((shortId) => ({
      shortId,
      error: 'Screenshot not found or you do not have permission to delete it'
    }))

    // Calculate total file size deleted
    const totalSizeDeleted = screenshots.reduce(
      (sum, s) => sum + (s.file_size || 0),
      0
    )

    return NextResponse.json(
      {
        success: true,
        deleted: deletedShortIds,
        failed,
        totalDeleted: deletedShortIds.length,
        totalFailed: failed.length,
        totalSizeDeleted
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error in POST /api/screenshots/bulk-delete:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error. Please try again later.'
      },
      { status: 500 }
    )
  }
}
