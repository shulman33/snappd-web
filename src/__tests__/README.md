# Integration Tests

This directory contains comprehensive integration tests for the Snappd authentication system. Integration tests validate complete user journeys, ensuring that multiple API endpoints work together correctly and that data flows properly through the entire system.

## Overview

**What are Integration Tests?**

Integration tests verify that different parts of your application work together correctly. Unlike unit tests that test individual functions in isolation, integration tests:

- Test complete user workflows end-to-end
- Use real databases and external services
- Validate data persistence and retrieval
- Ensure APIs work together correctly
- Test error handling across multiple layers

**When to Use Integration Tests:**

- Testing complete user journeys (signup → verify → signin)
- Validating database state changes
- Testing authentication flows
- Verifying API contracts
- Ensuring rate limiting works correctly
- Testing error scenarios across multiple endpoints

## Test Structure

```
src/__tests__/
├── README.md (this file)
├── helpers/
│   └── test-utils.ts          # Reusable test utilities and factories
└── integration/
    └── auth/
        └── journey-1-email-password-signup.test.ts
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

This will install Jest, ts-jest, and other testing dependencies defined in `package.json`.

### 2. Create Test Environment File

Copy the example environment file and configure it:

```bash
cp .env.test.example .env.test
```

**IMPORTANT:** Use a dedicated Supabase test project, NOT your production project!

Edit `.env.test` and set:

```env
# Test Supabase project (create a separate test project)
NEXT_PUBLIC_SUPABASE_URL=https://your-test-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-test-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-test-service-role-key

# Test application URL (must be running during tests)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Stripe test keys
STRIPE_SECRET_KEY=sk_test_...
```

### 3. Set Up Test Database

Your test Supabase project should have the same schema as production:

1. Create a new Supabase project for testing
2. Run all migrations on the test project:
   ```bash
   # If using Supabase CLI
   supabase db push
   ```
3. Ensure these tables exist:
   - `profiles`
   - `screenshots`
   - `monthly_usage`
   - `auth_events`
   - `stripe_events`

### 4. Start Development Server

Integration tests require a running Next.js server:

```bash
# Terminal 1: Start the development server
npm run dev
```

Wait for the server to start on `http://localhost:3000`.

### 5. Run Tests

```bash
# Terminal 2: Run all tests
npm run test

# Run only integration tests
npm run test:integration

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run a specific test file
npm run test journey-1-email-password-signup
```

## Test Files

### Journey #1: Email/Password Account Creation & Verification

**File:** `integration/auth/journey-1-email-password-signup.test.ts`

**User Story:** A new user creates an account with email/password, verifies their email, and signs in.

**API Sequence:**
1. POST /api/auth/signup - Create account
2. GET /api/auth/verify-email - Verify email
3. POST /api/auth/signin - Sign in with verified account
4. GET /api/auth/user - Fetch user profile

**Test Coverage:**
- ✅ Complete happy path (signup → verify → signin → fetch profile)
- ✅ Duplicate email error (409 conflict)
- ✅ Invalid password validation (400 validation error)
- ✅ Invalid email format (400 validation error)
- ✅ Signin before email verification (403 forbidden)
- ✅ Invalid credentials (401 unauthorized)
- ✅ Account lockout after 5 failed attempts (429 locked)
- ✅ Unauthenticated access to protected endpoints (401)
- ✅ Profile creation with default values
- ✅ Auth event logging (signup_success, email_verified, login_success)
- ✅ Session cookie management

**Run this test:**
```bash
npm run test journey-1-email-password-signup
```

## Test Utilities

### Helper Functions

Located in `helpers/test-utils.ts`:

#### User Creation

```typescript
// Create test user data (not yet signed up)
const userData = await createTestUser({
  email: 'custom@example.com',
  password: 'CustomPass123!',
  fullName: 'Custom User',
});

// Create and signup a test user via API
const user = await signupTestUser(BASE_URL, {
  fullName: 'Test User',
});

// Create authenticated user (signup + verify + signin)
const authUser = await createAuthenticatedTestUser(BASE_URL, {
  fullName: 'Authenticated User',
});
```

