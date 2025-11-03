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
14. [Testing Magic Link Passwordless Authentication](#14-testing-magic-link-passwordless-authentication)
15. [Testing Account Deletion](#15-testing-account-deletion-priority-p3---gdprccpa-compliance)
16. [Testing Screenshot Upload API](#16-testing-screenshot-upload-api)

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

## 15. Testing Account Deletion (Priority: P3 - GDPR/CCPA Compliance)

### Overview

Account deletion permanently removes all user data from the system for privacy compliance. This is an irreversible operation that requires multiple verification steps.

**Account Deletion Flow**:
1. User initiates deletion request
2. System verifies user session
3. Password verification (email/password users) OR OAuth re-authentication (OAuth-only users)
4. User confirms with phrase "DELETE MY ACCOUNT"
5. System cancels active Stripe subscriptions
6. System deletes all user data (screenshots, profile, usage records)
7. System deletes auth account
8. Confirmation email sent
9. User signed out

### Prerequisites

- Active authenticated session (cookies from login)
- Valid password (for email/password accounts)
- No pending Stripe payments (optional, but recommended)

### Test Account Deletion - Email/Password User

**Scenario**: User with email/password account deletes their account

```bash
# Step 1: Login to get session cookies
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "deleteme@example.com",
    "password": "SecurePass123!"
  }' \
  -c deletion_cookies.txt

# Step 2: Request account deletion
curl -X DELETE http://localhost:3000/api/auth/account \
  -H "Content-Type: application/json" \
  -b deletion_cookies.txt \
  -d '{
    "password": "SecurePass123!",
    "confirmation": "DELETE MY ACCOUNT"
  }' \
  -v
```

**Expected Response (200)**:
```json
{
  "message": "Account successfully deleted. You will receive a confirmation email shortly."
}
```

**Expected Behavior**:
- ✅ Active Stripe subscription cancelled (if exists)
- ✅ Stripe customer marked as deleted with metadata
- ✅ All screenshots deleted from storage bucket
- ✅ Profile record deleted from `profiles` table
- ✅ Monthly usage records deleted
- ✅ Auth events anonymized (user_id → NULL)
- ✅ User deleted from `auth.users` table
- ✅ Auth events logged: `account_deleted`
- ✅ Confirmation email sent (TODO: implement)
- ✅ Session invalidated (user signed out)
- ✅ Email becomes available for re-registration

**Verify Deletion**:
```bash
# Try to access user endpoint (should fail)
curl -X GET http://localhost:3000/api/auth/user \
  -b deletion_cookies.txt

# Expected: 401 Unauthorized

# Try to login with deleted account credentials (should fail)
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "deleteme@example.com",
    "password": "SecurePass123!"
  }'

# Expected: 401 Invalid credentials

# Cleanup
rm -f deletion_cookies.txt
```

### Test Account Deletion - OAuth-Only User

**Scenario**: User who signed up with Google OAuth deletes their account

```bash
# Step 1: Login via OAuth (manual browser test)
# Navigate to: http://localhost:3000/login
# Click "Sign in with Google"
# Save cookies to oauth_deletion_cookies.txt

# Step 2: Request account deletion (OAuth users still need password field)
curl -X DELETE http://localhost:3000/api/auth/account \
  -H "Content-Type: application/json" \
  -b oauth_deletion_cookies.txt \
  -d '{
    "password": "unused-for-oauth",
    "confirmation": "DELETE MY ACCOUNT"
  }' \
  -v
```

**Expected Response (200)**:
```json
{
  "message": "Account successfully deleted. You will receive a confirmation email shortly."
}
```

**Expected Behavior**:
- OAuth identity removed from `auth.identities` table
- All other data deleted (same as email/password user)

### Test Account Deletion - Validation Errors

#### Missing Confirmation Phrase

```bash
curl -X DELETE http://localhost:3000/api/auth/account \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "password": "SecurePass123!",
    "confirmation": "delete my account"
  }' \
  -v
```

**Expected Response (400)**:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid input",
  "details": [
    {
      "field": "confirmation",
      "message": "You must type \"DELETE MY ACCOUNT\" to confirm"
    }
  ]
}
```

#### Wrong Confirmation Phrase

```bash
curl -X DELETE http://localhost:3000/api/auth/account \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "password": "SecurePass123!",
    "confirmation": "I want to delete"
  }' \
  -v
```

**Expected Response (400)**:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid input",
  "details": [
    {
      "field": "confirmation",
      "message": "You must type \"DELETE MY ACCOUNT\" to confirm"
    }
  ]
}
```

#### Missing Password

```bash
curl -X DELETE http://localhost:3000/api/auth/account \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "confirmation": "DELETE MY ACCOUNT"
  }' \
  -v
```

**Expected Response (400)**:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid input",
  "details": [
    {
      "field": "password",
      "message": "Password is required for account deletion"
    }
  ]
}
```

#### Invalid Password

```bash
curl -X DELETE http://localhost:3000/api/auth/account \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "password": "WrongPassword123!",
    "confirmation": "DELETE MY ACCOUNT"
  }' \
  -v
