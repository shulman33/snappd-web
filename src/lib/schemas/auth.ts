/**
 * Zod Validation Schemas for Authentication API
 *
 * This file contains all Zod schemas for request/response validation.
 * These schemas should be implemented in src/lib/schemas/auth.ts
 *
 * @module auth-schemas
 */

import { z } from 'zod';

// ============================================================================
// Password Validation
// ============================================================================

/**
 * Password validation regex
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[@$!%*?&]/, 'Password must contain at least one special character');

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * POST /api/auth/signup
 */
export const signupSchema = z.object({
  email: z.string()
    .email({ message: 'Invalid email address' })
    .max(255, 'Email must not exceed 255 characters')
    .transform(email => email.toLowerCase().trim()),

  password: passwordSchema,

  fullName: z.string()
    .min(1, 'Full name cannot be empty')
    .max(255, 'Full name must not exceed 255 characters')
    .trim()
    .optional(),
});

export type SignupInput = z.infer<typeof signupSchema>;

/**
 * POST /api/auth/signin
 */
export const signinSchema = z.object({
  email: z.string()
    .email({ message: 'Invalid email address' })
    .transform(email => email.toLowerCase().trim()),

  password: z.string()
    .min(1, 'Password is required'),
});

export type SigninInput = z.infer<typeof signinSchema>;

/**
 * POST /api/auth/reset-password
 */
export const resetPasswordRequestSchema = z.object({
  email: z.string()
    .email({ message: 'Invalid email address' })
    .transform(email => email.toLowerCase().trim()),
});

export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>;

/**
 * POST /api/auth/reset-password/confirm
 * (Future endpoint for confirming password reset with new password)
 */
export const resetPasswordConfirmSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),

  password: passwordSchema,

  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type ResetPasswordConfirmInput = z.infer<typeof resetPasswordConfirmSchema>;

/**
 * POST /api/auth/verify-email
 */