#### Email Verification

```typescript
// Verify user's email (bypass email flow)
await verifyTestUserEmail(userId);
```

#### Cleanup

```typescript
// Clean up single user
await cleanupTestUser(userId);

// Clean up by email
await cleanupTestUserByEmail('test@example.com');

// Clean up all test users (use with caution!)
await cleanupAllTestUsers();
```

#### Auth Event Verification

```typescript
// Verify auth event was logged
const eventLogged = await verifyAuthEventLogged('login_success', {
  userId: user.id,
  email: user.email,
});

// Get auth event count
const eventCount = await getAuthEventCount(userId, 'login_failure');
```

#### Session Management

```typescript
// Extract session cookies from response
const cookies = extractSessionCookies(signinResponse);

// Make authenticated request
const response = await authenticatedFetch(
  `${BASE_URL}/api/auth/user`,
  { method: 'GET' },
  cookies
);
```

## Writing New Integration Tests

Follow this structure when creating new integration tests:

```typescript
describe('Journey #X: [Journey Name]', () => {
  // Track created users for cleanup
  const createdUserIds: string[] = [];
  const createdEmails: string[] = [];

  // Cleanup after all tests
  afterAll(async () => {
    for (const userId of createdUserIds) {
      await cleanupTestUser(userId);
    }
    for (const email of createdEmails) {
      await cleanupTestUserByEmail(email);
    }
  });

  describe('[Step 1: Description]', () => {
    it('should [expected behavior]', async () => {
      // 1. Setup: Create test data
      const user = await signupTestUser(BASE_URL);
      createdUserIds.push(user.id);

      // 2. Execute: Make API call
      const response = await fetch(`${BASE_URL}/api/auth/endpoint`, {
        method: 'POST',
        body: JSON.stringify({ /* data */ }),
      });

      // 3. Assert: Verify response
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('expectedField');

      // 4. Verify: Check database state
      const supabase = createServiceClient();
      const { data: dbRecord } = await supabase
        .from('table')
        .select('*')
        .eq('id', user.id)
        .single();

      expect(dbRecord).toBeTruthy();

      // 5. Verify: Check auth events
      const eventLogged = await verifyAuthEventLogged('event_type', {
        userId: user.id,
      });
      expect(eventLogged).toBe(true);
    });
  });

  describe('Error Scenario: [Error Type]', () => {
    it('should return [status code] when [condition]', async () => {
      // Test error scenarios
    });
  });

  describe('Complete Journey', () => {
    it('should successfully complete the entire journey', async () => {
      // Test complete end-to-end flow
    });
  });
});
```

## Best Practices

### 1. Test Isolation

- Each test should be independent and not rely on other tests
- Always clean up test data in `afterAll()` hooks
- Use unique identifiers (timestamps, random strings) for test data

### 2. Real Database Usage

- Integration tests should use a real Supabase instance
- Use a dedicated TEST project, never production
- Tests will create and delete real data

### 3. Setup and Teardown

```typescript
// Good: Cleanup after all tests
afterAll(async () => {
  for (const userId of createdUserIds) {
    await cleanupTestUser(userId);
  }
});

// Bad: No cleanup (leaves test data in database)
afterAll(() => {
  // Nothing
});
```

### 4. Clear Test Names

```typescript
// Good: Clear, specific test name
it('should return 409 conflict when signing up with existing email', async () => {
  // ...
});

// Bad: Vague test name
it('should work', async () => {
  // ...
});
```

### 5. Assert Everything Important

```typescript
// Good: Verify response, database state, and events
expect(response.status).toBe(201);
expect(data.user.id).toBeTruthy();

const profile = await fetchProfile(data.user.id);
expect(profile.plan).toBe('free');

const eventLogged = await verifyAuthEventLogged('signup_success', {
  userId: data.user.id,
});
expect(eventLogged).toBe(true);

// Bad: Only verify response
expect(response.status).toBe(201);
```