```

**Expected Response (403)**:
```json
{
  "error": "INVALID_PASSWORD",
  "message": "Invalid password. Please try again."
}
```

**Expected Behavior**:
- Failed deletion attempt logged to `auth_events`
- Account NOT deleted
- User remains logged in

### Test Account Deletion - Unauthorized Access

#### Not Logged In

```bash
curl -X DELETE http://localhost:3000/api/auth/account \
  -H "Content-Type: application/json" \
  -d '{
    "password": "SecurePass123!",
    "confirmation": "DELETE MY ACCOUNT"
  }' \
  -v
```

**Expected Response (401)**:
```json
{
  "error": "UNAUTHORIZED",
  "message": "You must be logged in to delete your account"
}
```

### Test Complete Account Deletion Flow

**End-to-End Test Script**:

```bash
#!/bin/bash

TEST_EMAIL="deletion-test@example.com"
TEST_PASSWORD="TestDelete123!"

echo "=== Complete Account Deletion Flow Test ==="
echo ""

# Step 1: Create a test account
echo "=== Step 1: Create Test Account ==="
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"fullName\": \"Deletion Test User\"
  }" | jq

# Step 2: Verify email (manual or use token from logs)
echo -e "\n=== Step 2: Verify Email ==="
echo "Manual step: Click verification link in email"
echo "Or use: curl -X GET 'http://localhost:3000/api/auth/verify-email?token_hash={token}&type=signup'"

read -p "Press enter after email is verified..."

# Step 3: Login
echo -e "\n=== Step 3: Login ==="
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }" \
  -c deletion_test_cookies.txt | jq

# Step 4: Verify account exists
echo -e "\n=== Step 4: Verify Account Exists ==="
curl -X GET http://localhost:3000/api/auth/user \
  -b deletion_test_cookies.txt | jq

# Step 5: Attempt deletion with wrong password (should fail)
echo -e "\n=== Step 5: Test Wrong Password (Should Fail) ==="
curl -X DELETE http://localhost:3000/api/auth/account \
  -H "Content-Type: application/json" \
  -b deletion_test_cookies.txt \
  -d '{
    "password": "WrongPassword123!",
    "confirmation": "DELETE MY ACCOUNT"
  }' | jq

# Step 6: Attempt deletion with wrong confirmation (should fail)
echo -e "\n=== Step 6: Test Wrong Confirmation (Should Fail) ==="
curl -X DELETE http://localhost:3000/api/auth/account \
  -H "Content-Type: application/json" \
  -b deletion_test_cookies.txt \
  -d "{
    \"password\": \"$TEST_PASSWORD\",
    \"confirmation\": \"delete my account\"
  }" | jq

# Step 7: Delete account successfully
echo -e "\n=== Step 7: Delete Account Successfully ==="
curl -X DELETE http://localhost:3000/api/auth/account \
  -H "Content-Type: application/json" \
  -b deletion_test_cookies.txt \
  -d "{
    \"password\": \"$TEST_PASSWORD\",
    \"confirmation\": \"DELETE MY ACCOUNT\"
  }" | jq

# Step 8: Verify account deleted (should get 401)
echo -e "\n=== Step 8: Verify Account Deleted ==="
curl -X GET http://localhost:3000/api/auth/user \
  -b deletion_test_cookies.txt | jq

# Step 9: Verify cannot login with deleted credentials
echo -e "\n=== Step 9: Verify Cannot Login ==="
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }" | jq

# Step 10: Verify email is available for re-registration
echo -e "\n=== Step 10: Verify Email Available for Re-registration ==="
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"fullName\": \"Re-registered User\"
  }" | jq

# Cleanup
rm -f deletion_test_cookies.txt

echo -e "\n=== Test Complete ==="
```

**Save as `test_account_deletion.sh` and run**: `bash test_account_deletion.sh`

### Verify Data Deletion in Database

After deleting an account, verify all data is removed:

```sql
-- Check user removed from auth.users
SELECT * FROM auth.users WHERE email = 'deleteme@example.com';
-- Expected: 0 rows

-- Check profile removed
SELECT * FROM profiles WHERE email = 'deleteme@example.com';
-- Expected: 0 rows

-- Check screenshots removed
SELECT * FROM screenshots WHERE user_id = '{deleted_user_id}';
-- Expected: 0 rows

-- Check monthly_usage removed
SELECT * FROM monthly_usage WHERE user_id = '{deleted_user_id}';
-- Expected: 0 rows

-- Check auth_events anonymized (user_id should be NULL)
SELECT * FROM auth_events
WHERE email = 'deleteme@example.com'
  AND event_type = 'account_deleted';
-- Expected: user_id = NULL, event exists for audit trail

-- Check OAuth identities removed
SELECT * FROM auth.identities WHERE user_id = '{deleted_user_id}';
-- Expected: 0 rows
```

### Test Stripe Integration

**Scenario**: User with active subscription deletes account

```bash
# Prerequisites: User must have active Stripe subscription
# Test account: premium@example.com with Pro plan

# Step 1: Login
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "premium@example.com",
    "password": "SecurePass123!"
  }' \
  -c premium_cookies.txt

# Step 2: Verify subscription exists (check Stripe dashboard)

# Step 3: Delete account
curl -X DELETE http://localhost:3000/api/auth/account \
  -H "Content-Type: application/json" \
  -b premium_cookies.txt \
  -d '{
    "password": "SecurePass123!",
    "confirmation": "DELETE MY ACCOUNT"
  }' | jq

