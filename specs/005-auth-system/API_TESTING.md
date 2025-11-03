# API Testing Guide - Authentication System

This document provides curl commands to test all authentication flows for the Snappd authentication system.

**Base URL**: `http://localhost:3000` (adjust for your environment)

---

## Table of Contents

1. [User Registration Flow](#1-user-registration-flow)
2. [Email Verification Flow](#2-email-verification-flow)
3. [Login Flow](#3-login-flow)
4. [Password Reset Flow](#4-password-reset-flow)
5. [Session Management](#5-session-management)
6. [Logout Flow](#6-logout-flow)
7. [Rate Limiting Tests](#7-rate-limiting-tests)
8. [Account Lockout Tests](#8-account-lockout-tests)
9. [Error Scenarios](#9-error-scenarios)
10. [Complete User Journey Test](#10-complete-user-journey-test)
11. [Testing Browser Extension Polling](#11-testing-browser-extension-polling)
12. [Testing Concurrent Sessions](#12-testing-concurrent-sessions)
13. [Testing OAuth (Google) Authentication](#13-testing-oauth-google-authentication)

---

## 1. User Registration Flow

### Sign Up a New User

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "fullName": "Test User"
  }' \
  -v
```

**Expected Response (200)**:
```json
{
  "user": {
    "id": "uuid-here",
    "email": "test@example.com",
    "emailVerified": false,
    "fullName": "Test User",
    "plan": "free",
    "createdAt": "2025-11-02T..."
  },
  "message": "Account created successfully. Please check your email to verify your account."
}
```

### Sign Up with Missing Fields (Validation Error)

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }' \
  -v
```

**Expected Response (400)**:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Validation failed. Please check your input.",
  "details": [
    {
      "field": "password",
      "message": "Password is required"
    }
  ]
}
```

### Sign Up with Weak Password

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "weak"
  }' \
  -v
```

**Expected Response (400)**:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Validation failed. Please check your input."
}
```

### Sign Up with Existing Email

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "fullName": "Duplicate User"
  }' \
  -v
```

**Expected Response (409)**:
```json
{
  "error": "EMAIL_EXISTS",
  "message": "An account with this email already exists."
}
```

---

## 2. Email Verification Flow

### Resend Verification Email

```bash
curl -X POST http://localhost:3000/api/auth/verify-email/resend \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }' \
  -v
```

**Expected Response (200)**:
```json
{
  "message": "Verification email sent successfully. Please check your inbox."
}
```

### Verify Email (GET request with token from email)

```bash
# Replace {token_hash} and {type} with actual values from email link
curl -X GET "http://localhost:3000/api/auth/verify-email?token_hash={token_hash}&type=signup" \
  -v
```

**Expected Response**: Redirect to dashboard or success page

---

## 3. Login Flow

### Successful Login

```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }' \
  -c cookies.txt \
  -v
```

**Expected Response (200)**:
```json
{
  "user": {
    "id": "uuid-here",
    "email": "test@example.com",
    "emailVerified": true,
    "fullName": "Test User",
    "plan": "free",
    "createdAt": "2025-11-02T..."
  },
  "session": {
    "expiresAt": "2025-11-09T..."
  }
}
```

**Note**: The `-c cookies.txt` flag saves session cookies to a file for subsequent requests.

### Login with Invalid Credentials

```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "WrongPassword123!"
  }' \
  -v
```

**Expected Response (401)**:
```json
{
  "error": "INVALID_CREDENTIALS",
  "message": "Invalid email or password."
}
```

### Login with Unverified Email

```bash
# First, create a new user without verifying
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "unverified@example.com",
    "password": "SecurePass123!"
  }'

# Then try to login
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "unverified@example.com",
    "password": "SecurePass123!"
  }' \
  -v
```

**Expected Response (403)**:
```json
{
  "error": "EMAIL_NOT_VERIFIED",
  "message": "Please verify your email address before signing in. Check your inbox for the verification link."
}
```

---

## 4. Password Reset Flow

### Request Password Reset

```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }' \
  -v
```

**Expected Response (200)**:
```json
{
  "message": "If an account exists with this email address, you will receive password reset instructions shortly. Please check your inbox and spam folder."
}
```

**Note**: Response is the same whether the email exists or not (prevents account enumeration).

### Request Password Reset - Invalid Email Format

```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "not-an-email"
  }' \
  -v
```

**Expected Response (400)**:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid email address",
  "details": [
    {
      "field": "email",
      "message": "Invalid email address"
    }
  ]
}
```

### Request Password Reset - Rate Limit Test

```bash
# Send 4 password reset requests in quick succession
for i in {1..4}; do
  echo "Password reset request $i:"
  curl -X POST http://localhost:3000/api/auth/reset-password \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test@example.com"
    }' \
    -s | jq -r '.error // .message'
  echo ""
  sleep 1
done
```

**Expected Output**:
- First 3 requests: Success message
- 4th request: `RATE_LIMIT_EXCEEDED` error

**Response (429)** on 4th request:
```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many password reset requests. Please try again later or contact support if you need immediate assistance.",
  "retryAfter": 3600
}
```

### Confirm Password Reset (with token from email)

```bash
# Replace {token_hash} with actual token from password reset email
curl -X POST http://localhost:3000/api/auth/reset-password/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "token": "{token_hash}",
    "password": "NewSecurePass123!",
    "confirmPassword": "NewSecurePass123!"
  }' \
  -v
```

**Expected Response (200)**:
```json
{
  "message": "Your password has been reset successfully. You can now log in with your new password.",
  "user": {
    "id": "uuid-here",
    "email": "test@example.com"
  }
}
```

### Confirm Password Reset - Password Mismatch

```bash
curl -X POST http://localhost:3000/api/auth/reset-password/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "token": "{token_hash}",
    "password": "NewSecurePass123!",
    "confirmPassword": "DifferentPassword123!"
  }' \
  -v
```

**Expected Response (400)**:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request data",
  "details": [
    {
      "field": "confirmPassword",
      "message": "Passwords do not match"
    }
  ]
}
```

### Confirm Password Reset - Invalid/Expired Token

```bash
curl -X POST http://localhost:3000/api/auth/reset-password/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "token": "invalid-or-expired-token",
    "password": "NewSecurePass123!",
    "confirmPassword": "NewSecurePass123!"
  }' \
  -v
```

**Expected Response (401)**:
```json
{
  "error": "INVALID_TOKEN",
  "message": "Password reset link is invalid or has expired. Please request a new password reset.",
  "canRetry": true
}
```

### Confirm Password Reset - Weak Password

```bash
curl -X POST http://localhost:3000/api/auth/reset-password/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "token": "{token_hash}",
    "password": "weak",
    "confirmPassword": "weak"
  }' \
  -v
```

**Expected Response (400)**:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request data",
  "details": [
    {
      "field": "password",
      "message": "Password must be at least 8 characters"
    }
  ]
}
```

### Test Complete Password Reset Flow

```bash
#!/bin/bash

# Step 1: Request password reset
echo "=== Step 1: Request Password Reset ==="
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }' | jq

echo -e "\n=== Step 2: Check Email for Reset Link ==="
echo "Manual step: Check email inbox for password reset link"
echo "Extract the token_hash from the URL"

# Step 3: Confirm password reset (replace {token_hash} with actual token)
echo -e "\n=== Step 3: Confirm Password Reset ==="
echo "curl -X POST http://localhost:3000/api/auth/reset-password/confirm \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{"
echo "    \"token\": \"{token_hash}\","
echo "    \"password\": \"NewSecurePass123!\","
echo "    \"confirmPassword\": \"NewSecurePass123!\""
echo "  }' | jq"

# Step 4: Login with new password
echo -e "\n=== Step 4: Login with New Password ==="
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "NewSecurePass123!"
  }' \
  -c reset_cookies.txt | jq

# Step 5: Verify login successful
echo -e "\n=== Step 5: Verify Login Successful ==="
curl -X GET http://localhost:3000/api/auth/user \
  -b reset_cookies.txt | jq

# Cleanup
rm -f reset_cookies.txt
```

### Test Token Expiration (Manual Test)

**Note**: Password reset tokens expire after 1 hour. To test:

1. Request a password reset
2. Wait 61 minutes
3. Try to use the token - should receive `INVALID_TOKEN` error

```bash
# Request reset
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'

# Wait 61 minutes (or set SUPABASE_PASSWORD_RESET_EXPIRY to 1 minute for testing)
sleep 3660

# Try to use expired token
curl -X POST http://localhost:3000/api/auth/reset-password/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "token": "{token_hash}",
    "password": "NewSecurePass123!",
    "confirmPassword": "NewSecurePass123!"
  }'
```

**Expected Response**: `INVALID_TOKEN` error

### Test Single-Use Token Enforcement

```bash
# Get token from email and use it once
TOKEN="your-token-hash-here"

# First use - should succeed
echo "=== First Use (Should Succeed) ==="
curl -X POST http://localhost:3000/api/auth/reset-password/confirm \
  -H "Content-Type: application/json" \
  -d "{
    \"token\": \"$TOKEN\",
    \"password\": \"NewSecurePass123!\",
    \"confirmPassword\": \"NewSecurePass123!\"
  }" | jq

