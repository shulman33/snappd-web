/**
 * Storage utilities for file uploads and MIME validation
 * Handles Supabase Storage operations with security checks
 */

import { supabaseAdmin } from './supabase';
import sharp from 'sharp';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from './validation';

/**
 * Magic bytes for image file type detection
 */
const FILE_SIGNATURES: Record<string, number[]> = {
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/gif': [0x47, 0x49, 0x46],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF header
};

/**
 * Supabase Storage bucket name
 */
export const SCREENSHOTS_BUCKET = 'screenshots';

/**
 * Validate MIME type against allowed list
 * 
 * @param mimeType - MIME type to validate
 * @returns true if allowed, false otherwise
 */
export const validateMimeType = (mimeType: string): boolean => {
  return ALLOWED_MIME_TYPES.includes(mimeType as typeof ALLOWED_MIME_TYPES[number]);
};

/**
 * Validate file signature (magic bytes) to prevent MIME spoofing
 * 
 * @param buffer - File buffer (first few bytes)
 * @param declaredMimeType - MIME type claimed by client
 * @returns true if signature matches MIME type, false otherwise
 */
export const validateFileSignature = (
  buffer: ArrayBuffer,
  declaredMimeType: string
): boolean => {
  const bytes = new Uint8Array(buffer);
  const signature = FILE_SIGNATURES[declaredMimeType];
  
  if (!signature) {
    return false;
  }
  
  // Check PNG signature
  if (declaredMimeType === 'image/png') {
    return (
      bytes[0] === signature[0] &&
      bytes[1] === signature[1] &&
      bytes[2] === signature[2] &&
      bytes[3] === signature[3]
    );
  }
  
  // Check JPEG signature
  if (declaredMimeType === 'image/jpeg') {
    return (
      bytes[0] === signature[0] &&
      bytes[1] === signature[1] &&
      bytes[2] === signature[2]
    );
  }
  
  // Check GIF signature
  if (declaredMimeType === 'image/gif') {
    return (
      bytes[0] === signature[0] &&
      bytes[1] === signature[1] &&
      bytes[2] === signature[2]
    );
  }
  
  // Check WebP signature (RIFF + WEBP at offset 8)
  if (declaredMimeType === 'image/webp') {
    return (
      bytes[0] === signature[0] &&
      bytes[1] === signature[1] &&
      bytes[2] === signature[2] &&
      bytes[3] === signature[3] &&
      bytes[8] === 0x57 && // W
      bytes[9] === 0x45 && // E
      bytes[10] === 0x42 && // B
      bytes[11] === 0x50 // P
    );
  }
  
  return false;
};

/**
 * Optimize image to WebP format at 85% quality
 * Reduces file size while maintaining visual quality
 * Only processes if image exceeds MAX_FILE_SIZE
 * 
 * @param buffer - Original image buffer
 * @returns Optimized image buffer
 */
export const optimizeImage = async (buffer: Buffer): Promise<Buffer> => {
  try {
    // Only optimize if file is too large
    if (buffer.length > MAX_FILE_SIZE) {
      const optimized = await sharp(buffer)
        .webp({ quality: 85 })
        .toBuffer();
      
      // Return optimized version if smaller
      return optimized.length < buffer.length ? optimized : buffer;
    }
    
    return buffer;
  } catch (error) {
    console.error('Image optimization failed:', error);
    // Return original if optimization fails
    return buffer;
  }
};

/**
 * Get image dimensions from buffer
 * 
 * @param buffer - Image buffer
 * @returns { width: number, height: number }
 */
export const getImageDimensions = async (
  buffer: Buffer
): Promise<{ width: number; height: number }> => {
  const metadata = await sharp(buffer).metadata();
  
  if (!metadata.width || !metadata.height) {
    throw new Error('Failed to extract image dimensions');
  }
  
  return {
    width: metadata.width,
    height: metadata.height,
  };
};

/**
 * Generate signed upload URL for Supabase Storage
 * Allows direct browser upload without proxying through API
 * 
 * @param storagePath - Full storage path (e.g., "user_id/timestamp_nanoid.png")
 * @param expiresIn - URL expiration time in seconds (default: 300 = 5 minutes)
 * @returns Signed upload URL
 */
export const generateSignedUploadUrl = async (
  storagePath: string,
  expiresIn = 300
): Promise<string> => {
  const { data, error } = await supabaseAdmin.storage
    .from(SCREENSHOTS_BUCKET)
    .createSignedUploadUrl(storagePath, {
      upsert: false,
    });
  
  if (error || !data?.signedUrl) {
    throw new Error(`Failed to generate signed URL: ${error?.message}`);
  }
  
  return data.signedUrl;
};

/**
 * Generate signed download URL for private files
 * 
 * @param storagePath - Full storage path
 * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns Signed download URL
 */
export const generateSignedDownloadUrl = async (
  storagePath: string,
  expiresIn = 3600
): Promise<string> => {
  const { data, error } = await supabaseAdmin.storage
    .from(SCREENSHOTS_BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  
  if (error || !data?.signedUrl) {
    throw new Error(`Failed to generate signed download URL: ${error?.message}`);
  }
  
  return data.signedUrl;
};

/**
 * Get public URL for a file in Supabase Storage
 * 
 * @param storagePath - Full storage path
 * @returns Public URL
 */
export const getPublicUrl = (storagePath: string): string => {
  const { data } = supabaseAdmin.storage
    .from(SCREENSHOTS_BUCKET)
    .getPublicUrl(storagePath);
  
  return data.publicUrl;
};

/**
 * Delete file from Supabase Storage
 * 
 * @param storagePath - Full storage path
 */
export const deleteFile = async (storagePath: string): Promise<void> => {
  const { error } = await supabaseAdmin.storage
    .from(SCREENSHOTS_BUCKET)
    .remove([storagePath]);
  
  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

/**
 * Generate storage path for new upload
 * Format: {userId}/{timestamp}_{nanoid}.{ext}
 * 
 * @param userId - User ID (UUID)
 * @param filename - Original filename
 * @param shortId - Short ID from nanoid
 * @returns Storage path
 */
export const generateStoragePath = (
  userId: string,
  filename: string,
  shortId: string
): string => {
  const timestamp = Date.now();
  const parts = filename.split('.');
  const ext = (parts.length > 1 ? parts.pop() : 'png')?.toLowerCase() || 'png';
  return `${userId}/${timestamp}_${shortId}.${ext}`;
};

