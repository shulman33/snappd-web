# Integration Testing Setup Guide

This guide explains how to run integration tests for the Snappd Web application.

## Overview

Integration tests run against a **local test server** (port 3001) connected to a **local Supabase instance** to ensure complete isolation from production data and services.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Test Environment                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Jest Tests (port N/A)                                   │
│       │                                                   │
│       │ HTTP Requests                                    │
│       ↓                                                   │
│  Next.js Test Server (port 3001)                        │
│       │                                                   │
│       │ Supabase Client                                  │
│       ↓                                                   │
│  Local Supabase (port 54321)                            │
│       ├── PostgreSQL (port 54322)                        │
│       ├── Auth Service                                   │
│       ├── Storage Service                                │
│       └── Local Redis (test rate limiting)              │
│                                                           │
└─────────────────────────────────────────────────────────┘

Production Environment (port 3000) runs independently ✓
```

## Prerequisites

1. **Supabase CLI installed**
   ```bash
   # macOS
   brew install supabase/tap/supabase

   # Other platforms
   # See: https://supabase.com/docs/guides/cli
   ```

2. **Local Supabase running**
   ```bash
   supabase start
   ```

   This will start:
   - API server on `http://127.0.0.1:54321`
   - PostgreSQL on `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
   - Studio on `http://127.0.0.1:54323`

3. **Dependencies installed**
   ```bash
   npm install
   ```

## Running Tests

### Method 1: Automated (Recommended)

This method automatically starts the test server, runs tests, and cleans up:

```bash
# Run all integration tests once
npm run test:integration:full

# Run tests in watch mode
npm run test:integration:full:watch
```

The automated script will:
1. ✓ Check if local Supabase is running
2. ✓ Verify port 3001 is available
3. ✓ Start test server with `.env.test` configuration
4. ✓ Wait for server to be ready
5. ✓ Run integration tests
6. ✓ Clean up test server on completion

### Method 2: Manual (Two Terminals)

This gives you more control and allows you to see server logs:

**Terminal 1: Start test server**
```bash
npm run dev:test
```

This starts Next.js on port 3001 with test environment variables.

**Terminal 2: Run tests**
```bash
# Run all integration tests
npm run test:integration

# Run tests in watch mode
npm run test:integration:watch
```

## Configuration Files

### `.env.test`
Contains test environment configuration:
- Uses local Supabase (`http://127.0.0.1:54321`)
- Uses port 3001 for test server
- Uses local Upstash Redis for rate limiting
- Enables test-specific flags

### `jest.setup.js`
Configures Jest to use port 3001 as the base URL for API requests.

### `jest.config.js`
Jest configuration for running integration tests.

## Port Usage

- **3000**: Production dev server (`.env.local`)
- **3001**: Test server (`.env.test`)
- **54321**: Local Supabase API
- **54322**: Local PostgreSQL
- **54323**: Supabase Studio

## Environment Isolation

| Aspect | Development (port 3000) | Testing (port 3001) |
|--------|------------------------|---------------------|
| Supabase | Production instance | Local instance |
| Database | Production data | Test data (isolated) |
| Redis | Production Upstash | Test Upstash |
| Port | 3000 | 3001 |
| Env File | `.env.local` | `.env.test` |

## Test Data Management

### Automatic Cleanup
Tests automatically clean up created data using:
- `cleanupTestUser(userId)` - Removes user and all related data
- `cleanupTestUserByEmail(email)` - Finds and removes user by email

### Manual Cleanup
If tests fail and leave orphaned data:

```bash
# Reset local database to clean slate
supabase db reset

# Or use Supabase Studio
open http://127.0.0.1:54323
```

## Troubleshooting

### Issue: "Port 3001 is already in use"

**Solution:**
```bash
# Find and kill process on port 3001
lsof -ti:3001 | xargs kill
```

### Issue: "Local Supabase is not running"

**Solution:**
```bash
# Start local Supabase
supabase start

# Check status
supabase status
```

### Issue: Tests failing with 500 errors

**Causes:**
- Migrations not applied to local database
- Database schema out of sync

**Solution:**
```bash
# Reset database and apply all migrations
supabase db reset

# Or just apply pending migrations
supabase db push
```

### Issue: Rate limiting errors in tests

**Causes:**
- Redis rate limit counters persisting between test runs
- Tests not properly isolated

**Solution:**
```bash
# Restart Supabase to clear Redis
supabase stop
supabase start
```

### Issue: "Connection refused" errors

**Causes:**
- Test server not fully started before tests run
- Network issues

**Solution:**
```bash
# Use manual method with longer wait time
# Terminal 1:
npm run dev:test

# Wait 10 seconds, then Terminal 2:
npm run test:integration
```

## Test Development Workflow

1. **Start local Supabase** (once per session)
   ```bash
   supabase start
   ```

2. **Run tests in watch mode**
   ```bash
   npm run test:integration:full:watch
   ```

3. **Make changes** to tests or application code

4. **Tests auto-rerun** on file changes

5. **Check Supabase Studio** for database state
   ```bash
   open http://127.0.0.1:54323
   ```

## CI/CD Integration

For CI/CD pipelines (GitHub Actions, etc.):

```yaml
- name: Start Supabase
  run: |
    supabase start

- name: Run Integration Tests
  run: npm run test:integration:full
```

The automated script handles all setup and teardown.

## Best Practices

1. **Always use the automated script** (`npm run test:integration:full`) for consistency
2. **Keep local Supabase running** during development to avoid startup delays
3. **Reset database** between major test changes to ensure clean state
4. **Use unique test data** (timestamps, random strings) to avoid conflicts
5. **Clean up test data** in `afterAll()` hooks to prevent pollution

## Need Help?

- Check Supabase CLI docs: https://supabase.com/docs/guides/cli
- Check Jest docs: https://jestjs.io/docs/getting-started
- Check test utilities: `src/__tests__/helpers/test-utils.ts`
