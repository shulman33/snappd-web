/**
 * POST /api/upload/init
 *
 * Initialize a screenshot upload session
 *
 * Features:
 * - Authentication required
 * - Quota checking (free users: 10/month, pro users: unlimited)
 * - Generates signed upload URL for direct client upload
 * - Creates upload session record for progress tracking
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { checkUploadQuota } from '@/lib/uploads/quota'
import { generateFilePath, createSignedUploadUrl } from '@/lib/uploads/storage'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Check authentication
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to upload screenshots.' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { filename, fileSize: fileSizeRaw, mimeType } = body

    // Validate required fields
    if (!filename || !fileSizeRaw || !mimeType) {
      return NextResponse.json(
        { error: 'Missing required fields: filename, fileSize, mimeType' },
        { status: 400 }
      )
    }

    // Convert fileSize to number (handles both number and bigint from JSON)
    const fileSize = Number(fileSizeRaw)

    // Validate file size
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          maxSize: MAX_FILE_SIZE
        },
        { status: 413 }
      )
    }

    // Validate MIME type
    const allowedMimeTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/gif'
    ]

    if (!allowedMimeTypes.includes(mimeType)) {
      return NextResponse.json(
        {
          error: 'Invalid file type. Allowed types: PNG, JPEG, WEBP, GIF',
          allowedTypes: allowedMimeTypes
        },
        { status: 400 }
      )
    }

    // Check upload quota
    const quotaCheck = await checkUploadQuota(user.id)

    if (!quotaCheck.canUpload) {
      return NextResponse.json(
        {
          error: 'Monthly upload quota exceeded',
          quota: {
            plan: quotaCheck.plan,
            limit: quotaCheck.limit,
            used: quotaCheck.used,
            remaining: 0
          },
          upgrade: {
            message: 'Upgrade to Pro for unlimited uploads',
            url: '/pricing'
          }
        },
        { status: 403 }
      )
    }

    // Generate storage path
    // We'll use a temporary hash for path generation
    // The actual file hash will be calculated after upload
    const tempHash = `temp-${Date.now()}`
    const extension = mimeType.split('/')[1] || 'png'
    const storagePath = generateFilePath(user.id, tempHash, extension)

    // Create signed upload URL
    const signedUrlResult = await createSignedUploadUrl(storagePath, false)

    if ('error' in signedUrlResult) {
      console.error('Failed to create signed URL:', signedUrlResult.error)
      return NextResponse.json(
        { error: 'Failed to generate upload URL. Please try again.' },
        { status: 500 }
      )
    }

    // Create upload session record
    const { data: uploadSession, error: sessionError } = await supabase
      .from('upload_sessions')
      .insert({
        user_id: user.id,
        filename,
        file_size: fileSize,
        mime_type: mimeType,
        upload_status: 'pending',
        signed_url: signedUrlResult.signedUrl,
        signed_url_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour expiry
      })
      .select()
      .single()

    if (sessionError || !uploadSession) {
      console.error('Failed to create upload session:', sessionError)
      return NextResponse.json(
        { error: 'Failed to initialize upload session. Please try again.' },
        { status: 500 }
      )
    }

    // Return upload session details
    return NextResponse.json(
      {
        uploadSessionId: uploadSession.id,
        signedUrl: signedUrlResult.signedUrl,
        token: signedUrlResult.token,
        storagePath: signedUrlResult.path,
        expiresAt: uploadSession.signed_url_expires_at,
        quota: {
          plan: quotaCheck.plan,
          limit: quotaCheck.limit,
          used: quotaCheck.used,
          remaining: quotaCheck.remaining
        }
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error in /api/upload/init:', error)
    return NextResponse.json(
      { error: 'Internal server error. Please try again later.' },
      { status: 500 }
    )
  }
}