# Second use with same token - should fail
echo -e "\n=== Second Use (Should Fail) ==="
curl -X POST http://localhost:3000/api/auth/reset-password/confirm \
  -H "Content-Type: application/json" \
  -d "{
    \"token\": \"$TOKEN\",
    \"password\": \"AnotherPassword123!\",
    \"confirmPassword\": \"AnotherPassword123!\"
  }" | jq
```

**Expected**:
- First request: Success (200)
- Second request: `INVALID_TOKEN` error (401)

### Test Session Invalidation After Password Reset

```bash
# Login from two devices
echo "=== Login from Device 1 ==="
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "OldPassword123!"
  }' \
  -c device1_cookies.txt | jq

echo -e "\n=== Login from Device 2 ==="
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "OldPassword123!"
  }' \
  -c device2_cookies.txt | jq

# Verify both sessions work
echo -e "\n=== Verify Both Sessions Work ==="
curl -X GET http://localhost:3000/api/auth/user \
  -b device1_cookies.txt | jq -r '.user.email // "Session invalid"'

curl -X GET http://localhost:3000/api/auth/user \
  -b device2_cookies.txt | jq -r '.user.email // "Session invalid"'

# Reset password (get token from email first)
echo -e "\n=== Reset Password ==="
echo "Use reset token to change password to NewPassword123!"

# After password reset, verify old sessions are invalidated
echo -e "\n=== Verify Old Sessions Invalidated ==="
curl -X GET http://localhost:3000/api/auth/user \
  -b device1_cookies.txt | jq

curl -X GET http://localhost:3000/api/auth/user \
  -b device2_cookies.txt | jq

