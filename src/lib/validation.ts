/**
 * Zod validation schemas for API request/response validation
 * Provides type-safe input validation with detailed error messages
 */

import { z } from 'zod';
import { ValidationError } from './errors';

/**
 * Allowed image MIME types
 */
export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
] as const;

/**
 * Max file size: 10MB in bytes
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Max filename length
 */
export const MAX_FILENAME_LENGTH = 255;

/**
 * Schema for signed URL request
 */
export const signedUrlSchema = z.object({
  filename: z.string().min(1).max(MAX_FILENAME_LENGTH),
  mime_type: z.enum(ALLOWED_MIME_TYPES),
  file_size: z.number().int().positive().max(MAX_FILE_SIZE),
});

export type SignedUrlRequest = z.infer<typeof signedUrlSchema>;

/**
 * Schema for screenshot upload (metadata creation)
 */
export const uploadScreenshotSchema = z.object({
  filename: z.string().min(1).max(MAX_FILENAME_LENGTH),
  mime_type: z.enum(ALLOWED_MIME_TYPES),
  file_size: z.number().int().positive().max(MAX_FILE_SIZE),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  storage_path: z.string().min(1),
  // Optional fields for testing purposes
  short_id: z.string().optional(),
  expires_at: z.string().optional(),
}).passthrough(); // Allow extra fields for flexibility

export type UploadScreenshotRequest = z.infer<typeof uploadScreenshotSchema>;

/**
 * Schema for user signup
 */
export const signupSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(128),
  full_name: z.string().min(1).max(255).optional(),
});

export type SignupRequest = z.infer<typeof signupSchema>;

/**
 * Schema for checkout session request
 */
export const checkoutSessionSchema = z.object({
  plan: z.enum(['pro', 'team'], {
    errorMap: () => ({ message: 'Plan must be either "pro" or "team"' }),
  }),
});

export type CheckoutSessionRequest = z.infer<typeof checkoutSessionSchema>;

/**
 * Schema for profile update
 */
export const updateProfileSchema = z.object({
  full_name: z.string().trim().min(1).max(255).optional(),
  email: z.string().trim().email().optional(),
  // Allow plan field but ignore it (will be filtered in route handler)
  plan: z.any().optional(),
}).passthrough(); // Allow extra fields but ignore them

export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;

/**
 * Schema for screenshot metadata update
 */
export const updateScreenshotSchema = z.object({
  original_filename: z.string().min(1).max(MAX_FILENAME_LENGTH).optional(),
  is_public: z.boolean().optional(),
}).passthrough(); // Allow extra fields but ignore immutable ones

export type UpdateScreenshotRequest = z.infer<typeof updateScreenshotSchema>;

/**
 * Schema for screenshot list query params
 */
export const listScreenshotsSchema = z.object({
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
  search: z.string().optional(),
  // Accept date strings in YYYY-MM-DD or ISO datetime format
  from_date: z.string().min(10).optional(), // Allow both date and datetime
  to_date: z.string().min(10).optional(),
});

export type ListScreenshotsQuery = z.infer<typeof listScreenshotsSchema>;

/**
 * Schema for usage history query params
 */
export const usageHistorySchema = z.object({
  months: z.number().int().positive().max(12).default(6),
});

export type UsageHistoryQuery = z.infer<typeof usageHistorySchema>;

/**
 * Validate and parse request body with Zod schema
 * 
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Parsed and validated data
 * @throws ValidationError if validation fails
 * 
 * @example
 * const body = await request.json();
 * const validated = validateRequest(signupSchema, body);
 */
export const validateRequest = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const errors = result.error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    
    throw new ValidationError('Validation failed', { validation_errors: errors });
  }
  
  return result.data;
};

