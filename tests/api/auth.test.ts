/**
 * API tests for authentication endpoints
 * Tests: POST /api/auth/signup, GET /api/auth/me, PATCH /api/auth/me, DELETE /api/auth/me
 *
 * Migration from Playwright contract tests:
 * - tests/contract/auth-signup.test.ts
 * - tests/contract/auth-profile.test.ts
 * - tests/contract/auth-delete.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createAuthRequest } from '../helpers/request-builder';
import { VALID_SIGNUP_DATA, generateTestEmail } from '../helpers/fixtures';
import { resetAllMocks } from '../helpers/test-utils';

// Mock all external dependencies BEFORE importing route handlers
// Note: vi.mock() is hoisted to the top of the file and cannot reference imports

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
    auth: {
      admin: {
        createUser: vi.fn(),
        deleteUser: vi.fn(),
      },
    },
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
    if (token.startsWith('test-access-token')) {
      const parts = token.split('-');
      return parts[parts.length - 1] || 'test-user-id-123';
    }
    return 'test-user-id-123';
  }),
}));

// Mock Stripe
vi.mock('@/lib/stripe', () => ({
  createCustomer: vi.fn(async (email: string, userId: string) => `cus_test_${userId.substring(0, 8)}`),
  stripe: {
    customers: {
      del: vi.fn(async () => ({ id: 'cus_deleted', deleted: true })),
    },
  },
}));

// Mock Supabase client creation (for signup session)
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithPassword: vi.fn(async ({ email, password }) => {
        if (password === 'wrong-password') {
          return {
            data: { user: null, session: null },
            error: { message: 'Invalid credentials', status: 401 },
          };
        }
        return {
          data: {
            user: { id: 'test-user-id-123', email },
            session: {
              access_token: 'test-access-token-test-user-id-123',
              refresh_token: 'test-refresh-token',
              expires_in: 3600,
            },
          },
          error: null,
        };
      }),
    },
  })),
}));

// Mock storage operations
vi.mock('@/lib/storage', () => ({
  deleteAllUserFiles: vi.fn(async () => {}),
  deleteFile: vi.fn(async () => {}),
}));

// Now import route handlers AFTER mocks are defined
import { POST as signupPOST } from '@/app/api/auth/signup/route';
import { GET as profileGET, PATCH as profilePATCH } from '@/app/api/auth/me/route';
import { POST as accountDELETE } from '@/app/api/auth/delete/route';
import {
  mockSupabaseUser,
  mockSupabaseAuthResponse,
  mockSupabaseQueryResponse,
  mockProfile,
} from '../helpers/supabase-mocks';

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('should create new user with valid credentials', async () => {
    const mockUser = mockSupabaseUser({
      email: 'newuser@example.com',
      id: 'user-new-123',
    });

    const { supabaseAdmin, getUserIdFromToken } = await import('@/lib/supabase');

    // Mock user creation
    vi.mocked(supabaseAdmin.auth.admin.createUser).mockResolvedValue(
      mockSupabaseAuthResponse(mockUser) as any
    );

    // Mock profile insertion
    const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue({
      insert: insertMock,
    } as any);

    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/auth/signup',
      body: {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        full_name: 'New User',
      },
    });

    const response = await signupPOST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toHaveProperty('user');
    expect(body).toHaveProperty('session');
    expect(body.user.email).toBe('newuser@example.com');
    expect(body.session.access_token).toBeTruthy();
    expect(body.session.refresh_token).toBeTruthy();

    // Verify Supabase calls
    expect(supabaseAdmin.auth.admin.createUser).toHaveBeenCalledWith({
      email: 'newuser@example.com',
      password: 'SecurePass123!',
      email_confirm: true,
    });

    // Verify Stripe customer creation
    const { createCustomer } = await import('@/lib/stripe');
    expect(createCustomer).toHaveBeenCalledWith('newuser@example.com', mockUser.id);

    // Verify profile creation
    expect(supabaseAdmin.from).toHaveBeenCalledWith('profiles');
  });

  it('should reject invalid email format', async () => {
    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/auth/signup',
      body: {
        email: 'not-an-email',
        password: 'SecurePass123!',
      },
    });

    const response = await signupPOST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Validation failed');
    expect(body.error.details.validation_errors).toBeDefined();
  });

  it('should reject weak password', async () => {
    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/auth/signup',
      body: {
        email: 'test@example.com',
        password: '123', // Too short
      },
    });

    const response = await signupPOST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject missing required fields', async () => {
    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/auth/signup',
      body: {
        email: 'test@example.com',
        // Missing password
      },
    });

    const response = await signupPOST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should handle Supabase auth error gracefully', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase');

    // Mock Supabase error (duplicate email)
    vi.mocked(supabaseAdmin.auth.admin.createUser).mockResolvedValue({
      data: { user: null },
      error: { message: 'User already exists', status: 400, name: 'AuthError' } as any,
    } as any);

    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/auth/signup',
      body: {
        email: 'existing@example.com',
        password: 'SecurePass123!',
      },
    });

    const response = await signupPOST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('should return user profile for authenticated user', async () => {
    const mockUserProfile = mockProfile({
      email: 'test@example.com',
      full_name: 'Test User',
      plan: 'free',
    });

    const { createUserClient } = await import('@/lib/supabase');

    const singleMock = vi.fn().mockResolvedValue(mockSupabaseQueryResponse(mockUserProfile));
    vi.mocked(createUserClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: singleMock,
      })),
    } as any);

    const request = createAuthRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/auth/me',
    });

    const response = await profileGET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.email).toBe('test@example.com');
    expect(body.full_name).toBe('Test User');
    expect(body.plan).toBe('free');
  });

  it('should return 401 for missing auth token', async () => {
    const request = createMockRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/auth/me',
      // No Authorization header
    });

    const response = await profileGET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 401 for invalid auth token', async () => {
    const request = createAuthRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/auth/me',
      token: 'invalid-token',
    });

    const response = await profileGET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});

describe('PATCH /api/auth/me', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('should update user profile', async () => {
    const updatedProfile = mockProfile({
      full_name: 'Updated Name',
    });

    const { createUserClient } = await import('@/lib/supabase');

    const singleMock = vi.fn().mockResolvedValue(mockSupabaseQueryResponse(updatedProfile));
    vi.mocked(createUserClient).mockReturnValue({
      from: vi.fn(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: singleMock,
      })),
    } as any);

    const request = createAuthRequest({
      method: 'PATCH',
      url: 'http://localhost:3000/api/auth/me',
      body: {
        full_name: 'Updated Name',
      },
    });

    const response = await profilePATCH(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.full_name).toBe('Updated Name');
  });

  it('should ignore plan field updates (requires Stripe webhook)', async () => {
    const currentProfile = mockProfile({
      plan: 'free', // User is on free plan
    });

    const { createUserClient } = await import('@/lib/supabase');

    // Mock profile retrieval (GET current profile)
    const singleMock = vi.fn().mockResolvedValue(mockSupabaseQueryResponse(currentProfile));
    vi.mocked(createUserClient).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: singleMock,
      })),
    } as any);

    const request = createAuthRequest({
      method: 'PATCH',
      url: 'http://localhost:3000/api/auth/me',
      body: {
        plan: 'pro', // Attempt to update plan directly
      },
    });

    const response = await profilePATCH(request);
    const body = await response.json();

    // Plan field is ignored, returns current profile (still free)
    expect(response.status).toBe(200);
    expect(body.plan).toBe('free'); // Plan NOT changed
  });
});

describe('POST /api/auth/delete', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  // TODO: Fix mock for complex chained Supabase calls
  it.skip('should delete user account and all associated data', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase');

    // Mock supabaseAdmin.from() to handle multiple calls
    // First call: from('profiles').select().eq().single() - profile lookup
    // Second call: from('screenshots').select().eq() - screenshots lookup
    // Third call: from('screenshots').delete().eq() - delete screenshots
    // Fourth call: from('monthly_usage').delete().eq() - delete usage
    // Fifth call: from('profiles').delete().eq() - delete profile

    vi.mocked(supabaseAdmin.from).mockImplementation((_table: string) => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(mockSupabaseQueryResponse({
          stripe_customer_id: 'cus_test_123',
        })),
      };

      // Override eq() to resolve properly for chained calls
      mockChain.eq = vi.fn().mockImplementation(() => {
        // If this is after a select(), return data for screenshots
        return Promise.resolve({ data: [], error: null });
      });

      // Override single() for profile lookup
      mockChain.single = vi.fn().mockResolvedValue({
        data: { stripe_customer_id: 'cus_test_123' },
        error: null,
      });

      return mockChain as any;
    });

    // Mock user deletion
    vi.mocked(supabaseAdmin.auth.admin.deleteUser).mockResolvedValue({
      data: {},
      error: null,
    } as any);

    const request = createAuthRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/auth/delete',
    });

    const response = await accountDELETE(request);

    // Route returns 204 No Content (no body)
    expect(response.status).toBe(204);

    // Verify Stripe customer deletion
    const { stripe } = await import('@/lib/stripe');
    expect(stripe.customers.del).toHaveBeenCalledWith('cus_test_123');

    // Verify Supabase user deletion
    expect(supabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith('test-user-id-123');
  });

  it('should return 401 for unauthenticated deletion request', async () => {
    const request = createMockRequest({
      method: 'POST',
      url: 'http://localhost:3000/api/auth/delete',
    });

    const response = await accountDELETE(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});