# Cleanup
rm -f device1_cookies.txt device2_cookies.txt
```

**Expected**: After password reset, both old sessions should be invalidated (return 401).

---

## 5. Session Management

### Get Current User (Authenticated)

```bash
curl -X GET http://localhost:3000/api/auth/user \
  -b cookies.txt \
  -v
```

**Expected Response (200)**:
```json
{
  "user": {
    "id": "uuid-here",
    "email": "test@example.com",
    "emailVerified": true,
    "fullName": "Test User",
    "plan": "free",
    "createdAt": "2025-11-02T..."
  }
}
```

### Get Current User (Unauthenticated)

```bash
curl -X GET http://localhost:3000/api/auth/user \
  -v
```

**Expected Response (401)**:
```json
{
  "error": "UNAUTHORIZED",
  "message": "You must be signed in to access this resource."
}
```

### Test Session Persistence

```bash
# Login and save cookies
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }' \
  -c cookies.txt

# Wait a few seconds, then verify session still works
sleep 5

curl -X GET http://localhost:3000/api/auth/user \
  -b cookies.txt \
  -v
```

**Expected**: Both requests should succeed, showing session persistence.

---

## 6. Logout Flow

### Sign Out

```bash
curl -X POST http://localhost:3000/api/auth/signout \
  -b cookies.txt \
  -c cookies.txt \
  -v
```

**Expected Response (200)**:
```json
{
  "message": "Successfully signed out"
}
```

### Verify Session Cleared After Logout

```bash
curl -X GET http://localhost:3000/api/auth/user \
  -b cookies.txt \
  -v
```

**Expected Response (401)**:
```json
{
  "error": "UNAUTHORIZED",
  "message": "You must be signed in to access this resource."
}
```

---

## 7. Rate Limiting Tests

### Test IP Rate Limiting (20 requests in 15 min)

```bash
# Send 21 requests quickly to trigger IP rate limit
for i in {1..21}; do
  echo "Request $i:"
  curl -X POST http://localhost:3000/api/auth/signin \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test@example.com",
      "password": "WrongPassword123!"
    }' \
    -s -o /dev/null -w "HTTP %{http_code}\n"
  sleep 0.1
done
```

**Expected**: First 20 requests return 401, 21st request returns 429.

**Response (429)**:
```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Your IP has been temporarily blocked due to too many requests. Please try again later.",
  "retryAfter": 900
}
```

### Check Rate Limit Headers

```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "WrongPassword123!"
  }' \
  -v 2>&1 | grep -i "ratelimit"
```

**Expected Headers**:
```
< X-RateLimit-Limit: 20
< X-RateLimit-Remaining: 19
< X-RateLimit-Reset: 2025-11-02T...
```

---

## 8. Account Lockout Tests

### Test Account Lockout (5 failures in 15 min)

```bash
# Attempt 6 failed logins with the same email
for i in {1..6}; do
  echo "Failed login attempt $i:"
  curl -X POST http://localhost:3000/api/auth/signin \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test@example.com",
      "password": "WrongPassword123!"
    }' \
    -s | jq -r '.error, .message'
  echo ""
  sleep 1
done
```

**Expected Output**:
- First 5 attempts: `INVALID_CREDENTIALS` / `Invalid email or password.`
- 6th attempt: `ACCOUNT_LOCKED` / `Too many failed login attempts. Your account is temporarily locked for 15 minutes.`

### Verify Account Locked Response

```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }' \
  -v
```

**Expected Response (429)** (even with correct password):
```json
{
  "error": "ACCOUNT_LOCKED",
  "message": "Too many failed login attempts. Your account is temporarily locked for 15 minutes.",
  "retryAfter": 900
}
```

---

## 9. Error Scenarios

### Missing Required Fields

```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }' \
  -v
```

**Expected Response (400)**:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Validation failed. Please check your input."
}
```

### Invalid Email Format

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "not-an-email",
    "password": "SecurePass123!"
  }' \
  -v
```

**Expected Response (400)**:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Validation failed. Please check your input.",
  "details": [
    {
      "field": "email",
      "message": "Invalid email address"
    }
  ]
}
```

### Invalid JSON

```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{invalid json}' \
  -v
```

**Expected Response (400)**: JSON parse error

---

## 10. Complete User Journey Test

### Full Flow: Register → Verify → Login → Access Protected Resource → Logout

```bash
#!/bin/bash

# Step 1: Sign up
echo "=== Step 1: Sign Up ==="
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "journey@example.com",
    "password": "SecurePass123!",
    "fullName": "Journey User"
  }' | jq

# Step 2: Check email and manually verify (or use token from logs/database)
echo -e "\n=== Step 2: Verify Email ==="
echo "Manual step: Click the verification link in email"
echo "Or use: curl -X GET 'http://localhost:3000/api/auth/verify-email?token_hash={token}&type=signup'"

# Step 3: Login
echo -e "\n=== Step 3: Login ==="
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "journey@example.com",
    "password": "SecurePass123!"
  }' \
  -c journey_cookies.txt | jq

# Step 4: Get user data (authenticated request)
echo -e "\n=== Step 4: Get User Data ==="
curl -X GET http://localhost:3000/api/auth/user \
  -b journey_cookies.txt | jq

# Step 5: Logout
echo -e "\n=== Step 5: Logout ==="
curl -X POST http://localhost:3000/api/auth/signout \
  -b journey_cookies.txt | jq

# Step 6: Verify session cleared
echo -e "\n=== Step 6: Verify Session Cleared ==="
curl -X GET http://localhost:3000/api/auth/user \
  -b journey_cookies.txt | jq

# Cleanup
rm -f journey_cookies.txt
```

