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
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required. Please sign in to delete screenshots.'
        },
        { status: 401 }
      )
    }

    // Fetch screenshot metadata (RLS ensures user can only see their own screenshots)
    const { data: screenshot, error: fetchError } = await supabase
      .from('screenshots')
      .select('id, short_id, user_id, storage_path, file_size')
      .eq('short_id', shortId)
      .single()

    if (fetchError || !screenshot) {
      return NextResponse.json(
        {
          success: false,
          error: 'Screenshot not found or you do not have permission to delete it'
        },
        { status: 404 }
      )
    }

    // Extra ownership check (should be redundant with RLS, but adds safety)
    if (screenshot.user_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'You do not have permission to delete this screenshot'
        },
        { status: 403 }
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
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to delete screenshot. Please try again later.'
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Screenshot deleted successfully',
        deletedScreenshot: {
          shortId: screenshot.short_id,
          fileSize: screenshot.file_size
        }
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error in DELETE /api/screenshots/[shortId]:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error. Please try again later.'
      },
      { status: 500 }
    )
  }
}
