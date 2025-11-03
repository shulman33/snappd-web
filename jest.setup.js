/**
 * Jest Setup File
 *
 * This file runs once before all tests and configures:
 * - Environment variables
 * - Global test utilities
 * - Test timeouts
 * - Custom matchers (if needed)
 */

// Load environment variables from .env.test
require('dotenv').config({ path: '.env.test' });

// Set default test timeout (can be overridden per test)
jest.setTimeout(30000); // 30 seconds

// Global test utilities
// Use port 3001 for test server to avoid conflicts with dev server
global.TEST_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

// Suppress console errors/warnings during tests (optional)
// Uncomment if tests produce too much noise
// global.console = {
//   ...console,
//   error: jest.fn(),
//   warn: jest.fn(),
// };

// Custom matchers (if needed)
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

console.log('🧪 Jest setup complete');
console.log(`📍 Base URL: ${global.TEST_BASE_URL}`);
console.log(`🔐 Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL || 'not set'}`);