**Save this as `test_user_journey.sh` and run**: `bash test_user_journey.sh`

---

## 11. Testing Browser Extension Polling

### Simulate Extension Polling for Auth State

```bash
# Extension polls every 10-30 seconds
while true; do
  echo "Polling at $(date):"
  curl -X GET http://localhost:3000/api/auth/user \
    -b cookies.txt \
    -H "Origin: chrome-extension://abc123" \
    -s | jq -r '.user.email // "Not authenticated"'
  sleep 15
done
```

**Expected**: Returns user email if authenticated, error if not.

---

## 12. Testing Concurrent Sessions

### Login from Multiple "Devices"

```bash
# Device 1: Login
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }' \
  -c device1_cookies.txt

# Device 2: Login with same account
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }' \
  -c device2_cookies.txt

# Verify both sessions work
echo "Device 1:"
curl -X GET http://localhost:3000/api/auth/user \
  -b device1_cookies.txt | jq -r '.user.email'

echo "Device 2:"
curl -X GET http://localhost:3000/api/auth/user \
  -b device2_cookies.txt | jq -r '.user.email'

# Logout from Device 1
curl -X POST http://localhost:3000/api/auth/signout \
  -b device1_cookies.txt

# Verify Device 2 still works
echo "Device 2 after Device 1 logout:"
curl -X GET http://localhost:3000/api/auth/user \
  -b device2_cookies.txt | jq -r '.user.email'

# Cleanup
rm -f device1_cookies.txt device2_cookies.txt
```

**Expected**: Both sessions work independently; logging out from one doesn't affect the other.

---

## Notes

### Cookie Management

- Use `-c cookies.txt` to save cookies
- Use `-b cookies.txt` to send cookies
- Cookies are HTTP-only and secure (HTTPS in production)
- Session cookies expire after 7 days of inactivity

### Rate Limit Headers

Every auth endpoint response includes:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: When the rate limit window resets

### Error Codes

- `200`: Success
- `400`: Validation error
- `401`: Invalid credentials / Unauthorized
- `403`: Email not verified
- `409`: Email already exists
- `429`: Rate limit exceeded / Account locked
- `500`: Internal server error

### Testing Environment Variables

Ensure these are set in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

### Tips

1. **Install `jq`** for pretty JSON output: `brew install jq` (macOS)
2. **Use `-v`** flag to see request/response headers
3. **Use `-s`** flag for silent mode (no progress bar)
4. **Save cookies** with `-c` to maintain session across requests
5. **Send cookies** with `-b` for authenticated requests

---

## Troubleshooting

### "Connection refused"
- Ensure Next.js dev server is running: `npm run dev`
- Check the port (default: 3000)

### "CORS error"
- CORS is configured for browser extensions
- Add your origin to the allowed origins in middleware

### "Session not found"
- Verify cookies are being saved/sent correctly
- Check cookie file: `cat cookies.txt`

### Rate limit not resetting
- Wait 15 minutes for automatic reset
- Or clear Redis cache: `redis-cli FLUSHALL` (development only)

---

## 13. Testing OAuth (Google) Authentication

### Overview

OAuth authentication uses browser-based flows that redirect users to Google for authorization. The OAuth callback endpoint handles the response from Google and creates or links user accounts.

**OAuth Flow**:
1. User clicks "Sign in with Google" (handled client-side)
2. User redirected to Google authorization page
3. User authorizes application
4. Google redirects back to `/api/auth/callback/google?code=...`
5. Backend exchanges code for session and creates/links account
6. User redirected to dashboard

### Prerequisites

Before testing OAuth, ensure Google OAuth is configured:

