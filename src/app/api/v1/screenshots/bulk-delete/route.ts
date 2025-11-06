/**
 * POST /api/v1/screenshots/bulk-delete
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
import { bulkOperationLimiter, getRateLimitHeaders } from '@/lib/auth/rate-limit'
import { ApiErrorHandler, ApiErrorCode } from '@/lib/api/errors'
import { ApiResponse } from '@/lib/api/response'

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
      return ApiErrorHandler.unauthorized(
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required. Please sign in to delete screenshots.'
      )
    }

    // Apply rate limiting for bulk operations
    const { success: rateLimitSuccess, pending, ...rateLimitInfo } = await bulkOperationLimiter.limit(user.id)
    const headers = getRateLimitHeaders({ success: rateLimitSuccess, pending, ...rateLimitInfo })

    if (!rateLimitSuccess) {
      const response = ApiErrorHandler.rateLimitExceeded(
        'Too many bulk operations. Please try again later.',
        rateLimitInfo.reset ? Math.ceil((rateLimitInfo.reset - Date.now()) / 1000) : undefined
      )
      // Add rate limit headers to response
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })
      return response
    }

    // Parse request body
    const body: BulkDeleteRequest = await request.json()
    const { shortIds } = body

    // Validate input
    if (!Array.isArray(shortIds) || shortIds.length === 0) {
      return ApiErrorHandler.badRequest(
        ApiErrorCode.VALIDATION_ERROR,
        'Invalid request. Please provide an array of shortIds.'
      )
    }

    // Limit batch size to prevent abuse
    if (shortIds.length > 100) {
      return ApiErrorHandler.badRequest(
        ApiErrorCode.VALIDATION_ERROR,
        'Batch size limit exceeded. Maximum 100 screenshots per request.'
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
      return ApiErrorHandler.internal(
        ApiErrorCode.DATABASE_ERROR,
        'Failed to fetch screenshots. Please try again later.',
        fetchError.message
      )
    }

    // If no screenshots found, all provided IDs are invalid or not owned by user
    if (!screenshots || screenshots.length === 0) {
      return ApiErrorHandler.bulkPartialFailure(
        'No screenshots found or you do not have permission to delete them',
        {
          totalRequested: shortIds.length,
          successCount: 0,
          failedCount: shortIds.length,
          failures: shortIds.map((shortId) => ({
            id: shortId,
            error: ApiErrorCode.SCREENSHOT_NOT_FOUND,
            message: 'Screenshot not found or you do not have permission to delete it'
          }))
        }
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
      return ApiErrorHandler.forbidden(
        ApiErrorCode.SCREENSHOT_ACCESS_DENIED,
        'You do not have permission to delete one or more screenshots'
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
      return ApiErrorHandler.internal(
        ApiErrorCode.SCREENSHOT_DELETE_FAILED,
        'Failed to delete screenshots. Please try again later.',
        deleteError.message
      )
    }

    const MAX_BULK_OPERATIONS = 100;

    if (screenshotIds.length > MAX_BULK_OPERATIONS) {
      return ApiErrorHandler.badRequest(
        ApiErrorCode.BAD_REQUEST,
        `Cannot process more than ${MAX_BULK_OPERATIONS} items at once`
      );
    }

    // Determine which screenshots were successfully deleted vs failed
    const deletedShortIds = screenshots.map((s) => s.short_id)
    const failedShortIds = shortIds.filter((id) => !deletedShortIds.includes(id))

    // Calculate total file size deleted
    const totalSizeDeleted = screenshots.reduce(
      (sum, s) => sum + (s.file_size || 0),
      0
    )

    // If there are failures, return 207 Multi-Status
    if (failedShortIds.length > 0) {
      return ApiErrorHandler.bulkPartialFailure(
        `Bulk delete completed with ${deletedShortIds.length} successes and ${failedShortIds.length} failures`,
        {
          totalRequested: shortIds.length,
          successCount: deletedShortIds.length,
          failedCount: failedShortIds.length,
          failures: failedShortIds.map((shortId) => ({
            id: shortId,
            error: ApiErrorCode.SCREENSHOT_NOT_FOUND,
            message: 'Screenshot not found or you do not have permission to delete it'
          }))
        }
      )
    }

    // All successful - return 200 OK with bulk success response
    return ApiResponse.bulkSuccess(
      shortIds.length,
      deletedShortIds.length,
      `Successfully deleted ${deletedShortIds.length} screenshot(s)`
    )
  } catch (error) {
    console.error('Error in POST /api/v1/screenshots/bulk-delete:', error)
    return ApiErrorHandler.handle(error)
  }
}
