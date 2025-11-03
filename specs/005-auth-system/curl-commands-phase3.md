# Phase 3 API Testing - Quick Reference Curl Commands

Replace `http://localhost:3000` with your actual deployment URL.

## 1. POST /api/auth/signup - Create New User

### Valid Signup
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "Test@Pass123",
    "fullName": "John Doe"
  }'
```

**Expected Response (201 Created):**
```json
{
  "user": {
    "id": "uuid-here",
    "email": "newuser@example.com",
    "emailVerified": false,
    "fullName": "John Doe",
    "plan": "free",
    "createdAt": "2025-11-02T12:00:00Z"
  },
  "message": "Signup successful! Please check your email to verify your account."
}
```

---

### Signup Without Full Name (Optional)
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "minimal@example.com",
    "password": "Test@Pass123"
  }'
```

---

### Duplicate Email - 409 Conflict
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "existing@example.com",
    "password": "Test@Pass123"
  }'
```

**Expected Response (409):**
```json
{
  "error": "EMAIL_EXISTS",
  "message": "An account with this email address already exists. Please try signing in instead."
}
```

---

### Invalid Email Format - 400 Validation Error
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "not-an-email",
    "password": "Test@Pass123"
  }'
```

**Expected Response (400):**
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid input data",
  "details": [
    {
      "field": "email",
      "message": "Invalid email address"
    }
  ]
}
```

---

### Weak Password - Missing Uppercase
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "weakpass123!"
  }'
```

**Expected Response (400):**
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid input data",
  "details": [
    {
      "field": "password",
      "message": "Password must contain at least one uppercase letter"
    }
  ]
}
```

---

### Weak Password - Missing Special Character
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "WeakPass123"
  }'
```

---

### Weak Password - Too Short
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Test@1"
  }'
```

---

### Missing Required Field
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

---

## 2. POST /api/auth/verify-email/resend - Resend Verification Email

### Valid Resend Request
```bash
curl -X POST http://localhost:3000/api/auth/verify-email/resend \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com"
  }'
```

**Expected Response (200 OK):**
```json
{
  "message": "If an unverified account exists with this email, a verification email has been sent."
}
```

**Note:** Generic message prevents email enumeration - same response whether email exists or not.

---

### Non-Existent Email (Still Returns 200)
```bash
curl -X POST http://localhost:3000/api/auth/verify-email/resend \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nonexistent@example.com"
  }'
```

**Expected Response (200 OK):**
```json
{
  "message": "If an unverified account exists with this email, a verification email has been sent."
}
```

---

### Invalid Email Format - 400 Error
```bash
curl -X POST http://localhost:3000/api/auth/verify-email/resend \
  -H "Content-Type: application/json" \
  -d '{
    "email": "not-an-email"
  }'
```

---

### Rate Limit Exceeded - 429 Error
Trigger by sending 4+ requests within 1 hour:

```bash
# Request 1-3: Success
curl -X POST http://localhost:3000/api/auth/verify-email/resend \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# Request 4: Rate limited
curl -X POST http://localhost:3000/api/auth/verify-email/resend \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

**Expected Response (429):**
```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many verification emails sent. Please check your inbox or try again later.",
  "retryAfter": 3600
}
```

**Response Headers:**
```
Retry-After: 3600
```

---

## 3. GET /api/auth/verify-email - Verify Email (PKCE Flow)

### Valid Verification Link
```bash
curl -X GET "http://localhost:3000/api/auth/verify-email?token_hash=valid_hash_from_email&type=email&next=/dashboard" \
  -L
```

**Expected Response:**
- **302 Redirect** to `/dashboard` (or the URL specified in `next` parameter)
- User is now authenticated with a session cookie

**On Success:**
- User's `email_confirmed_at` is set in the database
- `email_verified` event logged to `auth_events` table
- User redirected to dashboard or specified `next` URL

---

### Invalid or Expired Token
```bash
curl -X GET "http://localhost:3000/api/auth/verify-email?token_hash=invalid_or_expired_token&type=email" \
  -L
```