1. **Google Cloud Console** setup completed (see [quickstart.md](./quickstart.md#google-oauth))
2. **Supabase Dashboard** has Google provider enabled
3. Environment variables set:
   ```env
   GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   ```

### Test OAuth Callback - New User Signup

**Scenario**: New user signs in with Google for the first time

```bash
# Simulate OAuth callback with authorization code
# Note: In real flow, the 'code' parameter comes from Google's OAuth redirect
curl -X GET "http://localhost:3000/api/auth/callback/google?code=SIMULATED_AUTH_CODE" \
  -L \
  -v
```

**Expected Behavior**:
- 302 redirect to `/dashboard?welcome=true`
- New user account created in `auth.users`
- New profile created in `profiles` table
- Google identity stored in `auth.identities`
- Auth events logged: `signup_success`, `oauth_linked`

**Manual Test** (Recommended):
1. Navigate to: `http://localhost:3000/login`
2. Click "Sign in with Google" button (once UI is implemented)
3. Authorize application in Google OAuth consent screen
4. Verify redirect to dashboard with welcome message
5. Check database for new user and profile records

### Test OAuth Callback - Existing Account Linking

**Scenario**: User with existing email/password account signs in with Google using same email

```bash
# Step 1: Create email/password account
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "existing@example.com",
    "password": "SecurePass123!",
    "fullName": "Existing User"
  }'

# Step 2: Verify email (get token from logs/email)
# curl -X GET "http://localhost:3000/api/auth/verify-email?token_hash={token}&type=signup"

# Step 3: Sign in with Google using same email (manual test)
# Expected: Google account linked to existing user account
```

**Expected Behavior**:
- Existing user account is NOT duplicated
- Google provider linked to existing `auth.users` record
- `profiles.full_name` updated if it was null
- Auth events logged: `oauth_linked`, `login_success`
- User redirected to `/dashboard` (no welcome message)

**Verify Account Linking**:
```bash
# After OAuth login, check that both password and OAuth work for same account

# Login with password
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "existing@example.com",
    "password": "SecurePass123!"
  }' \
  -c password_session.txt

# Verify user data
curl -X GET http://localhost:3000/api/auth/user \
  -b password_session.txt | jq
```

### Test OAuth Callback - Error Scenarios

#### OAuth Authorization Denied

```bash
# Simulate user denying authorization
curl -X GET "http://localhost:3000/api/auth/callback/google?error=access_denied&error_description=User%20denied%20access" \
  -L \
  -v
```

**Expected Response**:
- 302 redirect to `/login?error=oauth_failed&message=User%20denied%20access`
- No user account created
- No auth events logged

#### Missing Authorization Code

```bash
# Callback without code parameter
curl -X GET "http://localhost:3000/api/auth/callback/google" \
  -L \
  -v
```

**Expected Response**:
- 302 redirect to `/login?error=oauth_failed&message=Invalid%20OAuth%20callback`
- Error logged to console

#### Malformed OAuth Response (Security Test)

This scenario tests the validation of OAuth responses per FR-043.

```bash
# Note: This test requires modifying the Google OAuth response (impossible via curl)
# Test manually by intercepting the OAuth callback in development tools
```

**Manual Test**:
1. Intercept OAuth callback in browser DevTools (Network tab)
2. Modify response to remove email field
3. Observe error handling

**Expected Behavior**:
- Email validation fails
- Security event logged to `auth_events` table with `security_alert: true`
- User redirected to login with error message
- No user account created

#### Invalid Email Format in OAuth Response

```bash
# Similar to above - requires OAuth response manipulation
# Verify email format validation catches malformed emails
```

**Expected Behavior**:
- Email regex validation fails
- Security event logged with `reason: 'invalid_email_format'`
- User shown validation error

### Verify OAuth Identity in Database

After successful OAuth login, verify the identity is stored correctly:

```bash
# Using Supabase SQL editor or psql
# Check auth.identities table for Google provider linkage
```

**SQL Query**:
```sql
-- Verify OAuth identity stored
SELECT
  u.id,
  u.email,
  i.provider,
  i.provider_id,
  i.identity_data,
  i.created_at
FROM auth.users u
JOIN auth.identities i ON i.user_id = u.id
WHERE u.email = 'test@example.com'
  AND i.provider = 'google';
```

**Expected Result**:
- One row returned with `provider = 'google'`
- `provider_id` contains Google user ID
- `identity_data` contains email, name, avatar_url
- `created_at` timestamp present

### Verify Auth Event Logging

Check that OAuth events are properly logged:

```bash
# Query auth_events table for OAuth-related events
```

**SQL Query**:
```sql
-- Check OAuth auth events
SELECT
  event_type,
  user_id,
  email,
  metadata,
  created_at
FROM auth_events
WHERE email = 'test@example.com'
  AND event_type IN ('signup_success', 'oauth_linked', 'login_success')
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Events** (new user):
1. `signup_success` with `metadata.method = 'oauth'` and `metadata.provider = 'google'`
2. `oauth_linked` with `metadata.provider = 'google'` and `metadata.provider_id`

**Expected Events** (existing user):
1. `oauth_linked` with `metadata.account_already_exists = true`
2. `login_success` with `metadata.method = 'oauth'`

### Test Profile Data Extraction

Verify user data is correctly extracted from Google OAuth response:

```bash
# After OAuth login, check profile data
```

**SQL Query**:
```sql
-- Verify profile data from OAuth
SELECT
  id,
  email,
  full_name,
  plan,
  created_at
FROM profiles
WHERE email = 'test@example.com';
```

**Expected**:
- `email` matches Google account email
- `full_name` populated from Google profile (if provided)
- `plan` set to `'free'` for new users
- `created_at` timestamp present

### Test Multiple OAuth Providers (Future)

When GitHub OAuth is implemented:

```bash
# Test linking multiple OAuth providers to same account
# 1. Sign in with Google
# 2. Sign in with GitHub using same email
# Expected: Both providers linked to same user
```

**SQL Query** (future):
```sql
-- Verify multiple OAuth providers linked
SELECT
  u.email,
  array_agg(i.provider) as linked_providers
FROM auth.users u
JOIN auth.identities i ON i.user_id = u.id
WHERE u.email = 'test@example.com'
GROUP BY u.email;
```

**Expected Result**:
```
email               | linked_providers
--------------------|------------------
test@example.com    | {google, github}
```

### Testing in Production

⚠️ **Important**: OAuth testing in production requires:

1. **Production OAuth Credentials**:
   - Create separate Google OAuth client for production
   - Add production redirect URI: `https://yourdomain.com/api/auth/callback/google`

2. **HTTPS Required**:
   - OAuth callbacks only work over HTTPS
   - Local testing can use `ngrok` or similar tunneling

3. **Test with Real Google Account**:
   - Create a test Google account
   - Verify end-to-end flow
   - Check all error scenarios

### Automated Testing (Playwright)

For E2E testing of OAuth flows:

```bash
# Run Playwright E2E tests for OAuth
npx playwright test tests/e2e/auth/oauth.spec.ts
```

**E2E Test Coverage**:
- ✅ New user OAuth signup
- ✅ Existing account linking
- ✅ OAuth error handling
- ✅ Profile data extraction
- ✅ Session persistence after OAuth login

### Troubleshooting OAuth

#### "OAuth callback failed"
- **Cause**: Invalid authorization code or expired code
- **Solution**: Code is single-use and expires in ~10 minutes. Initiate new OAuth flow

#### "Invalid OAuth callback"
- **Cause**: Missing `code` parameter in callback URL
- **Solution**: Verify Google OAuth configuration and redirect URI

#### "Validation failed"
- **Cause**: Google didn't return required email field
- **Solution**: Ensure email scope is requested in OAuth consent screen

#### "Account already exists"
- **Cause**: User trying to sign up with email that's already registered
- **Solution**: This is expected behavior - account linking should work automatically

#### Redirect loop
- **Cause**: Middleware not allowing OAuth callback route
- **Solution**: Ensure `/api/auth/callback/*` is excluded from auth middleware

### Security Considerations

🔒 **OAuth-Specific Security**:
- All OAuth responses validated for required fields
- Email format verified with regex
- Security events logged for malformed responses
- Single-use authorization codes enforced by Supabase
- CSRF protection via state parameter (handled by Supabase)

---

## 14. Testing Magic Link Passwordless Authentication

### Overview

Magic link authentication provides passwordless login via secure email links. Users receive a time-limited link (15 minutes) that automatically logs them in when clicked.

**Magic Link Flow**:
1. User enters email address
2. Backend sends magic link to email
3. User clicks link in email (within 15 minutes)
4. Backend verifies token and creates session
5. User redirected to dashboard

### Prerequisites

Ensure email sending is configured in Supabase:
1. **Supabase Dashboard** → Authentication → Email Templates → Magic Link
2. Test email delivery is working
3. Environment variables set (Supabase URL and keys)

### Test Magic Link Request - New User

**Scenario**: New user requests magic link (account auto-created)

```bash
curl -X POST http://localhost:3000/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com"
  }' \
  -v
```

**Expected Response (200)**:
```json
{
  "message": "Magic link sent successfully. Please check your email.",
  "expiresAt": "2025-11-02T12:15:00.000Z"
}
```

**Expected Behavior**:
- Magic link email sent to user
- Link valid for 15 minutes
- Rate limit: 5 requests per hour per email
- Auth event logged: `magic_link_sent`

### Test Magic Link Request - Existing User

**Scenario**: Existing user requests magic link

```bash
# First, create a user
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "existinguser@example.com",
    "password": "SecurePass123!",
    "fullName": "Existing User"
  }'

# Verify email (use token from email)

# Request magic link
curl -X POST http://localhost:3000/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{
    "email": "existinguser@example.com"
  }' \
  -v
```

**Expected Response (200)**:
```json
{
  "message": "Magic link sent successfully. Please check your email.",
  "expiresAt": "2025-11-02T12:15:00.000Z"
}
```

**Expected Behavior**:
- Magic link sent to existing user
- User can still log in with password while magic link is valid
- Account NOT duplicated

### Test Magic Link Validation Errors

#### Invalid Email Format

```bash
curl -X POST http://localhost:3000/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{
    "email": "not-an-email"
  }' \
  -v
```

**Expected Response (400)**:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request data",
  "details": [
    {
      "field": "email",
      "message": "Invalid email address"
    }
  ]
}
```

#### Missing Email Field

```bash
curl -X POST http://localhost:3000/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{}' \
  -v
```

**Expected Response (400)**:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request data",
  "details": [
    {
      "field": "email",
      "message": "Invalid email address"
    }
  ]
}
```

### Test Magic Link Rate Limiting

**Scenario**: Prevent abuse - 5 requests per hour per email

```bash
# Send 6 magic link requests in quick succession
for i in {1..6}; do
  echo "Magic link request $i:"
  curl -X POST http://localhost:3000/api/auth/magic-link \
    -H "Content-Type: application/json" \
    -d '{
      "email": "ratelimit@example.com"
    }' \
    -s | jq -r '.error // .message'
  echo ""
  sleep 1
done
```

**Expected Output**:
- First 5 requests: Success message
- 6th request: `RATE_LIMIT_EXCEEDED` error

**Response (429)** on 6th request:
```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many magic link requests. Please try again in an hour.",
  "retryAfter": 3600
}
```

**Rate Limit Headers** (on 429 response):
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2025-11-02T13:00:00.000Z
Retry-After: 3600
```

### Test Magic Link Callback - Successful Verification

**Scenario**: User clicks magic link in email

```bash
# Replace {token_hash} with actual token from magic link email
curl -X GET "http://localhost:3000/api/auth/magic-link/callback?token_hash={token_hash}&type=magiclink" \
  -L \
  -c magic_cookies.txt \
  -v
```

**Expected Behavior**:
- 302 redirect to `/dashboard`
- Session cookie set (HTTP-only, Secure)
- User authenticated
- Auth events logged: `magic_link_used`, `login_success`

**Verify Session Created**:
```bash
curl -X GET http://localhost:3000/api/auth/user \
  -b magic_cookies.txt | jq
```

**Expected Response (200)**:
```json
{
  "user": {
    "id": "uuid-here",
    "email": "newuser@example.com",
    "emailVerified": true,
    "fullName": null,
    "plan": "free",
    "createdAt": "2025-11-02T12:00:00.000Z"
  }
}
```

### Test Magic Link Callback - Error Scenarios

#### Expired Magic Link (> 15 minutes)

**Manual Test**:
1. Request magic link
2. Wait 16 minutes
3. Click link

```bash
# Simulate expired token
curl -X GET "http://localhost:3000/api/auth/magic-link/callback?token_hash=expired_token&type=magiclink" \
  -L \
  -v
```

**Expected Behavior**:
- 302 redirect to `/login?error=This%20magic%20link%20has%20expired...`
- No session created
- Auth event logged with `verification_failed: true`

**Error Message**:
```
This magic link has expired or is invalid. Please request a new one.
```

#### Reused Magic Link (Single-Use Enforcement)

**Test Single-Use Token**:
```bash
# Get token from email
TOKEN="your-token-hash-here"

# First use - should succeed
echo "=== First Use (Should Succeed) ==="
curl -X GET "http://localhost:3000/api/auth/magic-link/callback?token_hash=$TOKEN&type=magiclink" \
  -L \
  -c first_session.txt \
  -v

# Verify first login successful
curl -X GET http://localhost:3000/api/auth/user \
  -b first_session.txt | jq -r '.user.email // "Not authenticated"'

# Second use with same token - should fail
echo -e "\n=== Second Use (Should Fail) ==="
curl -X GET "http://localhost:3000/api/auth/magic-link/callback?token_hash=$TOKEN&type=magiclink" \
  -L \
  -v

# Cleanup
rm -f first_session.txt
```

**Expected**:
- First request: Successful authentication, redirect to dashboard
- Second request: Error redirect to login, token already used

**Error Message (Second Use)**:
```
This magic link has already been used. Please request a new one.
```

#### Invalid/Malformed Token

```bash
curl -X GET "http://localhost:3000/api/auth/magic-link/callback?token_hash=invalid_token_xyz&type=magiclink" \
  -L \
  -v
```

**Expected Behavior**:
- 302 redirect to `/login?error=This%20magic%20link%20has%20expired...`
- No session created

#### Missing Token Parameter

```bash
curl -X GET "http://localhost:3000/api/auth/magic-link/callback?type=magiclink" \
  -L \
  -v
```

**Expected Behavior**:
- 302 redirect to `/login?error=Invalid%20or%20missing%20magic%20link%20token`

#### Wrong Token Type

```bash
curl -X GET "http://localhost:3000/api/auth/magic-link/callback?token_hash={token}&type=signup" \
  -L \
  -v
```

**Expected Behavior**:
- 302 redirect to `/login?error=Invalid%20or%20missing%20magic%20link%20token`

### Test Complete Magic Link Flow

**End-to-End Test Script**:

```bash
#!/bin/bash

EMAIL="magictest@example.com"

echo "=== Step 1: Request Magic Link ==="
curl -X POST http://localhost:3000/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\"
  }" | jq

