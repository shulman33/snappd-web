# API Testing Guide - Authentication System

This document provides curl commands to test all authentication flows for the Snappd authentication system.

**Base URL**: `http://localhost:3000` (adjust for your environment)

---

## Table of Contents

1. [User Registration Flow](#1-user-registration-flow)
2. [Email Verification Flow](#2-email-verification-flow)
3. [Login Flow](#3-login-flow)
4. [Session Management](#4-session-management)
5. [Logout Flow](#5-logout-flow)
6. [Rate Limiting Tests](#6-rate-limiting-tests)
7. [Account Lockout Tests](#7-account-lockout-tests)
8. [Error Scenarios](#8-error-scenarios)

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

## 4. Session Management

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

## 5. Logout Flow

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

## 6. Rate Limiting Tests

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

## 7. Account Lockout Tests

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

## 8. Error Scenarios

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

## 9. Complete User Journey Test

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

## 10. Testing Browser Extension Polling

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

## 11. Testing Concurrent Sessions

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

## Security Notes

⚠️ **DO NOT** use these curl commands with production credentials or on public networks without HTTPS.

✅ **DO** test in local development environment with test accounts.

✅ **DO** verify HTTPS is enabled before testing in production.

---

**Happy Testing! 🚀**
