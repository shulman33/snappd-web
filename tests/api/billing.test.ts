/**
 * API tests for billing endpoints
 * Tests: POST /api/billing/checkout, GET /api/billing/portal, POST /api/billing/webhook
 *
 * Migration from Playwright contract tests:
 * - tests/contract/billing-checkout.test.ts
 * - tests/contract/billing-webhook.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createAuthRequest } from '../helpers/request-builder';
import { mockSupabaseQueryResponse, mockProfile } from '../helpers/supabase-mocks';
import { resetAllMocks } from '../helpers/test-utils';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
  createUserClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  })),
  getUserIdFromToken: vi.fn(async (token: string) => {
    if (token === 'invalid-token') return null;
    return 'test-user-id-123';
  }),
}));

// Mock Stripe
vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn(async () => ({
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/test',
        })),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn(async () => ({
          url: 'https://billing.stripe.com/session/test',
        })),
      },
    },
  },
  constructWebhookEvent: vi.fn(),
}));

// Import route handlers AFTER mocks
import { POST as checkoutPOST } from '@/app/api/billing/checkout/route';
import { GET as portalGET } from '@/app/api/billing/portal/route';

describe('POST /api/billing/checkout', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('should return 401 when no auth token provided', async () => {
    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/billing/checkout',
      body: { plan: 'pro' },
    });

    const response = await checkoutPOST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  // TODO: Add checkout tests
  it.skip('should create Stripe checkout session for pro plan', async () => {
    // Requires mocking Stripe checkout session creation
  });

  it.skip('should reject invalid plan type', async () => {
    // Requires validation logic testing
  });
});

describe('GET /api/billing/portal', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('should return 401 when no auth token provided', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/billing/portal',
    });

    const response = await portalGET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  // TODO: Add billing portal tests
  it.skip('should create billing portal session', async () => {
    // Requires mocking Stripe billing portal
  });
});

describe('POST /api/billing/webhook', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  // TODO: Add webhook tests
  it.skip('should validate webhook signature', async () => {
    // Requires mocking Stripe webhook signature validation
  });

  it.skip('should handle subscription.created event', async () => {
    // Requires mocking webhook event processing
  });

  it.skip('should handle subscription.deleted event', async () => {
    // Requires mocking downgrade logic
  });

  it.skip('should implement idempotency', async () => {
    // Requires mocking event deduplication
  });
});