echo -e "\n=== Step 2: Check Email for Magic Link ==="
echo "Manual step: Check email inbox for magic link"
echo "Extract the token_hash from the URL"
echo "Magic link format: http://localhost:3000/api/auth/magic-link/callback?token_hash=XXX&type=magiclink"

echo -e "\n=== Step 3: Click Magic Link (Paste token below) ==="
read -p "Enter token_hash from email: " TOKEN

curl -X GET "http://localhost:3000/api/auth/magic-link/callback?token_hash=$TOKEN&type=magiclink" \
  -L \
  -c magic_session.txt \
  -v

echo -e "\n=== Step 4: Verify Authentication ==="
curl -X GET http://localhost:3000/api/auth/user \
  -b magic_session.txt | jq

echo -e "\n=== Step 5: Verify User Can Access Protected Resources ==="
# Test access to a protected route (replace with actual protected route)
curl -X GET http://localhost:3000/api/screenshots \
  -b magic_session.txt | jq

echo -e "\n=== Step 6: Logout ==="
curl -X POST http://localhost:3000/api/auth/signout \
  -b magic_session.txt | jq

# Cleanup
rm -f magic_session.txt

echo -e "\n=== Test Complete ==="
```

**Save as `test_magic_link.sh` and run**: `bash test_magic_link.sh`

### Test Concurrent Sessions with Magic Link

**Scenario**: Magic link login doesn't disrupt existing sessions

```bash
# Login from Device 1 with password
echo "=== Device 1: Password Login ==="
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }' \
  -c device1_cookies.txt

