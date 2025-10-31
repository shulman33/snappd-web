import { vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

/**
 * Mock Supabase user object
 */
export function mockSupabaseUser(overrides?: Partial<User>): User {
  return {
    id: 'test-user-id-123',
    aud: 'authenticated',
    email: 'test@example.com',
    email_confirmed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    ...overrides,
  } as User;
}

/**
 * Mock Supabase auth response (signup/login)
 */
export function mockSupabaseAuthResponse(user?: User) {
  const mockUser = user || mockSupabaseUser();
  return {
    data: {
      user: mockUser,
      session: {
        access_token: 'test-access-token-' + mockUser.id,
        refresh_token: 'test-refresh-token-' + mockUser.id,
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: mockUser,
      },
    },
    error: null,
  };
}

/**
 * Mock Supabase query response (select, insert, update, delete)
 */
export function mockSupabaseQueryResponse<T>(data: T | T[], options?: { single?: boolean; count?: number }) {
  const isArray = Array.isArray(data);

  return {
    data: options?.single ? (isArray ? data[0] : data) : data,
    error: null,
    count: options?.count ?? (isArray ? data.length : 1),
    status: 200,
    statusText: 'OK',
  };
}

/**
 * Mock Supabase error response
 */
export function mockSupabaseError(message: string, code = 'PGRST116', details?: string) {
  return {
    data: null,
    error: {
      message,
      code,
      details: details || null,
      hint: null,
    },
    count: null,
    status: 400,
    statusText: 'Bad Request',
  };
}

/**
 * Create a mock Supabase client with chainable query methods
 */
export function createMockSupabaseClient() {
  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(mockSupabaseQueryResponse(null)),
    maybeSingle: vi.fn().mockResolvedValue(mockSupabaseQueryResponse(null)),
  };

  return {
    from: vi.fn(() => queryBuilder),
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue(mockSupabaseAuthResponse()),
        deleteUser: vi.fn().mockResolvedValue({ data: null, error: null }),
        getUserById: vi.fn().mockResolvedValue(mockSupabaseAuthResponse()),
        listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
      },
      getUser: vi.fn().mockResolvedValue(mockSupabaseAuthResponse()),
      signInWithPassword: vi.fn().mockResolvedValue(mockSupabaseAuthResponse()),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    storage: {
      from: vi.fn((bucket: string) => ({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: {
            signedUrl: `https://test-storage.supabase.co/${bucket}/signed-url`,
            path: 'test-path',
          },
          error: null,
        }),
        getPublicUrl: vi.fn((path: string) => ({
          data: {
            publicUrl: `https://test-storage.supabase.co/${bucket}/${path}`,
          },
        })),
        upload: vi.fn().mockResolvedValue({
          data: { path: 'test-path' },
          error: null,
        }),
        remove: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      })),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
}

/**
 * Mock profile record
 */
export function mockProfile(overrides?: Partial<{
  id: string;
  email: string;
  full_name: string | null;
  plan: 'free' | 'pro' | 'team';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  downgraded_at: string | null;
  created_at: string;
  updated_at: string;
}>) {
  return {
    id: 'test-user-id-123',
    email: 'test@example.com',
    full_name: 'Test User',
    plan: 'free' as const,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    downgraded_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Mock screenshot record
 */
export function mockScreenshot(overrides?: Partial<{
  id: string;
  user_id: string;
  short_id: string;
  original_filename: string;
  storage_path: string;
  file_size: number;
  mime_type: string;
  width: number | null;
  height: number | null;
  views: number;
  is_public: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}>) {
  return {
    id: 'screenshot-123',
    user_id: 'test-user-id-123',
    short_id: 'abc123',
    original_filename: 'test.png',
    storage_path: 'user-123/1234567890_abc123.png',
    file_size: 1024,
    mime_type: 'image/png',
    width: 1920,
    height: 1080,
    views: 0,
    is_public: true,
    expires_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Mock monthly usage record
 */
export function mockMonthlyUsage(overrides?: Partial<{
  id: string;
  user_id: string;
  month: string;
  screenshot_count: number;
  storage_bytes: number;
  bandwidth_bytes: number;
  created_at: string;
  updated_at: string;
}>) {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return {
    id: 'usage-123',
    user_id: 'test-user-id-123',
    month,
    screenshot_count: 5,
    storage_bytes: 5120,
    bandwidth_bytes: 10240,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}
