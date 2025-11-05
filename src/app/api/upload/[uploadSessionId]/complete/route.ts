/**
 * POST /api/upload/[uploadSessionId]/complete
 *
 * Complete a screenshot upload after the file has been uploaded to storage
 *
 * Features:
 * - Verify upload session exists and belongs to user
 * - Calculate file hash and check for duplicates
 * - Generate short ID for sharing
 * - Create screenshot record in database
 * - Update upload session status
 * - Trigger quota enforcement via database trigger
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { encodeBase62 } from '@/lib/uploads/encoding'
import { hashPassword, validatePasswordStrength } from '@/lib/uploads/security'

interface RouteContext {
  params: Promise<{ uploadSessionId: string }>
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = await createServerClient()
    const { uploadSessionId } = await context.params

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

    // Parse request body
    const body = await request.json()
    const {
      fileHash,
      width,
      height,
      sharingMode = 'public',
      password,
      expiresIn
    } = body

    // Validate required fields
    if (!fileHash || !width || !height) {
      return NextResponse.json(
        { error: 'Missing required fields: fileHash, width, height' },
        { status: 400 }
      )
    }

    // Fetch upload session
    const { data: uploadSession, error: sessionError } = await supabase
      .from('upload_sessions')
      .select('*')
      .eq('id', uploadSessionId)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !uploadSession) {
      return NextResponse.json(
        { error: 'Upload session not found or expired' },
        { status: 404 }
      )
    }

    // Check if session is still valid
    if (uploadSession.upload_status === 'completed') {
      return NextResponse.json(
        { error: 'Upload session already completed' },
        { status: 400 }
      )
    }

    // Retry logic: Allow retry if failed and under max retry limit (3 attempts)
    const MAX_RETRIES = 3
    if (uploadSession.upload_status === 'failed') {
      const currentRetryCount = uploadSession.retry_count ?? 0
      if (currentRetryCount >= MAX_RETRIES) {
        return NextResponse.json(
          {
            error: 'Upload session failed. Maximum retry attempts exceeded. Please start a new upload.',
            retryCount: currentRetryCount,
            maxRetries: MAX_RETRIES
          },
          { status: 400 }
        )
      }

      // Allow retry - increment retry count
      await supabase
        .from('upload_sessions')
        .update({
          upload_status: 'uploading',
          retry_count: currentRetryCount + 1,
          error_message: null
        })
        .eq('id', uploadSessionId)

      // Update local session object
      uploadSession.retry_count = currentRetryCount + 1
      uploadSession.upload_status = 'uploading'
    }

    // Check for duplicate file (same hash for same user)
    const { data: existingScreenshot } = await supabase
      .from('screenshots')
      .select('id, short_id')
      .eq('user_id', user.id)
      .eq('file_hash', fileHash)
      .single()

    if (existingScreenshot) {
      // File already exists, return existing screenshot
      return NextResponse.json(
        {
          message: 'File already exists',
          screenshot: {
            id: existingScreenshot.id,
            shortId: existingScreenshot.short_id,
            shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/${existingScreenshot.short_id}`
          },
          duplicate: true
        },
        { status: 200 }
      )
    }

    // Generate short ID
    // Use timestamp + random number for uniqueness
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 1000000)
    const shortId = encodeBase62(timestamp * 1000000 + random)

    // Calculate expiration date
    let expiresAt: string | null = null
    if (expiresIn) {
      // expiresIn is in seconds
      expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
    } else {
      // Get user profile to check plan
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', user.id)
        .single()

      // Free users: 30 days expiration
      // Pro/Team users: no expiration
      if (profile?.plan === 'free') {
        expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    }

    // Hash password if provided
    let passwordHash: string | null = null
    if (sharingMode === 'password') {
      if (!password) {
        return NextResponse.json(
          { error: 'Password required for password-protected sharing mode' },
          { status: 400 }
        )
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password)
      if (!passwordValidation.isValid) {
        return NextResponse.json(
          { error: passwordValidation.error },
          { status: 400 }
        )
      }

      // Hash password using our security module
      try {
        passwordHash = await hashPassword(password)
      } catch (error) {
        return NextResponse.json(
          { error: 'Failed to secure password. Please try again.' },
          { status: 500 }
        )
      }
    }

    // Generate storage path (update from temp path)
    const extension = uploadSession.mime_type.split('/')[1] || 'png'
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const storagePath = `${user.id}/${year}/${month}/${fileHash}-${timestamp}.${extension}`

    // Create screenshot record
    // This will trigger the quota enforcement and usage tracking
    const { data: screenshot, error: screenshotError } = await supabase
      .from('screenshots')
      .insert({
        user_id: user.id,
        short_id: shortId,
        storage_path: storagePath,
        original_filename: uploadSession.filename,
        file_size: uploadSession.file_size,
        width,
        height,
        mime_type: uploadSession.mime_type,
        file_hash: fileHash,
        sharing_mode: sharingMode,
        password_hash: passwordHash,
        expires_at: expiresAt,
        processing_status: 'completed',
        is_public: sharingMode === 'public'
      })
      .select()
      .single()

    if (screenshotError) {
      console.error('Failed to create screenshot record:', screenshotError)

      // Update upload session to failed status with error message
      await supabase
        .from('upload_sessions')
        .update({
          upload_status: 'failed',
          error_message: screenshotError.message || 'Failed to create screenshot record'
        })
        .eq('id', uploadSessionId)

      // Check if it's a quota error
      if (screenshotError.message?.includes('quota exceeded')) {
        return NextResponse.json(
          {
            error: 'Monthly upload quota exceeded',
            retryable: false,
            upgrade: {
              message: 'Upgrade to Pro for unlimited uploads',
              url: '/pricing'
            }
          },
          { status: 403 }
        )
      }

      // Determine if error is retryable
      const currentRetryCount = uploadSession.retry_count ?? 0
      const isRetryable = currentRetryCount < MAX_RETRIES

      return NextResponse.json(
        {
          error: 'Failed to complete upload. Please try again.',
          retryable: isRetryable,
          retryCount: currentRetryCount,
          maxRetries: MAX_RETRIES
        },
        { status: 500 }
      )
    }

    // Update upload session to completed
    await supabase
      .from('upload_sessions')
      .update({
        upload_status: 'completed',
        screenshot_id: screenshot.id
      })
      .eq('id', uploadSessionId)

    // Return screenshot details
    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/${shortId}`

    return NextResponse.json(
      {
        message: 'Upload completed successfully',
        screenshot: {
          id: screenshot.id,
          shortId: screenshot.short_id,
          shareUrl,
          storagePath: screenshot.storage_path,
          expiresAt: screenshot.expires_at,
          sharingMode: screenshot.sharing_mode,
          width: screenshot.width,
          height: screenshot.height,
          fileSize: screenshot.file_size,
          createdAt: screenshot.created_at
        }
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in /api/upload/[uploadSessionId]/complete:', error)

    // Try to update upload session to failed status
    try {
      const supabase = await createServerClient()
      const { uploadSessionId } = await context.params

      const { data: session } = await supabase
        .from('upload_sessions')
        .select('retry_count')
        .eq('id', uploadSessionId)
        .single()

      if (session) {
        await supabase
          .from('upload_sessions')
          .update({
            upload_status: 'failed',
            error_message: error instanceof Error ? error.message : 'Internal server error'
          })
          .eq('id', uploadSessionId)

        const currentRetryCount = session.retry_count ?? 0
        const isRetryable = currentRetryCount < 3
        return NextResponse.json(
          {
            error: 'Internal server error. Please try again later.',
            retryable: isRetryable,
            retryCount: currentRetryCount,
            maxRetries: 3
          },
          { status: 500 }
        )
      }
    } catch (updateError) {
      console.error('Failed to update session status on error:', updateError)
    }

    return NextResponse.json(
      { error: 'Internal server error. Please try again later.' },
      { status: 500 }
    )
  }
}