# Step 4: Verify in Stripe dashboard:
# - Subscription cancelled
# - Customer metadata includes: deleted_at, deleted_by='user', reason='account_deletion'
# - Customer NOT deleted (kept for audit trail)

# Cleanup
rm -f premium_cookies.txt
```

**Expected Stripe Behavior**:
- Subscription status: `cancelled`
- Prorated refund issued (if applicable)
- Customer record preserved with deletion metadata
- No new charges will occur

### Test Storage Cleanup

**Scenario**: User with uploaded screenshots deletes account

```bash
# Prerequisites: User must have screenshots in storage

# Before deletion: Note screenshot count
echo "=== Screenshots Before Deletion ==="
# Use Supabase dashboard or SQL to check screenshot count

# Delete account
curl -X DELETE http://localhost:3000/api/auth/account \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "password": "SecurePass123!",
    "confirmation": "DELETE MY ACCOUNT"
  }' | jq

# After deletion: Verify screenshots removed from storage bucket
echo "=== Verify Screenshots Deleted ==="
# Check Supabase Storage dashboard - files should be gone
```

**Verify in Supabase Dashboard**:
1. Navigate to Storage → screenshots bucket
2. Search for user's files by storage_path
3. Confirm files no longer exist

### Test Concurrent Deletion Attempts

**Scenario**: Prevent race conditions with concurrent deletion requests

```bash
# Login
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "concurrent@example.com",
    "password": "SecurePass123!"
  }' \
  -c concurrent_cookies.txt

# Send two deletion requests simultaneously
echo "=== Concurrent Deletion Attempt 1 ===" &
curl -X DELETE http://localhost:3000/api/auth/account \
  -H "Content-Type: application/json" \
  -b concurrent_cookies.txt \
  -d '{
    "password": "SecurePass123!",
    "confirmation": "DELETE MY ACCOUNT"
  }' | jq &

echo "=== Concurrent Deletion Attempt 2 ===" &
curl -X DELETE http://localhost:3000/api/auth/account \
  -H "Content-Type: application/json" \
  -b concurrent_cookies.txt \
  -d '{
    "password": "SecurePass123!",
    "confirmation": "DELETE MY ACCOUNT"
  }' | jq &

wait

# Cleanup
rm -f concurrent_cookies.txt
```

**Expected Behavior**:
- First request: Success (200)
- Second request: Unauthorized (401) or success (idempotent)
- No duplicate deletions
- No orphaned records

### Test Error Recovery

#### Stripe API Failure

**Manual Test**: Temporarily break Stripe API key

```bash
# Set invalid Stripe key in .env.local
STRIPE_SECRET_KEY=invalid_key

# Attempt deletion
curl -X DELETE http://localhost:3000/api/auth/account \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "password": "SecurePass123!",
    "confirmation": "DELETE MY ACCOUNT"
  }' | jq
```

**Expected Behavior**:
- Deletion continues despite Stripe failure
- Error logged to console
- Account still deleted
- Manual Stripe cleanup may be needed

#### Storage API Failure

**Expected Behavior**:
- Files may be orphaned in storage
- Account deletion completes
- Manual cleanup required for orphaned files

### Performance Testing

#### Test Deletion Speed

```bash
# Measure deletion time
time curl -X DELETE http://localhost:3000/api/auth/account \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "password": "SecurePass123!",
    "confirmation": "DELETE MY ACCOUNT"
  }' \
  -s -o /dev/null -w "HTTP %{http_code}, Time: %{time_total}s\n"