# Verify Device 1 session works
curl -X GET http://localhost:3000/api/auth/user \
  -b device1_cookies.txt | jq -r '.user.email'

# Request magic link and use it on Device 2
echo -e "\n=== Device 2: Request Magic Link ==="
curl -X POST http://localhost:3000/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'

echo "Click magic link and save session as device2_cookies.txt"
# Simulate: curl -X GET "http://localhost:3000/api/auth/magic-link/callback?token_hash={token}&type=magiclink" \
#   -L -c device2_cookies.txt

# Verify both sessions still work
echo -e "\n=== Verify Both Sessions Active ==="
echo "Device 1 (password):"
curl -X GET http://localhost:3000/api/auth/user \
  -b device1_cookies.txt | jq -r '.user.email'

echo "Device 2 (magic link):"
curl -X GET http://localhost:3000/api/auth/user \
  -b device2_cookies.txt | jq -r '.user.email'

# Cleanup
rm -f device1_cookies.txt device2_cookies.txt
```

**Expected**: Both sessions remain active independently.

### Test Account Auto-Creation

**Scenario**: New email automatically creates account

```bash
# Request magic link for email that doesn't exist
curl -X POST http://localhost:3000/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{
    "email": "brandnew@example.com"
  }' | jq

# Click magic link (get token from email)
curl -X GET "http://localhost:3000/api/auth/magic-link/callback?token_hash={token}&type=magiclink" \
  -L \
  -c new_user_session.txt

