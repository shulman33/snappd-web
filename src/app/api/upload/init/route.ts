/**
 * POST /api/upload/init
 *
 * Initialize a screenshot upload session (single or batch)
 *
 * Features:
 * - Authentication required
 * - Quota checking (free users: 10/month, pro users: unlimited)
 * - Generates signed upload URL for direct client upload
 * - Creates upload session record for progress tracking
 * - Supports batch uploads (multiple files in single request)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { checkUploadQuota } from '@/lib/uploads/quota'
import { generateFilePath, createSignedUploadUrl } from '@/lib/uploads/storage'
import { hashPassword, validatePasswordStrength } from '@/lib/uploads/security'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiErrorHandler, ApiErrorCode } from '@/lib/api/errors'
import { ApiResponse } from '@/lib/api/response'
import { logger } from '@/lib/logger'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// Type definition for single upload request
interface SingleUploadRequest {
  filename: string
  fileSize: number
  mimeType: string
  sharingMode?: 'public' | 'private' | 'password'
  password?: string
  expiresIn?: number // Expiration time in seconds (for future use)
}

// Type definition for batch upload request
interface BatchUploadRequest {
  files: SingleUploadRequest[]
}

/**
 * Validate and process sharing mode settings
 * Returns password hash if password-protected mode is used
 */
async function validateSharingMode(
  sharingMode?: string,
  password?: string
): Promise<{
  isValid: boolean
  error?: string
  passwordHash?: string | null
  validatedSharingMode: 'public' | 'private' | 'password'
}> {
  // Default to public if not specified
  const mode = sharingMode || 'public'

  // Validate sharing mode value
  if (!['public', 'private', 'password'].includes(mode)) {
    return {
      isValid: false,
      error: 'Invalid sharing mode. Must be: public, private, or password',
      validatedSharingMode: 'public'
    }
  }

  // If password mode, validate password is provided
  if (mode === 'password') {
    if (!password) {
      return {
        isValid: false,
        error: 'Password is required for password-protected sharing mode',
        validatedSharingMode: mode as 'password'
      }
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password)
    if (!passwordValidation.isValid) {
      return {
        isValid: false,
        error: passwordValidation.error,
        validatedSharingMode: mode as 'password'
      }
    }

    // Hash the password
    try {
      const passwordHash = await hashPassword(password)
      return {
        isValid: true,
        passwordHash,
        validatedSharingMode: mode as 'password'
      }
    } catch (error) {
      return {
        isValid: false,
        error: 'Failed to secure password. Please try again.',
        validatedSharingMode: mode as 'password'
      }
    }
  }

  // For public/private modes, no password needed
  return {
    isValid: true,
    passwordHash: null,
    validatedSharingMode: mode as 'public' | 'private' | 'password'
  }
}

/**
 * Handle batch upload initialization
 * Creates multiple upload sessions and checks quota for all files
 */
