import { vi } from 'vitest';

/**
 * Setup all API test mocks
 * Call this in beforeEach or beforeAll hooks
 */
export function setupApiMocks() {
  // Mocks are defined in individual test files using vi.mock()
  // This is a placeholder for any global setup needed
}

/**
 * Reset all mocks between tests
 */
export function resetAllMocks() {
  vi.clearAllMocks();
}

/**
 * Mock environment variables for testing
 */
export function mockEnvVars(vars: Record<string, string>) {
  Object.entries(vars).forEach(([key, value]) => {
    process.env[key] = value;
  });
}

/**
 * Restore environment variables
 */
export function restoreEnvVars(vars: string[]) {
  vars.forEach((key) => {
    delete process.env[key];
  });
}

/**
 * Wait for async operations to complete
 * Useful when testing async event handlers
 */
export function waitForAsync(ms: number = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract error details from API response
 */
export function extractErrorDetails(responseBody: any): {
  code: string;
  message: string;
  details?: any;
} {
  return {
    code: responseBody.error?.code || 'UNKNOWN_ERROR',
    message: responseBody.error?.message || 'Unknown error',
    details: responseBody.error?.details,
  };
}

/**
 * Assert response matches expected structure
 */
export function assertValidApiResponse(
  response: Response,
  expectedStatus: number
): void {
  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected status ${expectedStatus} but got ${response.status}`
    );
  }
}

/**
 * Create a date string in ISO format
 */
export function createISODate(daysOffset: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString();
}

/**
 * Get current month in YYYY-MM format
 */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get first day of current month in ISO format
 */
export function getFirstDayOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

/**
 * Mock Stripe webhook signature
 */
export function createMockStripeSignature(payload: string): string {
  return `t=${Date.now()},v1=mock_signature_${Buffer.from(payload).toString('base64').substring(0, 32)}`;
}