export const verifyEmailSchema = z.object({
  token: z.string()
    .min(1, 'Verification token is required'),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

/**
 * POST /api/auth/magic-link
 * (Future endpoint for magic link authentication)
 */
export const magicLinkRequestSchema = z.object({
  email: z.string()
    .email({ message: 'Invalid email address' })
    .transform(email => email.toLowerCase().trim()),
});

export type MagicLinkRequestInput = z.infer<typeof magicLinkRequestSchema>;

/**
 * PATCH /api/auth/update-profile
 */
export const updateProfileSchema = z.object({
  fullName: z.string()
    .min(1, 'Full name cannot be empty')
    .max(255, 'Full name must not exceed 255 characters')
    .trim()
    .optional(),

  email: z.string()
    .email({ message: 'Invalid email address' })
    .max(255, 'Email must not exceed 255 characters')
    .transform(email => email.toLowerCase().trim())
    .optional(),
}).refine((data) => data.fullName !== undefined || data.email !== undefined, {
  message: 'At least one field must be provided',
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * DELETE /api/auth/delete-account
 * (Future endpoint for account deletion)
 */
export const deleteAccountSchema = z.object({
  password: z.string()
    .min(1, 'Password is required for account deletion'),

  confirmation: z.literal('DELETE MY ACCOUNT', {
    message: 'You must type "DELETE MY ACCOUNT" to confirm',
  }),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

// ============================================================================
// Response Schemas (for type safety, not validation)
// ============================================================================

/**
 * User object returned in responses
 */
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  fullName: z.string().nullable(),
  plan: z.enum(['free', 'pro', 'team']),
  createdAt: z.string().datetime(),
});

export type User = z.infer<typeof userSchema>;

/**
 * Session object returned in signin response
 */
export const sessionSchema = z.object({
  expiresAt: z.string().datetime(),
});

export type Session = z.infer<typeof sessionSchema>;

/**
 * POST /api/auth/signup response
 */
export const signupResponseSchema = z.object({
  user: userSchema,
  message: z.string(),
});

export type SignupResponse = z.infer<typeof signupResponseSchema>;

/**
 * POST /api/auth/signin response
 */
export const signinResponseSchema = z.object({
  user: userSchema,
  session: sessionSchema,
});

export type SigninResponse = z.infer<typeof signinResponseSchema>;

/**
 * GET /api/auth/user response
 */
export const userResponseSchema = z.object({
  user: userSchema,
});

export type UserResponse = z.infer<typeof userResponseSchema>;

// ============================================================================
// Error Schemas
// ============================================================================

/**
 * Validation error detail
 */
export const validationErrorDetailSchema = z.object({
  field: z.string(),
  message: z.string(),
});

export type ValidationErrorDetail = z.infer<typeof validationErrorDetailSchema>;

/**
 * Generic error response
 */
export const errorSchema = z.object({
  error: z.enum([
    'INVALID_CREDENTIALS',
    'EMAIL_EXISTS',
    'EMAIL_NOT_VERIFIED',
    'INVALID_TOKEN',
    'ACCOUNT_LOCKED',
    'IP_BLOCKED',
    'VALIDATION_ERROR',
    'INTERNAL_ERROR',
    'RATE_LIMIT_EXCEEDED',
  ]),
  message: z.string(),
  details: z.array(validationErrorDetailSchema).optional(),
});

export type ErrorResponse = z.infer<typeof errorSchema>;

/**
 * Rate limit error response
 */
export const rateLimitErrorSchema = z.object({
  error: z.enum(['ACCOUNT_LOCKED', 'IP_BLOCKED', 'RATE_LIMIT_EXCEEDED']),
  message: z.string(),
  retryAfter: z.number().int().positive(),
});

export type RateLimitError = z.infer<typeof rateLimitErrorSchema>;

// ============================================================================
// OAuth Schemas
// ============================================================================

/**
 * OAuth callback query parameters
 */
export const oauthCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export type OAuthCallbackParams = z.infer<typeof oauthCallbackSchema>;

/**
 * OAuth provider type
 */
export const oauthProviderSchema = z.enum(['google', 'github']);

export type OAuthProvider = z.infer<typeof oauthProviderSchema>;

// ============================================================================
// Database Entity Schemas (for ORM/query results)
// ============================================================================

/**
 * auth.users table row
 * (Managed by Supabase, read-only from application code)
 */
export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  encrypted_password: z.string().nullable(),
  email_confirmed_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  last_sign_in_at: z.string().datetime().nullable(),
  raw_user_meta_data: z.record(z.string(), z.unknown()),
});

export type AuthUser = z.infer<typeof authUserSchema>;

/**
 * profiles table row
 */
export const profileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string().nullable(),
  plan: z.enum(['free', 'pro', 'team']),
  stripe_customer_id: z.string().nullable(),
  stripe_subscription_id: z.string().nullable(),
  downgraded_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Profile = z.infer<typeof profileSchema>;

/**
 * auth_events table row
 */
export const authEventSchema = z.object({
  id: z.string().uuid(),
  event_type: z.enum([
    'login_success',
    'login_failure',
    'signup_success',
    'signup_failure',
    'password_reset',
    'password_changed',
    'email_verified',
    'magic_link_sent',
    'magic_link_used',
    'account_locked',
    'ip_blocked',
    'oauth_linked',
    'oauth_unlinked',
    'account_deleted',
    'profile_updated',
  ]),
  user_id: z.string().uuid().nullable(),
  email: z.string().nullable(),
  ip_address: z.string(),
  user_agent: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string().datetime(),
});

export type AuthEvent = z.infer<typeof authEventSchema>;

/**
 * auth.identities table row (OAuth provider links)
 */
export const identitySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  provider: oauthProviderSchema,
  provider_id: z.string(),
  identity_data: z.object({
    email: z.string().email().optional(),
    name: z.string().optional(),
    avatar_url: z.string().url().optional(),
  }),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Identity = z.infer<typeof identitySchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Formats Zod errors into API-friendly validation error details
 */
export function formatZodError(error: z.ZodError<any>): ValidationErrorDetail[] {
  return error.issues.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));
}

/**
 * Safely parses input with Zod schema, returns parsed data or null
 */
export function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: ValidationErrorDetail[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: formatZodError(result.error) };
}

// ============================================================================
// Environment Variable Schemas
// ============================================================================

/**
 * Required environment variables for auth system
 */
export const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),

  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),

  NEXT_PUBLIC_APP_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment variables at runtime
 * Should be called in src/lib/env.ts on application startup
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(formatZodError(result.error));
    throw new Error('Invalid environment configuration');
  }

  return result.data;
}

// ============================================================================
// Export All
// ============================================================================

export const schemas = {
  // Request schemas
  signup: signupSchema,
  signin: signinSchema,
  resetPasswordRequest: resetPasswordRequestSchema,
  resetPasswordConfirm: resetPasswordConfirmSchema,
  verifyEmail: verifyEmailSchema,
  magicLinkRequest: magicLinkRequestSchema,
  updateProfile: updateProfileSchema,
  deleteAccount: deleteAccountSchema,

  // Response schemas
  signupResponse: signupResponseSchema,
  signinResponse: signinResponseSchema,
  userResponse: userResponseSchema,
  user: userSchema,
  session: sessionSchema,

  // Error schemas
  error: errorSchema,
  rateLimitError: rateLimitErrorSchema,
  validationErrorDetail: validationErrorDetailSchema,

  // OAuth schemas
  oauthCallback: oauthCallbackSchema,
  oauthProvider: oauthProviderSchema,

  // Database schemas
  authUser: authUserSchema,
  profile: profileSchema,
  authEvent: authEventSchema,
  identity: identitySchema,

  // Environment schema
  env: envSchema,
};

export default schemas;