```

**Expected**: < 5 seconds for complete deletion (including Stripe, storage, database)

### Security Considerations

🔒 **Account Deletion Security**:
- Requires active authenticated session
- Password re-verification (email/password users)
- OAuth re-authentication check (OAuth-only users)
- Explicit confirmation phrase required
- Irreversible operation (no undo)
- Comprehensive audit logging
- Email confirmation sent after deletion

### Troubleshooting Account Deletion

#### "Unauthorized"
- **Cause**: Not logged in or session expired
- **Solution**: Login again and retry deletion

#### "Invalid password"
- **Cause**: Wrong password provided
- **Solution**: Verify password is correct
- **Note**: Failed attempts are logged for security

#### "Deletion failed"
- **Cause**: Critical database operation failed
- **Solution**: Contact support
- **Debug**: Check server logs for specific error

#### "Stripe cancellation failed"
- **Cause**: Stripe API error or invalid subscription
- **Solution**: Deletion continues, manually cancel in Stripe dashboard
- **Prevention**: Ensure Stripe keys are valid

#### Email still in use
- **Cause**: Deletion may be in progress or failed partway
- **Solution**: Wait 5 minutes and try re-registration
- **Debug**: Check database for orphaned records

### Automated Testing (Unit Tests)

**Example Jest/Vitest test**:

```typescript
describe('DELETE /api/auth/account', () => {
  it('should delete account with valid password and confirmation', async () => {
    // Setup: Create user and login
    const user = await createTestUser();
    const session = await loginTestUser(user);

    const response = await request(app)
      .delete('/api/auth/account')
      .set('Cookie', session.cookies)
      .send({
        password: 'SecurePass123!',
        confirmation: 'DELETE MY ACCOUNT'
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('successfully deleted');

    // Verify user no longer exists
    const { data } = await supabase.auth.admin.getUserById(user.id);
    expect(data.user).toBeNull();
  });

  it('should reject deletion with wrong password', async () => {
    const session = await loginTestUser();

    const response = await request(app)
      .delete('/api/auth/account')
      .set('Cookie', session.cookies)
      .send({
        password: 'WrongPassword123!',
        confirmation: 'DELETE MY ACCOUNT'
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('INVALID_PASSWORD');
  });

  it('should reject deletion without confirmation phrase', async () => {
    const session = await loginTestUser();

    const response = await request(app)
      .delete('/api/auth/account')
      .set('Cookie', session.cookies)
      .send({
        password: 'SecurePass123!',
        confirmation: 'delete my account'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('VALIDATION_ERROR');
  });

  it('should cancel Stripe subscription before deletion', async () => {
    const user = await createTestUserWithSubscription();
    const session = await loginTestUser(user);

    await request(app)
      .delete('/api/auth/account')
      .set('Cookie', session.cookies)
      .send({
        password: 'SecurePass123!',
        confirmation: 'DELETE MY ACCOUNT'
      });

    // Verify subscription cancelled
    const subscription = await stripe.subscriptions.retrieve(
      user.stripe_subscription_id
    );
    expect(subscription.status).toBe('canceled');
  });

  it('should delete all user screenshots from storage', async () => {
    const user = await createTestUserWithScreenshots(3);
    const session = await loginTestUser(user);

    await request(app)
      .delete('/api/auth/account')
      .set('Cookie', session.cookies)
      .send({
        password: 'SecurePass123!',
        confirmation: 'DELETE MY ACCOUNT'
      });

    // Verify screenshots deleted
    const { data } = await supabase
      .from('screenshots')
      .select('*')
      .eq('user_id', user.id);

    expect(data).toHaveLength(0);
  });

  it('should make email available for re-registration', async () => {
    const email = 'reuse@example.com';
    const user = await createTestUser({ email });
    const session = await loginTestUser(user);

    // Delete account
    await request(app)
      .delete('/api/auth/account')
      .set('Cookie', session.cookies)
      .send({
        password: 'SecurePass123!',
        confirmation: 'DELETE MY ACCOUNT'
      });

    // Try to register with same email
    const response = await request(app)
      .post('/api/auth/signup')
      .send({
        email,
        password: 'NewPassword123!',
        fullName: 'New User'
      });

    expect(response.status).toBe(200);
  });
});
```

---

## 16. Testing Screenshot Upload API

### Overview

The screenshot upload API provides a two-phase upload process:
1. **Initialize upload** (`POST /api/upload/init`) - Validates quota and generates signed upload URL
2. **Complete upload** (`POST /api/upload/[uploadSessionId]/complete`) - Finalizes upload and creates screenshot record

**Upload Flow**:
1. Client requests upload initialization with file metadata
2. Server validates quota and returns signed URL
3. Client uploads file directly to Supabase Storage using signed URL
4. Client completes upload with file hash and dimensions
5. Server creates screenshot record and returns share URL

### Prerequisites

- Active authenticated session (cookies from login)
- Valid user account with upload quota
- File meeting requirements:
  - Size: ≤ 10 MB
  - Type: PNG, JPEG, WEBP, or GIF

### Test Initialize Upload - Success

**Scenario**: User with available quota initializes upload

```bash
# Step 1: Login to get session cookies
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }' \
  -c upload_cookies.txt

# Step 2: Initialize upload
curl -X POST http://localhost:3000/api/upload/init \
  -H "Content-Type: application/json" \
  -b upload_cookies.txt \
  -d '{
    "filename": "screenshot.png",
    "fileSize": 524288,
    "mimeType": "image/png"
  }' \
  -v
```

**Expected Response (200)**:
```json
{
  "uploadSessionId": "uuid-here",
  "signedUrl": "https://iitxfjhnywekstxagump.supabase.co/storage/v1/object/upload/...",
  "token": "signed-token-here",
  "storagePath": "user-id/2025/11/temp-1234567890.png",
  "expiresAt": "2025-11-03T13:00:00.000Z",
  "quota": {
    "plan": "free",
    "limit": 10,
    "used": 5,
    "remaining": 5
  }
}
```

**Expected Behavior**:
- ✅ Quota checked and remaining quota returned
- ✅ Signed upload URL generated (valid for 1 hour)
- ✅ Upload session created in `upload_sessions` table
- ✅ Session status: `pending`

### Test Initialize Upload - Quota Exceeded

**Scenario**: Free user has reached monthly upload limit

```bash
# Assuming user has already uploaded 10 screenshots this month
curl -X POST http://localhost:3000/api/upload/init \
  -H "Content-Type: application/json" \
  -b upload_cookies.txt \
  -d '{
    "filename": "screenshot.png",
    "fileSize": 524288,
    "mimeType": "image/png"
  }' \
  -v
```

**Expected Response (403)**:
```json
{
  "error": "Monthly upload quota exceeded",
  "quota": {
    "plan": "free",
    "limit": 10,
    "used": 10,
    "remaining": 0
  },
  "upgrade": {
    "message": "Upgrade to Pro for unlimited uploads",
    "url": "/pricing"
  }
}
```

### Test Initialize Upload - Validation Errors

#### File Too Large

```bash
curl -X POST http://localhost:3000/api/upload/init \
  -H "Content-Type: application/json" \
  -b upload_cookies.txt \
  -d '{
    "filename": "large-screenshot.png",
    "fileSize": 15728640,
    "mimeType": "image/png"
  }' \
  -v
```

**Expected Response (413)**:
```json
{
  "error": "File size exceeds maximum allowed size of 10MB",
  "maxSize": 10485760
}
```

#### Invalid MIME Type

```bash
curl -X POST http://localhost:3000/api/upload/init \
  -H "Content-Type: application/json" \
  -b upload_cookies.txt \
  -d '{
    "filename": "document.pdf",
    "fileSize": 524288,
    "mimeType": "application/pdf"
  }' \
  -v
```

**Expected Response (400)**:
```json
{
  "error": "Invalid file type. Allowed types: PNG, JPEG, WEBP, GIF",
  "allowedTypes": [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif"
  ]
}
```

#### Missing Required Fields

```bash
curl -X POST http://localhost:3000/api/upload/init \
  -H "Content-Type: application/json" \
  -b upload_cookies.txt \
  -d '{
    "filename": "screenshot.png"
  }' \
  -v
