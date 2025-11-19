/**
 * Centralized Environment Variable Validation
 *
 * This module validates all required environment variables at startup using Zod.
 * If critical variables are missing or invalid, the application will fail fast
 * with descriptive error messages instead of failing later during API calls.
 *
 * Usage:
 * ```typescript
 * import { env } from '@/lib/config/env';
 *
 * // Type-safe access to validated environment variables
 * const apiKey = env.STRIPE_SECRET_KEY;
 * ```
 */

import { z } from 'zod/v4';

/**
 * Custom validators for specific environment variable formats
 */
const stripeSecretKeySchema = z
  .string()
  .min(1, 'STRIPE_SECRET_KEY is required')
  .refine(
    (key) => key.startsWith('sk_test_') || key.startsWith('sk_live_'),
    'STRIPE_SECRET_KEY must start with "sk_test_" or "sk_live_"'
  );

const stripePublishableKeySchema = z
  .string()
  .min(1, 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required')
  .refine(
    (key) => key.startsWith('pk_test_') || key.startsWith('pk_live_'),
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must start with "pk_test_" or "pk_live_"'
  );

const stripePriceIdSchema = (name: string) =>
  z
    .string()
    .min(1, `${name} is required`)
    .refine(
      (id) => id.startsWith('price_'),
      `${name} must be a valid Stripe Price ID (starts with "price_"). ` +
        `Current value appears to be a placeholder. Please set it in your .env file.`
    );

const stripeWebhookSecretSchema = z
  .string()
  .optional()
  .transform((val) => val || '');

const sendgridApiKeySchema = z
  .string()
  .optional()
  .transform((val) => val || '');

/**
 * Server-side environment variable schema
 *
 * Critical variables throw errors on startup.
 * Optional variables use defaults or log warnings.
 */
const serverEnvSchema = z.object({
  // Stripe API Keys (Critical)
  STRIPE_SECRET_KEY: stripeSecretKeySchema,
  STRIPE_WEBHOOK_SECRET: stripeWebhookSecretSchema,

  // Stripe Price IDs (Critical)
  STRIPE_PRICE_PRO_MONTHLY: stripePriceIdSchema('STRIPE_PRICE_PRO_MONTHLY'),
  STRIPE_PRICE_PRO_ANNUAL: stripePriceIdSchema('STRIPE_PRICE_PRO_ANNUAL'),
  STRIPE_PRICE_TEAM_MONTHLY: stripePriceIdSchema('STRIPE_PRICE_TEAM_MONTHLY'),
  STRIPE_PRICE_TEAM_ANNUAL: stripePriceIdSchema('STRIPE_PRICE_TEAM_ANNUAL'),

  // SendGrid (Optional - graceful degradation)
  SENDGRID_API_KEY: sendgridApiKeySchema,
  SENDGRID_FROM_EMAIL: z.string().default('noreply@snappd.app'),
  SENDGRID_FROM_NAME: z.string().default('Snappd'),

  // Supabase (Server-side)
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
});

/**
 * Client-side environment variable schema
 *
 * These are exposed to the browser (prefixed with NEXT_PUBLIC_)
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: stripePublishableKeySchema,
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  NEXT_PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),
});

/**
 * Combined environment schema
 */
const envSchema = serverEnvSchema.merge(clientEnvSchema);

/**
 * Parse and validate environment variables
 *
 * This function is called at module load time to ensure the application
 * fails fast if required environment variables are missing or invalid.
 */
function validateEnv() {
  const result = envSchema.safeParse({
    // Server-side variables
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY,
    STRIPE_PRICE_PRO_ANNUAL: process.env.STRIPE_PRICE_PRO_ANNUAL,
    STRIPE_PRICE_TEAM_MONTHLY: process.env.STRIPE_PRICE_TEAM_MONTHLY,
    STRIPE_PRICE_TEAM_ANNUAL: process.env.STRIPE_PRICE_TEAM_ANNUAL,
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
    SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL,
    SENDGRID_FROM_NAME: process.env.SENDGRID_FROM_NAME,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

    // Client-side variables
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  });

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => {
        const path = issue.path.join('.');
        return `  - ${path}: ${issue.message}`;
      })
      .join('\n');

    throw new Error(
      `\n\nEnvironment variable validation failed:\n\n${errors}\n\n` +
        `Please check your .env.local file and ensure all required variables are set correctly.\n` +
        `Refer to .env.example for the expected format and documentation.\n`
    );
  }

  // Log warnings for optional but recommended variables
  if (!result.data.STRIPE_WEBHOOK_SECRET) {
    console.warn(
      '[env] WARNING: STRIPE_WEBHOOK_SECRET is not set. Webhook signature verification will fail.'
    );
  }

  if (!result.data.SENDGRID_API_KEY) {
    console.warn(
      '[env] WARNING: SENDGRID_API_KEY is not set. Email sending will fail.'
    );
  }

  return result.data;
}

/**
 * Validated environment variables
 *
 * This object contains all validated environment variables with proper types.
 * The validation runs at module load time, ensuring the app fails fast on startup
 * if required variables are missing or invalid.
 *
 * @example
 * ```typescript
 * import { env } from '@/lib/config/env';
 *
 * // Type-safe access
 * const stripe = new Stripe(env.STRIPE_SECRET_KEY);
 * const priceId = env.STRIPE_PRICE_PRO_MONTHLY;
 * ```
 */
export const env = validateEnv();

/**
 * Type definition for the validated environment
 */
export type Env = typeof env;

/**
 * Stripe Price IDs configuration
 *
 * Pre-configured object for easy access to validated price IDs.
 */
export const STRIPE_PRICE_IDS = {
  pro: {
    monthly: env.STRIPE_PRICE_PRO_MONTHLY,
    annual: env.STRIPE_PRICE_PRO_ANNUAL,
  },
  team: {
    monthly: env.STRIPE_PRICE_TEAM_MONTHLY,
    annual: env.STRIPE_PRICE_TEAM_ANNUAL,
  },
} as const;

/**
 * SendGrid configuration
 *
 * Pre-configured object for easy access to validated SendGrid settings.
 */
export const SENDGRID_CONFIG = {
  apiKey: env.SENDGRID_API_KEY,
  from: {
    email: env.SENDGRID_FROM_EMAIL,
    name: env.SENDGRID_FROM_NAME,
  },
} as const;