### 6. Test Error Scenarios

Don't just test the happy path. Test:
- Invalid input (400 errors)
- Unauthorized access (401 errors)
- Forbidden actions (403 errors)
- Not found (404 errors)
- Conflicts (409 errors)
- Rate limiting (429 errors)
- Server errors (500 errors)

### 7. Use Factories for Test Data

```typescript
// Good: Use test utility factories
const user = await signupTestUser(BASE_URL, {
  fullName: 'Test User',
});

// Bad: Duplicate user creation logic
const email = `test-${Date.now()}@example.com`;
const response = await fetch(/* ... */);
// ... many lines of setup
```

## Debugging Tests

### Enable Verbose Output

```bash
npm run test -- --verbose
```

### Run Single Test

```bash
npm run test -- --testNamePattern="should allow a new user"
```

### Check Test Coverage

```bash
npm run test:coverage
```

### View Logs

Uncomment console statements in test files:

```typescript
console.log('Response:', await response.json());
console.log('Database state:', profile);
```

### Common Issues

**Issue:** Tests fail with "connection refused"
**Solution:** Ensure Next.js dev server is running on port 3000

**Issue:** Tests fail with Supabase errors
**Solution:** Check `.env.test` has correct Supabase credentials

**Issue:** Tests timeout
**Solution:** Increase timeout in test or `jest.config.js`

**Issue:** Test data not cleaned up
**Solution:** Check `afterAll()` hooks are running, verify cleanup logic

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_APP_URL` | Base URL of running server | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Test Supabase project URL | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Test Supabase anon key | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Test Supabase service key | ✅ Yes |
| `NODE_ENV` | Should be `test` | ✅ Yes |
| `STRIPE_SECRET_KEY` | Stripe test key | ⚠️ Optional |
| `UPSTASH_REDIS_REST_URL` | Redis for rate limiting | ⚠️ Optional |
| `UPSTASH_REDIS_REST_TOKEN` | Redis token | ⚠️ Optional |

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Create .env.test
        run: |
          echo "NEXT_PUBLIC_APP_URL=http://localhost:3000" > .env.test
          echo "NEXT_PUBLIC_SUPABASE_URL=${{ secrets.TEST_SUPABASE_URL }}" >> .env.test
          echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=${{ secrets.TEST_SUPABASE_ANON_KEY }}" >> .env.test
          echo "SUPABASE_SERVICE_ROLE_KEY=${{ secrets.TEST_SUPABASE_SERVICE_KEY }}" >> .env.test

      - name: Start development server
        run: npm run dev &
        env:
          PORT: 3000

      - name: Wait for server
        run: npx wait-on http://localhost:3000

      - name: Run integration tests
        run: npm run test:integration
```

## Test Metrics

Track these metrics for test health:

- **Coverage:** Aim for >80% code coverage
- **Execution Time:** Keep tests under 5 minutes total
- **Flakiness:** Tests should pass consistently (>99%)
- **Cleanup:** No test data should remain after test runs

## Contributing

When adding new tests:

1. Follow the existing structure and patterns
2. Add test helpers to `test-utils.ts` if reusable
3. Document new test files in this README
4. Ensure tests clean up all created data
5. Test both happy paths and error scenarios
6. Update `.env.test.example` if new env vars are needed

## Support

For questions or issues with integration tests:

1. Check the [troubleshooting section](#debugging-tests)
2. Review existing test files for examples
3. Check `test-utils.ts` for available helpers
4. Consult the main project documentation

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Next.js](https://nextjs.org/docs/testing)
- [Supabase Testing Guide](https://supabase.com/docs/guides/getting-started/testing)
- [Integration Test Best Practices](https://martinfowler.com/articles/practical-test-pyramid.html)
