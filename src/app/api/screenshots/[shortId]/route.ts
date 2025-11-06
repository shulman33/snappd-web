/**
 * DELETE /api/screenshots/[shortId]
 *
 * Delete a single screenshot by short ID
 *
 * Features:
 * - Verifies user owns the screenshot
 * - Deletes screenshot metadata from database
 * - Deletes file from Supabase Storage
 * - Automatically updates monthly_usage via database trigger
 *
 * Security:
 * - Requires authentication
 * - Ownership verification (RLS + explicit check)
 * - Returns 404 if not found or not owned
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { ApiErrorHandler, ApiErrorCode } from '@/lib/api/errors'
import { ApiResponse } from '@/lib/api/response'

interface RouteContext {
  params: Promise<{ shortId: string }>
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createServerClient()
    const { shortId } = await context.params

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

    // Fetch screenshot metadata (RLS ensures user can only see their own screenshots)
    const { data: screenshot, error: fetchError } = await supabase
      .from('screenshots')
      .select('id, short_id, user_id, storage_path, file_size')
      .eq('short_id', shortId)
      .single()

    if (fetchError || !screenshot) {
      return ApiErrorHandler.notFound(
        ApiErrorCode.SCREENSHOT_NOT_FOUND,
        'Screenshot not found or you do not have permission to delete it'
      )
    }

    // Extra ownership check (should be redundant with RLS, but adds safety)
    if (screenshot.user_id !== user.id) {
      return ApiErrorHandler.forbidden(
        ApiErrorCode.SCREENSHOT_ACCESS_DENIED,
        'You do not have permission to delete this screenshot'
      )
    }

    // Delete file from storage
    const { error: storageError } = await supabase.storage
      .from('screenshots')
      .remove([screenshot.storage_path])

    if (storageError) {
      console.error(
        `Failed to delete storage file for screenshot ${shortId}:`,
        storageError
      )
      // Continue with database deletion even if storage deletion fails
      // This prevents orphaned database records
      // Storage cleanup can be handled by a separate cleanup job
    }

    // Delete screenshot record from database
    // This will trigger update_monthly_usage_on_delete automatically
    const { error: deleteError } = await supabase
      .from('screenshots')
      .delete()
      .eq('id', screenshot.id)

    if (deleteError) {
      console.error(
        `Failed to delete screenshot ${shortId} from database:`,
        deleteError
      )
      return ApiErrorHandler.internal(
        ApiErrorCode.SCREENSHOT_DELETE_FAILED,
        'Failed to delete screenshot. Please try again later.',
        deleteError.message
      )
    }

    return ApiResponse.success(
      {
        deletedScreenshot: {
          shortId: screenshot.short_id,
          fileSize: screenshot.file_size
        }
      },
      'Screenshot deleted successfully'
    )
  } catch (error) {
    console.error('Error in DELETE /api/screenshots/[shortId]:', error)
    return ApiErrorHandler.handle(error)
  }
}