```

**Expected Response (400)**:
```json
{
  "error": "Missing required fields: filename, fileSize, mimeType"
}
```

### Test Initialize Upload - Unauthenticated

```bash
curl -X POST http://localhost:3000/api/upload/init \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "screenshot.png",
    "fileSize": 524288,
    "mimeType": "image/png"
  }' \
  -v
```

**Expected Response (401)**:
```json
{
  "error": "Unauthorized. Please sign in to upload screenshots."
}
```

### Test Complete Upload - Success

**Scenario**: User completes upload after file is in storage

```bash
# Step 1: Initialize upload (save uploadSessionId from response)
UPLOAD_SESSION_ID=$(curl -X POST http://localhost:3000/api/upload/init \
  -H "Content-Type: application/json" \
  -b upload_cookies.txt \
  -d '{
    "filename": "screenshot.png",
    "fileSize": 524288,
    "mimeType": "image/png"
  }' | jq -r '.uploadSessionId')

# Step 2: Upload file to signed URL (simulated - in real flow, client does this)
# curl -X PUT "<signedUrl>" --upload-file screenshot.png

# Step 3: Complete upload
curl -X POST "http://localhost:3000/api/upload/$UPLOAD_SESSION_ID/complete" \
  -H "Content-Type: application/json" \
  -b upload_cookies.txt \
  -d '{
    "fileHash": "a1b2c3d4e5f6",
    "width": 1920,
    "height": 1080,
    "sharingMode": "public"
  }' \
  -v
```

**Expected Response (201)**:
```json
{
  "message": "Upload completed successfully",
  "screenshot": {
    "id": "uuid-here",
    "shortId": "aBcD123",
    "shareUrl": "http://localhost:3000/aBcD123",
    "storagePath": "user-id/2025/11/a1b2c3d4e5f6-1234567890.png",
    "expiresAt": "2025-12-03T12:00:00.000Z",
    "sharingMode": "public",
    "width": 1920,
    "height": 1080,
    "fileSize": 524288,
    "createdAt": "2025-11-03T12:00:00.000Z"
  }
}
```

**Expected Behavior**:
- ✅ Screenshot record created in `screenshots` table
- ✅ Upload session status updated to `completed`
- ✅ Short ID generated for sharing
- ✅ Monthly usage incremented
- ✅ Expiration date set (30 days for free users, none for pro users)

### Test Complete Upload - Duplicate File

**Scenario**: User uploads same file twice (same hash)

```bash
curl -X POST "http://localhost:3000/api/upload/$UPLOAD_SESSION_ID/complete" \
  -H "Content-Type: application/json" \
  -b upload_cookies.txt \
  -d '{
    "fileHash": "existing-hash-123",
    "width": 1920,
    "height": 1080,
    "sharingMode": "public"
  }' \
  -v
```

**Expected Response (200)**:
```json
{
  "message": "File already exists",
  "screenshot": {
    "id": "existing-uuid",
    "shortId": "aBcD123",
    "shareUrl": "http://localhost:3000/aBcD123"
  },
  "duplicate": true
}
```

**Expected Behavior**:
- No new screenshot record created
- Returns existing screenshot details
- No quota consumed

### Test Complete Upload - With Password Protection

**Scenario**: User uploads screenshot with password protection

```bash
curl -X POST "http://localhost:3000/api/upload/$UPLOAD_SESSION_ID/complete" \
  -H "Content-Type: application/json" \
  -b upload_cookies.txt \
  -d '{
    "fileHash": "a1b2c3d4e5f6",
    "width": 1920,
    "height": 1080,
    "sharingMode": "password",
    "password": "SecureScreenshot123!"
  }' \
  -v
