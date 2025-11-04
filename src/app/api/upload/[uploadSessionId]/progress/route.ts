import { createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/upload/:uploadSessionId/progress
 *
 * Returns the current upload session status and progress information.
 * Used by clients to monitor upload progress and detect failures.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ uploadSessionId: string }> }
) {
  try {
    const supabase = await createServerClient()
    const { uploadSessionId } = await params

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch upload session
    const { data: session, error: sessionError } = await supabase
      .from('upload_sessions')
      .select('*')
      .eq('id', uploadSessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Upload session not found' },
        { status: 404 }
      )
    }

    // Calculate progress percentage
    const progressPercentage = session.file_size > 0
      ? Math.round((session.bytes_uploaded / session.file_size) * 100)
      : 0

    // Return progress information
    return NextResponse.json({
      uploadSessionId: session.id,
      status: session.upload_status,
      progress: {
        bytesUploaded: session.bytes_uploaded,
        totalBytes: session.file_size,
        percentage: progressPercentage,
      },
      retryCount: session.retry_count,
      errorMessage: session.error_message,
      screenshotId: session.screenshot_id,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
    })
  } catch (error) {
    console.error('Error fetching upload progress:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