# Verify account was created
curl -X GET http://localhost:3000/api/auth/user \
  -b new_user_session.txt | jq
```

**Expected Response**:
```json
{
  "user": {
    "id": "uuid-here",
    "email": "brandnew@example.com",
    "emailVerified": true,
    "fullName": null,
    "plan": "free",
    "createdAt": "2025-11-02T12:00:00.000Z"
  }
}
```

**Verify in Database**:
```sql
-- Check both auth.users and profiles created
SELECT
  u.id,
  u.email,
  u.email_confirmed_at,
  p.plan,
  p.full_name
FROM auth.users u
JOIN profiles p ON p.id = u.id
WHERE u.email = 'brandnew@example.com';
```

**Expected**: Account exists in both `auth.users` and `profiles` tables.

### Test Email Delivery Retry (Exponential Backoff)

**Note**: This test requires simulating transient email delivery failures.

**Behavior**:
- Attempt 1: Immediate (0s delay)
- Attempt 2: After 2 minutes
- Attempt 3: After 5 minutes
- Total max attempts: 3

**Manual Test**:
1. Temporarily break email configuration in Supabase
2. Request magic link
3. Check server logs for retry attempts
4. Fix email configuration
5. Verify link eventually sends

**Log Output (Expected)**:
```
Magic link send attempt 1 failed: network timeout
Magic link send attempt 2 failed: network timeout
Magic link send attempt 3 succeeded
```

### Verify Auth Event Logging

**Check magic link events in database**:

```sql
-- Query auth_events for magic link events
SELECT
  event_type,
  user_id,
  email,
  metadata,
  created_at
FROM auth_events
WHERE email = 'test@example.com'
  AND event_type IN ('magic_link_sent', 'magic_link_used', 'login_success')
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Events**:

1. **magic_link_sent**:
   ```json
   {
     "expires_at": "2025-11-02T12:15:00.000Z",
     "email_delivery_attempts": 1
   }
   ```

2. **magic_link_used**:
   ```json
   {
     "link_age_seconds": 0,
     "account_created": false
   }
   ```

3. **login_success**:
   ```json
   {
     "method": "magic_link"
   }
   ```

### Performance Testing

#### Test Response Time

```bash
# Measure magic link request time
time curl -X POST http://localhost:3000/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{
    "email": "performance@example.com"
  }' \
  -s -o /dev/null -w "HTTP %{http_code}, Time: %{time_total}s\n"
```

**Expected**: < 2 seconds for magic link request

#### Test Callback Performance

```bash
# Measure callback verification time
time curl -X GET "http://localhost:3000/api/auth/magic-link/callback?token_hash={token}&type=magiclink" \
  -L \
  -s -o /dev/null -w "HTTP %{http_code}, Time: %{time_total}s\n"
```

**Expected**: < 500ms for callback verification

### Security Considerations

🔒 **Magic Link Security**:
- Tokens expire after 15 minutes (enforced by Supabase)
- Single-use tokens (automatically invalidated after use)
- Rate limiting (5 requests/hour per email)
- HTTPS required in production
- Email delivery retry with exponential backoff
- Comprehensive audit logging

### Troubleshooting Magic Links

#### "Magic link not received"
- **Cause**: Email delivery failure or spam filter
- **Solution**: Check spam folder, verify email configuration in Supabase dashboard
- **Debug**: Check auth_events table for `magic_link_sent` event with delivery status

#### "Magic link expired"
- **Cause**: Link clicked after 15 minutes
- **Solution**: Request new magic link
- **Prevention**: Check email quickly after requesting

#### "Magic link already used"
- **Cause**: Attempting to reuse a single-use token
- **Solution**: Request new magic link
- **Note**: This is expected security behavior

#### "Rate limit exceeded"
- **Cause**: More than 5 magic link requests in 1 hour
- **Solution**: Wait until rate limit resets
- **Debug**: Check X-RateLimit-Reset header for reset time

#### "Email delivery failed"
- **Cause**: Transient network issues or misconfigured SMTP
- **Solution**: System automatically retries 3 times with exponential backoff
- **Manual fix**: Verify Supabase email settings

### Automated Testing (Unit Tests)

**Example Jest/Vitest test**:

```typescript
describe('POST /api/auth/magic-link', () => {
  it('should send magic link for valid email', async () => {
    const response = await request(app)
      .post('/api/auth/magic-link')
      .send({ email: 'test@example.com' });

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('Magic link sent');
    expect(response.body.expiresAt).toBeDefined();
  });

  it('should rate limit after 5 requests', async () => {
    const email = 'ratelimit@example.com';

    // Send 5 successful requests
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/magic-link')
        .send({ email });
    }

    // 6th request should be rate limited
    const response = await request(app)
      .post('/api/auth/magic-link')
      .send({ email });

    expect(response.status).toBe(429);
    expect(response.body.error).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('should reject invalid email format', async () => {
    const response = await request(app)
      .post('/api/auth/magic-link')
      .send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
  });
});
```

---

## Security Notes

⚠️ **DO NOT** use these curl commands with production credentials or on public networks without HTTPS.

✅ **DO** test in local development environment with test accounts.

✅ **DO** verify HTTPS is enabled before testing in production.

---

**Happy Testing! 🚀**
