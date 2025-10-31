/**
 * Test data fixtures for consistent test data across API tests
 */

/**
 * Default test user profile
 */
export const TEST_USER = {
  id: 'test-user-id-123',
  email: 'test@example.com',
  full_name: 'Test User',
  plan: 'free' as const,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  downgraded_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

/**
 * Pro plan test user
 */
export const TEST_PRO_USER = {
  ...TEST_USER,
  id: 'test-pro-user-id-456',
  email: 'pro@example.com',
  plan: 'pro' as const,
  stripe_customer_id: 'cus_test_pro_123',
  stripe_subscription_id: 'sub_test_pro_456',
};

/**
 * Default test screenshot
 */
export const TEST_SCREENSHOT = {
  id: 'screenshot-123',
  user_id: TEST_USER.id,
  short_id: 'abc123',
  original_filename: 'test.png',
  storage_path: 'test-user-id-123/1234567890_abc123.png',
  file_size: 1024,
  mime_type: 'image/png',
  width: 1920,
  height: 1080,
  views: 0,
  is_public: true,
  expires_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

/**
 * Expired screenshot (free tier)
 */
export const TEST_EXPIRED_SCREENSHOT = {
  ...TEST_SCREENSHOT,
  id: 'screenshot-expired-789',
  short_id: 'exp789',
  expires_at: '2023-12-01T00:00:00Z', // Expired
};

/**
 * Private screenshot
 */
export const TEST_PRIVATE_SCREENSHOT = {
  ...TEST_SCREENSHOT,
  id: 'screenshot-private-456',
  short_id: 'prv456',
  is_public: false,
};

/**
 * Default test usage record
 */
export const TEST_USAGE = {
  id: 'usage-123',
  user_id: TEST_USER.id,
  month: '2024-01',
  screenshot_count: 5,
  storage_bytes: 5120,
  bandwidth_bytes: 10240,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
};

/**
 * Current month usage (for free tier limit testing)
 */
export function getCurrentMonthUsage(screenshot_count: number = 5) {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  return {
    ...TEST_USAGE,
    month,
    screenshot_count,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Create a custom test user
 */
export function createTestUser(overrides?: Partial<typeof TEST_USER>) {
  return { ...TEST_USER, ...overrides };
}

/**
 * Create a custom test screenshot
 */
export function createTestScreenshot(overrides?: Partial<typeof TEST_SCREENSHOT>) {
  return { ...TEST_SCREENSHOT, ...overrides };
}

/**
 * Create a custom test usage record
 */
export function createTestUsage(overrides?: Partial<typeof TEST_USAGE>) {
  return { ...TEST_USAGE, ...overrides };
}

/**
 * Generate unique email for test isolation
 */
export function generateTestEmail(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}

/**
 * Valid signup request data
 */
export const VALID_SIGNUP_DATA = {
  email: 'newuser@example.com',
  password: 'SecurePass123!',
  full_name: 'New User',
};

/**
 * Valid upload request data
 */
export const VALID_UPLOAD_DATA = {
  filename: 'screenshot.png',
  mimeType: 'image/png',
  fileSize: 1024000, // 1MB
};

/**
 * Invalid upload data (exceeds file size)
 */
export const INVALID_UPLOAD_DATA_SIZE = {
  filename: 'large.png',
  mimeType: 'image/png',
  fileSize: 11 * 1024 * 1024, // 11MB (exceeds 10MB limit)
};

/**
 * Invalid upload data (unsupported MIME type)
 */
export const INVALID_UPLOAD_DATA_MIME = {
  filename: 'document.pdf',
  mimeType: 'application/pdf',
  fileSize: 1024,
};

/**
 * Stripe webhook event IDs (for idempotency testing)
 */
export const STRIPE_EVENT_IDS = {
  subscriptionCreated: 'evt_test_subscription_created_123',
  subscriptionDeleted: 'evt_test_subscription_deleted_456',
  subscriptionUpdated: 'evt_test_subscription_updated_789',
};

/**
 * Stripe customer IDs
 */
export const STRIPE_CUSTOMER_IDS = {
  free: 'cus_test_free_123',
  pro: 'cus_test_pro_456',
  team: 'cus_test_team_789',
};

/**
 * Stripe subscription IDs
 */
export const STRIPE_SUBSCRIPTION_IDS = {
  pro: 'sub_test_pro_123',
  team: 'sub_test_team_456',
};
