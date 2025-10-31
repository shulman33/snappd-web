/**
 * Vitest setup file for unit and API tests
 * This file runs before all tests
 *
 * For API tests, import helpers from tests/helpers/:
 * - supabase-mocks.ts - Mock Supabase clients and responses
 * - request-builder.ts - Create NextRequest objects for testing routes
 * - fixtures.ts - Shared test data (users, screenshots, usage)
 * - test-utils.ts - Utility functions for testing
 */

// Setup environment variables for testing
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_123';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_123';
process.env.STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || 'price_test_123';
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
process.env.UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || 'http://localhost:8079';
process.env.UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'test-token';

console.log('Vitest test environment initialized');