```

**Expected Response (201)**:
```json
{
  "message": "Upload completed successfully",
  "screenshot": {
    "id": "uuid-here",
    "shortId": "aBcD123",
    "shareUrl": "http://localhost:3000/aBcD123",
    "storagePath": "user-id/2025/11/a1b2c3d4e5f6-1234567890.png",
    "expiresAt": null,
    "sharingMode": "password",
    "width": 1920,
    "height": 1080,
    "fileSize": 524288,
    "createdAt": "2025-11-03T12:00:00.000Z"
  }
}
```

**Expected Behavior**:
- Password hashed with bcrypt (10 rounds)
- `is_public` set to `false`
- Password required to view screenshot

### Test Complete Upload - With Custom Expiration

**Scenario**: User uploads screenshot with custom expiration time

```bash
curl -X POST "http://localhost:3000/api/upload/$UPLOAD_SESSION_ID/complete" \
  -H "Content-Type: application/json" \
  -b upload_cookies.txt \
  -d '{
    "fileHash": "a1b2c3d4e5f6",
    "width": 1920,
    "height": 1080,
    "sharingMode": "public",
    "expiresIn": 86400
  }' \
  -v
```

**Expected Response (201)**:
```json
{
  "message": "Upload completed successfully",
  "screenshot": {
    "id": "uuid-here",
    "shortId": "aBcD123",
    "shareUrl": "http://localhost:3000/aBcD123",
    "storagePath": "user-id/2025/11/a1b2c3d4e5f6-1234567890.png",
    "expiresAt": "2025-11-04T12:00:00.000Z",
    "sharingMode": "public",
    "width": 1920,
    "height": 1080,
    "fileSize": 524288,
    "createdAt": "2025-11-03T12:00:00.000Z"
  }
}
```

**Note**: `expiresIn` is in seconds. Example: 86400 = 24 hours.

### Test Complete Upload - Validation Errors

#### Missing Required Fields

```bash
curl -X POST "http://localhost:3000/api/upload/$UPLOAD_SESSION_ID/complete" \
  -H "Content-Type: application/json" \
  -b upload_cookies.txt \
  -d '{
    "fileHash": "a1b2c3d4e5f6"
  }' \
  -v
```

**Expected Response (400)**:
```json
{
  "error": "Missing required fields: fileHash, width, height"
}
```

#### Password Required for Password Mode

```bash
curl -X POST "http://localhost:3000/api/upload/$UPLOAD_SESSION_ID/complete" \
  -H "Content-Type: application/json" \
  -b upload_cookies.txt \
  -d '{
    "fileHash": "a1b2c3d4e5f6",
    "width": 1920,
    "height": 1080,
    "sharingMode": "password"
  }' \
  -v
```

**Expected Response (400)**:
```json
{
  "error": "Password required for password-protected sharing mode"
}
```

#### Invalid Upload Session ID

```bash
curl -X POST "http://localhost:3000/api/upload/invalid-uuid/complete" \
  -H "Content-Type: application/json" \
  -b upload_cookies.txt \
  -d '{
    "fileHash": "a1b2c3d4e5f6",
    "width": 1920,
    "height": 1080,
    "sharingMode": "public"
  }' \
  -v
```

**Expected Response (404)**:
```json
{
  "error": "Upload session not found or expired"
}
```

#### Session Already Completed

```bash
# Try to complete the same session twice
curl -X POST "http://localhost:3000/api/upload/$UPLOAD_SESSION_ID/complete" \
  -H "Content-Type: application/json" \
  -b upload_cookies.txt \
  -d '{
    "fileHash": "a1b2c3d4e5f6",
    "width": 1920,
    "height": 1080,
    "sharingMode": "public"
  }' \
  -v
```

**Expected Response (400)**:
```json
{
  "error": "Upload session already completed"
}
```

### Test Complete Upload - Quota Enforcement

**Scenario**: User exceeds quota during completion

```bash
# User at quota limit tries to complete upload
curl -X POST "http://localhost:3000/api/upload/$UPLOAD_SESSION_ID/complete" \
  -H "Content-Type: application/json" \
  -b upload_cookies.txt \
  -d '{
    "fileHash": "a1b2c3d4e5f6",
    "width": 1920,
    "height": 1080,
    "sharingMode": "public"
  }' \
  -v
```

**Expected Response (403)**:
```json
{
  "error": "Monthly upload quota exceeded",
  "upgrade": {
    "message": "Upgrade to Pro for unlimited uploads",
    "url": "/pricing"
  }
}
```

**Note**: This can happen if user initiates multiple uploads simultaneously and quota is checked at init time.

### Test Complete Upload Flow

**Complete End-to-End Upload Script**:

```bash
#!/bin/bash

EMAIL="uploader@example.com"
PASSWORD="SecurePass123!"

echo "=== Screenshot Upload Flow Test ==="
echo ""

# Step 1: Login
echo "=== Step 1: Login ==="
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }" \
  -c upload_test_cookies.txt | jq

# Step 2: Initialize upload
echo -e "\n=== Step 2: Initialize Upload ==="
INIT_RESPONSE=$(curl -X POST http://localhost:3000/api/upload/init \
  -H "Content-Type: application/json" \
  -b upload_test_cookies.txt \
  -d '{
    "filename": "test-screenshot.png",
    "fileSize": 524288,
    "mimeType": "image/png"
  }')