async function handleBatchUpload(
  body: BatchUploadRequest,
  userId: string,
  supabase: SupabaseClient
) {
  const { files } = body

  // Validate batch request
  if (!files || files.length === 0) {
    return NextResponse.json(
      { error: 'No files provided in batch upload request' },
      { status: 400 }
    )
  }

  if (files.length > 50) {
    return NextResponse.json(
      { error: 'Batch upload limited to 50 files at a time' },
      { status: 400 }
    )
  }

  // Check quota for all files
  const quotaCheck = await checkUploadQuota(userId)
  const allowedMimeTypes = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif'
  ]

  // Calculate how many files can be uploaded based on remaining quota
  const remainingQuota = quotaCheck.remaining
  const requestedCount = files.length

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

  // For free users, limit by remaining quota
  let filesToProcess = files
  let partialSuccess = false

  if (quotaCheck.plan === 'free' && requestedCount > remainingQuota) {
    filesToProcess = files.slice(0, remainingQuota)
    partialSuccess = true
  }

  // Validate all files before processing
  const validationErrors: Array<{ index: number; filename: string; error: string }> = []

  filesToProcess.forEach((file, index) => {
    if (!file.filename || !file.fileSize || !file.mimeType) {
      validationErrors.push({
        index,
        filename: file.filename || 'unknown',
        error: 'Missing required fields: filename, fileSize, mimeType'
      })
    } else if (file.fileSize > MAX_FILE_SIZE) {
      validationErrors.push({
        index,
        filename: file.filename,
        error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
      })
    } else if (!allowedMimeTypes.includes(file.mimeType)) {
      validationErrors.push({
        index,
        filename: file.filename,
        error: 'Invalid file type. Allowed types: PNG, JPEG, WEBP, GIF'
      })
    }
  })

  if (validationErrors.length > 0) {
    return NextResponse.json(
      {
        error: 'Validation failed for some files',
        validationErrors
      },
      { status: 400 }
    )
  }

  // Process all files concurrently
  const uploadPromises = filesToProcess.map(async (file) => {
    try {
      const { filename, fileSize, mimeType } = file

      // Generate storage path
      const tempHash = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`
      const extension = mimeType.split('/')[1] || 'png'
      const storagePath = generateFilePath(userId, tempHash, extension)

      // Create signed upload URL
      const signedUrlResult = await createSignedUploadUrl(storagePath, false)

      if ('error' in signedUrlResult) {
        throw new Error('Failed to generate upload URL')
      }

      // Create upload session record
      const { data: uploadSession, error: sessionError } = await supabase
        .from('upload_sessions')
        .insert({
          user_id: userId,
          filename,
          file_size: fileSize,
          mime_type: mimeType,
          upload_status: 'pending',
          signed_url: signedUrlResult.signedUrl,
          signed_url_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        })
        .select()
        .single()

      if (sessionError || !uploadSession) {
        throw new Error('Failed to create upload session')
      }

      return {
        success: true,
        uploadSessionId: uploadSession.id,
        signedUrl: signedUrlResult.signedUrl,
        token: signedUrlResult.token,
        storagePath: signedUrlResult.path,
        expiresAt: uploadSession.signed_url_expires_at,
        filename
      }
    } catch (error) {
      return {
        success: false,
        filename: file.filename,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Wait for all uploads to complete
  const results = await Promise.allSettled(uploadPromises)

  // Process results
  const successfulUploads = results
    .filter((result) => result.status === 'fulfilled' && result.value.success)
    .map((result) => (result as PromiseFulfilledResult<any>).value)

  const failedUploads = results
    .filter(
      (result) =>
        result.status === 'rejected' ||
        (result.status === 'fulfilled' && !result.value.success)
    )
    .map((result, index) => {
      if (result.status === 'rejected') {
        return {
          filename: filesToProcess[index].filename,
          error: result.reason?.message || 'Unknown error'
        }
      } else {
        return {
          filename: (result as PromiseFulfilledResult<any>).value.filename,
          error: (result as PromiseFulfilledResult<any>).value.error
        }
      }
    })

  // Return response with partial success information
  return NextResponse.json(
    {
      batchId: `batch-${Date.now()}`,
      totalRequested: requestedCount,
      totalProcessed: filesToProcess.length,
      successCount: successfulUploads.length,
      failedCount: failedUploads.length,
      uploads: successfulUploads,
      failures: failedUploads,
      partialSuccess,
      ...(partialSuccess && {
        warning: `Only ${remainingQuota} of ${requestedCount} files could be uploaded due to quota limits. Upgrade to Pro for unlimited uploads.`
      }),
      quota: {
        plan: quotaCheck.plan,
        limit: quotaCheck.limit,
        used: quotaCheck.used,
        remaining: quotaCheck.remaining - successfulUploads.length
      }
    },
    { status: successfulUploads.length > 0 ? 200 : 500 }
  )
}

export async function POST(request: NextRequest) {
  try {
    logger.info('Upload initialization requested', request);

    const supabase = await createServerClient()

    // Check authentication
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return ApiErrorHandler.unauthorized(
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required. Please sign in to upload screenshots.',
        undefined,
        request
      )
    }

    logger.debug('User authenticated for upload', request, { userId: user.id });

    // Parse request body
    const body = await request.json()

    // Detect if this is a batch upload or single upload
    const isBatchUpload = 'files' in body && Array.isArray(body.files)

    if (isBatchUpload) {
      // Handle batch upload
      logger.info('Batch upload requested', request, {
        userId: user.id,
        fileCount: body.files.length
      });
      return handleBatchUpload(body as BatchUploadRequest, user.id, supabase)
    }

    logger.info('Single upload requested', request, {
      userId: user.id,
      filename: body.filename
    });

    // Handle single upload (backward compatible)
    const { filename, fileSize: fileSizeRaw, mimeType, sharingMode, password } = body

    // Validate required fields
    if (!filename || !fileSizeRaw || !mimeType) {
      return ApiErrorHandler.badRequest(
        ApiErrorCode.VALIDATION_ERROR,
        'Missing required fields: filename, fileSize, mimeType',
        undefined,
        request
      )
    }

    // Validate sharing mode and password
    const sharingValidation = await validateSharingMode(sharingMode, password)
    if (!sharingValidation.isValid) {
      return ApiErrorHandler.badRequest(
        ApiErrorCode.VALIDATION_ERROR,
        sharingValidation.error || 'Invalid sharing mode configuration',
        undefined,
        request
      )
    }

    // Convert fileSize to number (handles both number and bigint from JSON)
    const fileSize = Number(fileSizeRaw)

    // Validate file size
    if (fileSize > MAX_FILE_SIZE) {
      return ApiErrorHandler.payloadTooLarge(
        ApiErrorCode.UPLOAD_FILE_TOO_LARGE,
        `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        {
          current: fileSize,
          limit: MAX_FILE_SIZE,
          unit: 'bytes'
        },
        request
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
      return ApiErrorHandler.badRequest(
        ApiErrorCode.UPLOAD_INVALID_FILE_TYPE,
        'Invalid file type. Allowed types: PNG, JPEG, WEBP, GIF',
        undefined,
        request
      )
    }

    // Check upload quota
    const quotaCheck = await checkUploadQuota(user.id)

    if (!quotaCheck.canUpload) {
      return ApiErrorHandler.quotaExceeded(
        ApiErrorCode.MONTHLY_UPLOAD_LIMIT_EXCEEDED,
        'Monthly upload quota exceeded',
        {
          current: quotaCheck.used,
          limit: quotaCheck.limit,
          unit: 'uploads'
        },
        {
          message: 'Upgrade to Pro for unlimited uploads',
          plan: 'pro',
          url: '/pricing'
        },
        request
      )
    }

    logger.debug('Quota check passed', request, {
      userId: user.id,
      plan: quotaCheck.plan,
      remaining: quotaCheck.remaining
    });

    // Generate storage path
    // We'll use a temporary hash for path generation
    // The actual file hash will be calculated after upload
    const tempHash = `temp-${Date.now()}`
    const extension = mimeType.split('/')[1] || 'png'
    const storagePath = generateFilePath(user.id, tempHash, extension)

    // Create signed upload URL
    const signedUrlResult = await createSignedUploadUrl(storagePath, false)

    if ('error' in signedUrlResult) {
      logger.error('Failed to create signed URL', request, {
        userId: user.id,
        error: signedUrlResult.error,
        storagePath
      });
      return ApiErrorHandler.internal(
        ApiErrorCode.STORAGE_ERROR,
        'Failed to generate upload URL. Please try again.',
        undefined,
        request
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
      logger.error('Failed to create upload session', request, {
        userId: user.id,
        error: sessionError,
        filename
      });
      return ApiErrorHandler.internal(
        ApiErrorCode.DATABASE_ERROR,
        'Failed to initialize upload session. Please try again.',
        undefined,
        request
      )
    }

    logger.info('Upload session created successfully', request, {
      userId: user.id,
      uploadSessionId: uploadSession.id,
      filename
    });

    // Return upload session details
    return ApiResponse.success(
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
      'Upload session initialized successfully'
    )
  } catch (error) {
    return ApiErrorHandler.handle(error, {
      request,
      logContext: {
        route: 'POST /api/upload/init'
      }
    });
  }
}
