/**
 * Upload types for screenshot upload and sharing system
 */

// Request/Response types for upload initialization
export interface InitUploadRequest {
  filename: string
  fileSize: number
  mimeType: string
  sharingMode?: 'public' | 'private' | 'password'
  password?: string
  expiresIn?: number // Expiration in seconds (optional)
}

export interface InitUploadResponse {
  uploadSessionId: string
  signedUrl: string
  signedUrlExpiresAt: string
  filePath: string
}

// Request/Response types for upload completion
export interface CompleteUploadRequest {
  fileHash: string
  width: number
  height: number
}

export interface CompleteUploadResponse {
  screenshotId: string
  shortId: string
  shareUrl: string
  thumbnailUrl?: string
  optimizedUrl?: string
}

// Upload session status
export type UploadStatus = 'pending' | 'uploading' | 'processing' | 'completed' | 'failed'

// Sharing modes
export type SharingMode = 'public' | 'private' | 'password'

// Processing status
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed'

// MIME types
export type SupportedMimeType =
  | 'image/png'
  | 'image/jpeg'
  | 'image/jpg'
  | 'image/webp'
  | 'image/gif'

// Upload progress event
export interface UploadProgressEvent {
  uploadSessionId: string
  bytesUploaded: number
  totalBytes: number
  percentage: number
  status: UploadStatus
}

// File metadata
export interface FileMetadata {
  filename: string
  fileSize: number
  mimeType: SupportedMimeType
  width: number
  height: number
  fileHash: string
}

// Storage paths
export interface StoragePaths {
  original: string
  thumbnail?: string
  optimized?: string
}