echo "$INIT_RESPONSE" | jq

UPLOAD_SESSION_ID=$(echo "$INIT_RESPONSE" | jq -r '.uploadSessionId')
SIGNED_URL=$(echo "$INIT_RESPONSE" | jq -r '.signedUrl')

echo "Upload Session ID: $UPLOAD_SESSION_ID"

# Step 3: Upload file (simulated)
echo -e "\n=== Step 3: Upload File to Storage ==="
echo "In real flow, client would upload file to signed URL:"
echo "curl -X PUT \"$SIGNED_URL\" --upload-file test-screenshot.png"
echo "Simulating upload completion..."

# Step 4: Complete upload
echo -e "\n=== Step 4: Complete Upload ==="
curl -X POST "http://localhost:3000/api/upload/$UPLOAD_SESSION_ID/complete" \
  -H "Content-Type: application/json" \
  -b upload_test_cookies.txt \
  -d '{
    "fileHash": "test-hash-123abc",
    "width": 1920,
    "height": 1080,
    "sharingMode": "public"
  }' | jq

# Step 5: Verify quota updated
echo -e "\n=== Step 5: Verify Quota Updated ==="
curl -X POST http://localhost:3000/api/upload/init \
  -H "Content-Type: application/json" \
  -b upload_test_cookies.txt \
  -d '{
    "filename": "another-screenshot.png",
    "fileSize": 524288,
    "mimeType": "image/png"
  }' | jq '.quota'

# Cleanup
rm -f upload_test_cookies.txt

echo -e "\n=== Test Complete ==="
```

**Save as `test_upload_flow.sh` and run**: `bash test_upload_flow.sh`

### Verify Upload in Database

After successful upload, verify data in database:

```sql
-- Check screenshot record created
SELECT
  id,
  short_id,
  storage_path,
  file_size,
  width,
  height,
  sharing_mode,
  is_public,
  expires_at,
  created_at
FROM screenshots
WHERE user_id = 'user-uuid-here'
ORDER BY created_at DESC
LIMIT 1;

-- Check upload session completed
SELECT
  id,
  filename,
  upload_status,
  screenshot_id,
  created_at
FROM upload_sessions
WHERE user_id = 'user-uuid-here'
ORDER BY created_at DESC
LIMIT 1;

-- Verify monthly usage incremented
SELECT
  month,
  screenshot_count,
  storage_bytes
FROM monthly_usage
WHERE user_id = 'user-uuid-here'
  AND month = to_char(now(), 'YYYY-MM');
```

### Test Sharing Modes

#### Public Sharing (Default)

```bash
curl -X POST "http://localhost:3000/api/upload/$UPLOAD_SESSION_ID/complete" \
  -H "Content-Type: application/json" \
  -b upload_cookies.txt \
  -d '{
    "fileHash": "a1b2c3d4e5f6",
    "width": 1920,
    "height": 1080,
    "sharingMode": "public"
  }'
```

**Expected**: `is_public = true`, no password required, accessible via share URL

#### Private Sharing

```bash
curl -X POST "http://localhost:3000/api/upload/$UPLOAD_SESSION_ID/complete" \
  -H "Content-Type: application/json" \
  -b upload_cookies.txt \
  -d '{
    "fileHash": "a1b2c3d4e5f6",
    "width": 1920,
    "height": 1080,
    "sharingMode": "private"
  }'
```

**Expected**: `is_public = false`, only accessible to owner (authenticated)

#### Password-Protected Sharing

```bash
curl -X POST "http://localhost:3000/api/upload/$UPLOAD_SESSION_ID/complete" \
  -H "Content-Type: application/json" \
  -b upload_cookies.txt \
  -d '{
    "fileHash": "a1b2c3d4e5f6",
    "width": 1920,
    "height": 1080,
    "sharingMode": "password",
    "password": "ViewerPassword123!"
  }'
```

**Expected**: `is_public = false`, password required to view, `password_hash` stored

### Test Pro User Features

**Scenario**: Pro user uploads without expiration

```bash
# Upgrade user to Pro (manual or via Stripe webhook)
# Then upload:
curl -X POST "http://localhost:3000/api/upload/$UPLOAD_SESSION_ID/complete" \
  -H "Content-Type: application/json" \
  -b pro_cookies.txt \
  -d '{
    "fileHash": "a1b2c3d4e5f6",
    "width": 1920,
    "height": 1080,
    "sharingMode": "public"
  }'
```

**Expected**:
- `expiresAt` is `null` (no expiration)
- Unlimited quota (no quota errors)

### Performance Testing

#### Test Upload Initialization Speed

```bash
time curl -X POST http://localhost:3000/api/upload/init \
  -H "Content-Type: application/json" \
  -b upload_cookies.txt \
  -d '{
    "filename": "screenshot.png",
    "fileSize": 524288,
    "mimeType": "image/png"
  }' \
  -s -o /dev/null -w "HTTP %{http_code}, Time: %{time_total}s\n"
```

**Expected**: < 500ms for initialization

#### Test Upload Completion Speed

```bash
time curl -X POST "http://localhost:3000/api/upload/$UPLOAD_SESSION_ID/complete" \
  -H "Content-Type: application/json" \
  -b upload_cookies.txt \
  -d '{
    "fileHash": "a1b2c3d4e5f6",
    "width": 1920,
    "height": 1080,
    "sharingMode": "public"
  }' \
  -s -o /dev/null -w "HTTP %{http_code}, Time: %{time_total}s\n"