**Expected Response:**
- **302 Redirect** to `/auth/error?message=Verification+link+has+expired...`

---

### Missing Parameters
```bash
curl -X GET "http://localhost:3000/api/auth/verify-email" \
  -L
```

**Expected Response:**
- **302 Redirect** to `/auth/error?message=Missing+verification+parameters`

---

### Wrong Type Parameter
```bash
curl -X GET "http://localhost:3000/api/auth/verify-email?token_hash=some_token&type=recovery" \
  -L
```

**Expected Response:**
- **302 Redirect** to `/auth/error?message=Invalid+verification+type`

---

## Rate Limiting Tests

### Account Lockout (5 Attempts in 15 Minutes)

```bash
# Create test email variable
EMAIL="lockout-test@example.com"

# Attempt 1: Success
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"Test@Pass123\"}"

# Attempts 2-5: Duplicate email (409 errors)
for i in {2..5}; do
  curl -X POST http://localhost:3000/api/auth/signup \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$EMAIL\", \"password\": \"Test@Pass123\"}"
done

# Attempt 6: Account locked (429 error)
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"Test@Pass123\"}"
```

**Expected Response After 5 Attempts (429):**
```json
{
  "error": "ACCOUNT_LOCKED",
  "message": "Too many signup attempts. Your account is temporarily locked for 15 minutes.",
  "retryAfter": 900
}
```

---

## Testing Email Verification Flow End-to-End

### Step-by-Step Manual Test

1. **Create a new user:**
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@Pass123",
    "fullName": "Test User"
  }'
```

2. **Check email inbox:**
   - **Local Development:** Visit Mailpit at `http://localhost:54324` (or check `supabase status` for the URL)
   - **Hosted Supabase:** Check the email address you provided
   - Look for email with subject "Confirm Your Signup"

3. **Copy verification link from email:**
   - Link format: `http://localhost:3000/api/auth/verify-email?token_hash=<hash>&type=email&next=/dashboard`

4. **Visit verification link in browser or use curl:**
```bash
curl -L "http://localhost:3000/api/auth/verify-email?token_hash=<paste_hash_here>&type=email&next=/dashboard"
```

5. **Verify success:**
   - Should redirect to `/dashboard`
   - User should now be authenticated (check cookies)
   - Database: `email_confirmed_at` should be set in `auth.users` table

---

## Debugging Tips

### View Response Headers
```bash
curl -v http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test@Pass123"}'
```

### Follow Redirects
```bash
curl -L http://localhost:3000/api/auth/verify-email?token_hash=abc123&type=email
```

### Include HTTP Status Code
```bash
curl -w "\nHTTP Status: %{http_code}\n" \
  http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test@Pass123"}'
```

### Pretty Print JSON Response
```bash
curl http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test@Pass123"}' \
  | jq '.'
```

---

## Database Verification Queries

After testing, you can verify the results in Supabase:

### Check User Was Created
```sql
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
WHERE email = 'test@example.com';
```

### Check Profile Was Created Automatically
```sql
SELECT id, email, full_name, plan, created_at
FROM public.profiles
WHERE email = 'test@example.com';
```

### Check Auth Events Logged
```sql
SELECT event_type, email, ip_address, metadata, created_at
FROM public.auth_events
WHERE email = 'test@example.com'
ORDER BY created_at DESC;
```

### Verify Trigger Executed
```sql
-- This should return 1 (same count in both tables)
SELECT
  (SELECT COUNT(*) FROM auth.users WHERE email = 'test@example.com') as auth_count,
  (SELECT COUNT(*) FROM public.profiles WHERE email = 'test@example.com') as profile_count;
```

---

## Quick Test Script

Make the test script executable and run it:

```bash
chmod +x specs/005-auth-system/test-phase3-endpoints.sh
./specs/005-auth-system/test-phase3-endpoints.sh
```

This interactive script will walk you through all test scenarios with proper validation.
