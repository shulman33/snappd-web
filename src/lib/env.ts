/**
 * Environment variable validation
 * Validates all required environment variables on startup
 */

type EnvVar = {
  key: string;
  required: boolean;
  description: string;
};

const ENV_VARS: EnvVar[] = [
  // Supabase
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    description: 'Supabase project URL',
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    description: 'Supabase anonymous/public key',
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    description: 'Supabase service role key (secret)',
  },

  // Stripe
  {
    key: 'STRIPE_SECRET_KEY',
    required: true,
    description: 'Stripe secret key',
  },
  {
    key: 'STRIPE_WEBHOOK_SECRET',
    required: true,
    description: 'Stripe webhook signing secret',
  },
  {
    key: 'STRIPE_PRICE_ID',
    required: true,
    description: 'Stripe Pro plan price ID',
  },
  {
    key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    required: false,
    description: 'Stripe publishable key (for client-side)',
  },

  // Vercel KV (optional in development)
  {
    key: 'KV_REST_API_URL',
    required: false,
    description: 'Vercel KV REST API URL',
  },
  {
    key: 'KV_REST_API_TOKEN',
    required: false,
    description: 'Vercel KV REST API token',
  },

  // App configuration
  {
    key: 'NEXT_PUBLIC_APP_URL',
    required: true,
    description: 'Public application URL',
  },
];

/**
 * Validate environment variables on startup
 * Throws error if required variables are missing
 */
export const validateEnv = (): void => {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.key];

    if (!value) {
      if (envVar.required) {
        missing.push(`${envVar.key} - ${envVar.description}`);
      } else {
        warnings.push(`${envVar.key} - ${envVar.description}`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map((m) => `  - ${m}`).join('\n')}\n\nCheck .env.example for reference.`
    );
  }

  if (warnings.length > 0 && process.env.NODE_ENV !== 'development') {
    console.warn(
      `Optional environment variables not set:\n${warnings.map((w) => `  - ${w}`).join('\n')}`
    );
  }
};

// Run validation on module import (startup)
if (process.env.NODE_ENV !== 'test') {
  try {
    validateEnv();
    console.log('✓ Environment variables validated successfully');
  } catch (error) {
    console.error('✗ Environment validation failed:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

