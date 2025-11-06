/**
 * Supabase Storage helpers for screenshot uploads
 *
 * Provides utilities for:
 * - Generating storage paths
 * - Creating signed upload URLs
 * - Generating optimized image URLs with transformations
 */

import { createServerClient } from '@/lib/supabase/server'

const BUCKET_NAME = 'screenshots'

/**
 * Generate a storage path for a screenshot
 * Format: {user_id}/{year}/{month}/{hash}-{timestamp}.{ext}
 */
export function generateFilePath(
  userId: string,
  fileHash: string,
  extension: string
): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const timestamp = now.getTime()

  return `${userId}/${year}/${month}/${fileHash}-${timestamp}.${extension}`
}

/**
 * Generate a thumbnail path from a storage path
 * Example: user_id/2025/11/hash-timestamp.png -> user_id/2025/11/hash-timestamp_thumb.webp
 */
export function generateThumbnailPath(storagePath: string): string {
  const lastDot = storagePath.lastIndexOf('.')
  const pathWithoutExt = storagePath.substring(0, lastDot)
  return `${pathWithoutExt}_thumb.webp`
}

/**
 * Generate an optimized path from a storage path
 * Example: user_id/2025/11/hash-timestamp.png -> user_id/2025/11/hash-timestamp_opt.webp
 */
export function generateOptimizedPath(storagePath: string): string {
  const lastDot = storagePath.lastIndexOf('.')
  const pathWithoutExt = storagePath.substring(0, lastDot)
  return `${pathWithoutExt}_opt.webp`
}

/**
 * Create a signed upload URL for direct client uploads
 *
 * @param storagePath - The path where the file will be stored
 * @param upsert - Whether to overwrite existing files (default: false)
 * @returns Signed upload URL with token
 */
export async function createSignedUploadUrl(
  storagePath: string,
  upsert = false
): Promise<{ signedUrl: string; token: string; path: string } | { error: string }> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .storage
    .from(BUCKET_NAME)
    .createSignedUploadUrl(storagePath, {
      upsert
    })

  if (error) {
    console.error('Error creating signed upload URL:', error)
    return { error: error.message }
  }

  return {
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path
  }
}

/**
 * Get a public URL for a screenshot
 *
 * @param storagePath - The storage path
 * @returns Public URL
 */
export function getPublicUrl(storagePath: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${storagePath}`
}

/**
 * Get a public URL with Supabase image transformations
 *
 * Uses Supabase Storage's built-in image transformation API
 * to optimize images on the fly with CDN caching.
 *
 * @param storagePath - The storage path
 * @param options - Transformation options
 * @returns Transformed image URL using Supabase's render endpoint
 */
export function getTransformedImageUrl(
  storagePath: string,
  options: {
    width?: number
    height?: number
    quality?: number
    resize?: 'cover' | 'contain' | 'fill'
    format?: 'origin' | 'webp'
  } = {}
): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  // Use Supabase's image transformation render endpoint
  // Format: https://{project_id}.supabase.co/storage/v1/render/image/public/{bucket}/{path}
  const baseUrl = `${supabaseUrl}/storage/v1/render/image/public/${BUCKET_NAME}/${storagePath}`
  const params = new URLSearchParams()

  // Add transformation parameters according to Supabase API
  if (options.width) params.append('width', String(options.width))
  if (options.height) params.append('height', String(options.height))
  if (options.quality) params.append('quality', String(options.quality))
  if (options.resize) params.append('resize', options.resize)
  if (options.format) params.append('format', options.format)

  const queryString = params.toString()
  return queryString ? `${baseUrl}?${queryString}` : baseUrl
}

/**
 * Get a thumbnail URL with optimized transformations
 *
 * Creates a 200x150px thumbnail using cover mode (maintains aspect ratio,
 * fills the size, and crops projecting parts). Automatically optimizes to
 * WebP format with quality 75 for fast loading.
 *
 * @param storagePath - The original storage path
 * @returns Thumbnail URL (200x150px, cover mode, webp, quality 75)
 */
export function getThumbnailUrl(storagePath: string): string {
  return getTransformedImageUrl(storagePath, {
    width: 200,
    height: 150,
    quality: 75,
    resize: 'cover' // Maintains aspect ratio, crops to fill dimensions
  })
}

/**
 * Get an optimized full-size URL
 *
 * Optimizes the image for web delivery using WebP format with quality 75.
 * Supabase automatically detects browser support and serves the best format.
 * Does not resize, only optimizes compression.
 *
 * @param storagePath - The original storage path
 * @returns Optimized URL (webp format, quality 75, no resizing)
 */
export function getOptimizedUrl(storagePath: string): string {
  return getTransformedImageUrl(storagePath, {
    quality: 75
    // No format specified - let Supabase auto-detect and serve best format
  })
}

/**
 * Delete a file from storage
 *
 * @param storagePath - The path to delete
 * @returns Success status
 */
export async function deleteFile(storagePath: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient()

  const { error } = await supabase
    .storage
    .from(BUCKET_NAME)
    .remove([storagePath])

  if (error) {
    console.error('Error deleting file:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Delete multiple files from storage
 *
 * @param storagePaths - Array of paths to delete
 * @returns Success status
 */
export async function deleteFiles(storagePaths: string[]): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient()

  const { error } = await supabase
    .storage
    .from(BUCKET_NAME)
    .remove(storagePaths)

  if (error) {
    console.error('Error deleting files:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}
