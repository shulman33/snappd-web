# Testing Guide - Snappd Web

Quick reference guide for running integration tests for the Snappd authentication system.

## Quick Start

### 1. One-Time Setup

```bash
# Install dependencies
npm install

# Install Supabase CLI (if not already installed)
brew install supabase/tap/supabase  # macOS
# For other platforms: https://supabase.com/docs/guides/cli

# Start local Supabase
supabase start

# Note: .env.test is already configured for local Supabase
```

### 2. Run Tests

**Option A: Automated (Recommended)**
```bash
# Automatically starts test server, runs tests, and cleans up
npm run test:integration:full
```

**Option B: Manual (Two Terminals)**
```bash
# Terminal 1: Start test server on port 3001
npm run dev:test

# Terminal 2: Run integration tests
npm run test:integration
```

## Test Commands

| Command | Description |
|---------|-------------|
| `npm run test` | Run all unit tests |
| `npm run test:integration:full` | **Automated**: Start server, run tests, cleanup |
| `npm run test:integration:full:watch` | Automated with watch mode |
| `npm run dev:test` | Start test server on port 3001 |
| `npm run test:integration` | Run integration tests (requires server running) |
| `npm run test:integration:watch` | Watch mode (requires server running) |
| `npm run test:coverage` | Generate coverage report |

**Note:** The `test:integration:full` commands are recommended as they handle all setup automatically.

## Test Environment Setup

### Environment Isolation

Tests run in a completely isolated environment:

- **Test Server**: Port 3001 (separate from dev server on 3000)
- **Supabase**: Local instance at `http://127.0.0.1:54321`
- **Database**: Local PostgreSQL with test data only
- **Config**: Uses `.env.test` instead of `.env.local`

This ensures zero risk of corrupting production data.

### Required Environment Variables

The `.env.test` file is already configured with local Supabase settings:

```env
# Test server URL (port 3001)
NEXT_PUBLIC_APP_URL=http://localhost:3001

# Test Supabase project (create a separate project for testing!)
NEXT_PUBLIC_SUPABASE_URL=https://your-test-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Node environment
NODE_ENV=test
```

### Setting Up Test Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project (e.g., "snappd-test")
3. Run your migrations on the test project:
   ```bash
   # Apply migrations to test project
   psql $TEST_DATABASE_URL < supabase/migrations/*.sql
   ```
4. Copy URL and keys to `.env.test`

## Test Structure

```
src/__tests__/
├── helpers/
│   └── test-utils.ts              # Reusable test utilities
└── integration/
    └── auth/
        └── journey-1-email-password-signup.test.ts
```

## Available Test Journeys

### Journey #1: Email/Password Account Creation & Verification

**Status:** ✅ Implemented

**User Story:** New user creates account with email/password, verifies email, and signs in.

**Test Coverage:**
- Complete signup → verify → signin → fetch user flow
- Duplicate email error handling
- Invalid password validation
- Email format validation
- Unverified email login prevention
- Invalid credentials handling
- Account lockout after 5 failed attempts
- Profile creation with default values
- Auth event logging
- Session cookie management

**Run this test:**
```bash
npm run test -- journey-1-email-password-signup
```

## Common Issues & Solutions

### ❌ Tests fail with "ECONNREFUSED"

**Problem:** Next.js dev server is not running

**Solution:**
```bash
# Start the dev server in a separate terminal
npm run dev
```

### ❌ Tests fail with Supabase errors

**Problem:** Invalid Supabase credentials in `.env.test`

**Solution:**
1. Check `.env.test` has correct credentials
2. Verify test Supabase project exists
3. Ensure migrations are applied to test project
4. Test connection:
   ```bash
   curl https://your-test-project.supabase.co
   ```

### ❌ Tests timeout

**Problem:** Tests taking longer than 30 seconds

**Solution:**
1. Check network connection to Supabase
2. Verify dev server is responsive
3. Increase timeout in `jest.config.js` if needed:
   ```javascript
   testTimeout: 60000, // 60 seconds
   ```

### ❌ Test data not cleaned up

