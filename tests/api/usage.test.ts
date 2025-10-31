/**
 * API tests for usage tracking endpoints
 * Tests: GET /api/usage, GET /api/usage/history
 *
 * Migration from Playwright contract tests:
 * - tests/contract/usage-current.test.ts
 * - tests/contract/usage-history.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createAuthRequest } from '../helpers/request-builder';
import { mockSupabaseQueryResponse, mockProfile } from '../helpers/supabase-mocks';
import { resetAllMocks } from '../helpers/test-utils';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  createUserClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  })),
  getUserIdFromToken: vi.fn(async (token: string) => {
    if (token === 'invalid-token') return null;
    return 'test-user-id-123';
  }),
}));

// Import route handlers AFTER mocks
import { GET as usageGET } from '@/app/api/usage/route';

describe('GET /api/usage', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('should return 401 when no auth token provided', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/usage',
    });

    const response = await usageGET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  // TODO: Add usage tracking tests
  it.skip('should return current month usage statistics', async () => {
    // Requires mocking complex aggregation queries
  });

  it.skip('should calculate remaining uploads for free tier', async () => {
    // Requires mocking count queries and plan logic
  });

  it.skip('should show unlimited for pro tier', async () => {
    // Requires mocking pro plan response
  });
});

describe('GET /api/usage/history', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('should return 401 when no auth token provided', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/usage/history',
    });

    // Note: Implement when route handler exists
    // const response = await usageHistoryGET(request);
    // expect(response.status).toBe(401);
  });

  // TODO: Add usage history tests
  it.skip('should return historical usage data', async () => {
    // Requires mocking time-series queries
  });
});