```

**Expected**: < 1 second for completion

### Security Considerations

🔒 **Upload API Security**:
- Requires authentication for all endpoints
- Quota enforcement prevents abuse
- Signed URLs expire after 1 hour
- File size and type validation
- Password hashing with bcrypt (10 rounds)
- Duplicate file detection (deduplication)
- Upload sessions expire after 1 hour
- RLS policies protect user data

### Troubleshooting Upload Issues

#### "Quota exceeded"
- **Cause**: User reached monthly upload limit
- **Solution**: Upgrade to Pro plan or wait for next month
- **Debug**: Check `monthly_usage` table for current usage

#### "Upload session not found"
- **Cause**: Invalid session ID or expired session
- **Solution**: Start new upload flow from initialization
- **Debug**: Check `upload_sessions` table for session status

#### "Signed URL expired"
- **Cause**: More than 1 hour passed since initialization
- **Solution**: Request new signed URL via re-initialization
- **Prevention**: Complete uploads within 1 hour

#### "File already exists"
- **Cause**: File with same hash already uploaded
- **Solution**: Use existing screenshot URL (returned in response)
- **Note**: This is expected behavior for deduplication

#### "Password required"
- **Cause**: Selected password-protected mode without providing password
- **Solution**: Include `password` field in completion request

### Automated Testing (Unit Tests)

**Example Jest/Vitest test**:

```typescript
describe('POST /api/upload/init', () => {
  it('should initialize upload for authenticated user', async () => {
    const session = await loginTestUser();

    const response = await request(app)
      .post('/api/upload/init')
      .set('Cookie', session.cookies)
      .send({
        filename: 'test.png',
        fileSize: 524288,
        mimeType: 'image/png'
      });

    expect(response.status).toBe(200);
    expect(response.body.uploadSessionId).toBeDefined();
    expect(response.body.signedUrl).toBeDefined();
    expect(response.body.quota).toMatchObject({
      plan: 'free',
      limit: 10,
      remaining: expect.any(Number)
    });
  });

  it('should reject upload when quota exceeded', async () => {
    const user = await createTestUserWithFullQuota();
    const session = await loginTestUser(user);

    const response = await request(app)
      .post('/api/upload/init')
      .set('Cookie', session.cookies)
      .send({
        filename: 'test.png',
        fileSize: 524288,
        mimeType: 'image/png'
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Monthly upload quota exceeded');
  });

  it('should reject file exceeding size limit', async () => {
    const session = await loginTestUser();

    const response = await request(app)
      .post('/api/upload/init')
      .set('Cookie', session.cookies)
      .send({
        filename: 'large.png',
        fileSize: 15728640, // 15 MB
        mimeType: 'image/png'
      });

    expect(response.status).toBe(413);
    expect(response.body.error).toContain('exceeds maximum');
  });
});

describe('POST /api/upload/[uploadSessionId]/complete', () => {
  it('should complete upload and create screenshot', async () => {
    const session = await loginTestUser();
    const uploadSession = await createUploadSession(session.user.id);

    const response = await request(app)
      .post(`/api/upload/${uploadSession.id}/complete`)
      .set('Cookie', session.cookies)
      .send({
        fileHash: 'test-hash-123',
        width: 1920,
        height: 1080,
        sharingMode: 'public'
      });

    expect(response.status).toBe(201);
    expect(response.body.screenshot.shortId).toBeDefined();
    expect(response.body.screenshot.shareUrl).toContain('http://');
  });

  it('should return existing screenshot for duplicate file', async () => {
    const session = await loginTestUser();
    const existingScreenshot = await createScreenshot(session.user.id, {
      fileHash: 'duplicate-hash'
    });

    const uploadSession = await createUploadSession(session.user.id);

    const response = await request(app)
      .post(`/api/upload/${uploadSession.id}/complete`)
      .set('Cookie', session.cookies)
      .send({
        fileHash: 'duplicate-hash',
        width: 1920,
        height: 1080,
        sharingMode: 'public'
      });

    expect(response.status).toBe(200);
    expect(response.body.duplicate).toBe(true);
    expect(response.body.screenshot.id).toBe(existingScreenshot.id);
  });

  it('should enforce password requirement for password mode', async () => {
    const session = await loginTestUser();
    const uploadSession = await createUploadSession(session.user.id);

    const response = await request(app)
      .post(`/api/upload/${uploadSession.id}/complete`)
      .set('Cookie', session.cookies)
      .send({
        fileHash: 'test-hash-123',
        width: 1920,
        height: 1080,
        sharingMode: 'password'
        // Missing password field
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Password required');
  });
});
```

---

## Security Notes

⚠️ **DO NOT** use these curl commands with production credentials or on public networks without HTTPS.

✅ **DO** test in local development environment with test accounts.

✅ **DO** verify HTTPS is enabled before testing in production.

✅ **DO** verify complete data deletion after account removal (GDPR/CCPA compliance).

✅ **DO** test account deletion flow before deploying to production.

---

**Happy Testing! 🚀**