**Problem:** Old test data remains in database

**Solution:**
```bash
# Manually clean up test users
psql $TEST_DATABASE_URL -c "DELETE FROM auth.users WHERE email LIKE 'test-%@example.com';"
```

Or use the cleanup utility:
```typescript
import { cleanupAllTestUsers } from './helpers/test-utils';

// In test file
await cleanupAllTestUsers();
```

### ❌ Rate limit errors during tests

**Problem:** Tests trigger rate limiting

**Solution:**
1. Clear rate limit counters between test runs
2. Use longer delays between requests
3. Reset Redis cache if using Upstash:
   ```bash
   redis-cli FLUSHDB
   ```

## Test Best Practices

### ✅ DO

- Use unique test data (timestamps, random strings)
- Clean up test data in `afterAll()` hooks
- Test both happy paths and error scenarios
- Verify database state after API calls
- Check auth events are logged correctly
- Use test helper utilities for common operations

### ❌ DON'T

- Don't use production Supabase project for tests
- Don't leave test data in the database
- Don't rely on test execution order
- Don't hardcode user IDs or emails
- Don't skip error scenario testing
- Don't commit `.env.test` to version control

## Debugging Tests

### Enable verbose output

```bash
npm run test -- --verbose
```

### Run a single test

```bash
npm run test -- --testNamePattern="should allow a new user"
```

### Add console logs

```typescript
it('should do something', async () => {
  const response = await fetch(url);
  console.log('Response:', await response.json()); // Debug output
  // ...
});
```

### Check database state manually

```bash
# Connect to test database
psql $TEST_DATABASE_URL

# Check profiles
SELECT * FROM profiles WHERE email LIKE 'test-%@example.com';

# Check auth events
SELECT * FROM auth_events WHERE email LIKE 'test-%@example.com' ORDER BY created_at DESC;
```

## Coverage Reports

Generate and view coverage report:

```bash
# Generate coverage
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html
```

**Coverage Goals:**
- Overall: >80%
- Auth routes: >90%
- Critical paths: 100%

## CI/CD Integration

Tests can be run in CI/CD pipelines. Example GitHub Actions workflow:

```yaml
- name: Run integration tests
  run: |
    npm run dev &
    npx wait-on http://localhost:3000
    npm run test:integration
  env:
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.TEST_SUPABASE_SERVICE_KEY }}
```

## Test Utilities Reference

Quick reference for test helper functions:

```typescript
// Create test user
const user = await signupTestUser(BASE_URL, {
  fullName: 'Test User',
});

// Verify email (bypass email flow)
await verifyTestUserEmail(userId);

// Create authenticated user (signup + verify + signin)
const authUser = await createAuthenticatedTestUser(BASE_URL);

// Clean up test user
await cleanupTestUser(userId);

// Verify auth event was logged
const logged = await verifyAuthEventLogged('login_success', {
  userId: user.id,
});

// Make authenticated request
const response = await authenticatedFetch(
  url,
  { method: 'GET' },
  sessionCookies
);
```

## Further Reading

- [Full Testing Documentation](./src/__tests__/README.md)
- [Integration Test Journeys](./docs/integration-test-journeys.md)
- [Test Utilities API](./src/__tests__/helpers/test-utils.ts)

## Getting Help

If you encounter issues:

1. Check the [Common Issues](#common-issues--solutions) section
2. Review the [full testing documentation](./src/__tests__/README.md)
3. Check test file examples for patterns
4. Verify environment variables in `.env.test`

## Contributing Tests

When adding new tests:

1. Follow existing test structure
2. Use test utility functions
3. Clean up test data properly
4. Test happy path AND error scenarios
5. Document new tests in this file

---

## Additional Resources

- **[Detailed Setup Guide](./TESTING_SETUP.md)** - Comprehensive guide with troubleshooting
- **[Test Architecture Documentation](./src/__tests__/README.md)** - Full testing documentation
- **[Integration Test Examples](./src/__tests__/integration/)** - Real test examples

---

**Happy Testing! 🧪**
