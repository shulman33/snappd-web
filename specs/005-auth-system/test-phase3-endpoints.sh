#!/bin/bash

# Test Script for Phase 3: User Story 1 - Email/Password Account Creation
#
# This script provides curl commands to test the signup and email verification endpoints.
# Update the BASE_URL to match your deployment environment.

# Configuration
BASE_URL="http://localhost:3000"  # Change to your deployment URL
TEST_EMAIL="test-user-$(date +%s)@gmail.com"  # Unique email for testing
TEST_PASSWORD="Test@Pass123"
TEST_FULLNAME="Test User"

echo "=========================================="
echo "Phase 3 Endpoint Testing"
echo "=========================================="
echo ""
echo "Test Email: $TEST_EMAIL"
echo "Base URL: $BASE_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print test results
print_test() {
    echo -e "${YELLOW}Test: $1${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✓ Expected Result: $1${NC}"
    echo ""
}

print_error() {
    echo -e "${RED}✗ Expected Result: $1${NC}"
    echo ""
}

# ============================================================================
# Test 1: Valid Signup
# ============================================================================
print_test "1. Valid Signup (POST /api/auth/signup)"
print_success "201 Created - User created successfully with verification email sent"

curl -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"fullName\": \"$TEST_FULLNAME\"
  }" \
  -w "\nHTTP Status: %{http_code}\n\n" \
  -s | jq '.'

echo "Press Enter to continue..."
read

# ============================================================================
# Test 2: Duplicate Email
# ============================================================================
print_test "2. Duplicate Email Signup (POST /api/auth/signup)"
print_error "409 Conflict - Email already exists"

curl -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"fullName\": \"Another User\"
  }" \
  -w "\nHTTP Status: %{http_code}\n\n" \
  -s | jq '.'

echo "Press Enter to continue..."
read

# ============================================================================
# Test 3: Invalid Email Format
# ============================================================================
print_test "3. Invalid Email Format (POST /api/auth/signup)"
print_error "400 Bad Request - Validation error"

curl -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "not-an-email",
    "password": "Test@Pass123",
    "fullName": "Test User"
  }' \
  -w "\nHTTP Status: %{http_code}\n\n" \
  -s | jq '.'

echo "Press Enter to continue..."
read

# ============================================================================
# Test 4: Weak Password (Missing Uppercase)
# ============================================================================
print_test "4. Weak Password - Missing Uppercase (POST /api/auth/signup)"
print_error "400 Bad Request - Password validation error"

curl -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@gmail.com",
    "password": "weakpass123!",
    "fullName": "Test User"
  }' \
  -w "\nHTTP Status: %{http_code}\n\n" \
  -s | jq '.'

echo "Press Enter to continue..."
read

# ============================================================================
# Test 5: Weak Password (Missing Special Character)
# ============================================================================
print_test "5. Weak Password - Missing Special Character (POST /api/auth/signup)"
print_error "400 Bad Request - Password validation error"

curl -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser2@gmail.com",
    "password": "WeakPass123",
    "fullName": "Test User"
  }' \
  -w "\nHTTP Status: %{http_code}\n\n" \
  -s | jq '.'

echo "Press Enter to continue..."
read

# ============================================================================
# Test 6: Weak Password (Too Short)
# ============================================================================
print_test "6. Weak Password - Too Short (POST /api/auth/signup)"
print_error "400 Bad Request - Password must be at least 8 characters"

curl -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser3@gmail.com",
    "password": "Test@1",
    "fullName": "Test User"
  }' \
  -w "\nHTTP Status: %{http_code}\n\n" \
  -s | jq '.'

echo "Press Enter to continue..."
read

# ============================================================================
# Test 7: Missing Required Field (Password)
# ============================================================================
print_test "7. Missing Required Field - Password (POST /api/auth/signup)"
print_error "400 Bad Request - Validation error"

curl -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser4@gmail.com",
    "fullName": "Test User"
  }' \
  -w "\nHTTP Status: %{http_code}\n\n" \
  -s | jq '.'

echo "Press Enter to continue..."
read

# ============================================================================
# Test 8: Signup Without Full Name (Optional Field)
# ============================================================================
print_test "8. Signup Without Full Name - Optional Field (POST /api/auth/signup)"
print_success "201 Created - User created with null full_name"

UNIQUE_EMAIL="no-name-$(date +%s)@gmail.com"

curl -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$UNIQUE_EMAIL\",
    \"password\": \"Test@Pass123\"
  }" \
  -w "\nHTTP Status: %{http_code}\n\n" \
  -s | jq '.'

echo "Press Enter to continue..."
read

# ============================================================================
# Test 9: Resend Verification Email (Valid)
# ============================================================================
print_test "9. Resend Verification Email - Valid (POST /api/auth/verify-email/resend)"
print_success "200 OK - Verification email sent"

curl -X POST "$BASE_URL/api/auth/verify-email/resend" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\"
  }" \
  -w "\nHTTP Status: %{http_code}\n\n" \
  -s | jq '.'

echo "Press Enter to continue..."
read

# ============================================================================
# Test 10: Resend Verification Email (Non-Existent Email)
# ============================================================================
print_test "10. Resend Verification Email - Non-Existent Email (POST /api/auth/verify-email/resend)"
print_success "200 OK - Generic success message (prevents email enumeration)"

curl -X POST "$BASE_URL/api/auth/verify-email/resend" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nonexistent@gmail.com"
  }' \
  -w "\nHTTP Status: %{http_code}\n\n" \
  -s | jq '.'

echo "Press Enter to continue..."
read

# ============================================================================
# Test 11: Resend Verification Email (Invalid Email Format)
# ============================================================================
print_test "11. Resend Verification Email - Invalid Format (POST /api/auth/verify-email/resend)"
print_error "400 Bad Request - Validation error"

curl -X POST "$BASE_URL/api/auth/verify-email/resend" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "not-an-email"
  }' \
  -w "\nHTTP Status: %{http_code}\n\n" \
  -s | jq '.'

echo "Press Enter to continue..."
read

# ============================================================================
# Test 12: Rate Limiting - Verification Resend (Trigger After 3 Requests)
# ============================================================================
print_test "12. Rate Limiting Test - Verification Resend (POST /api/auth/verify-email/resend)"
print_error "429 Too Many Requests (after 3 requests in 1 hour)"

echo "Sending 4 rapid requests to trigger rate limit..."
echo ""

for i in {1..4}; do
  echo "Request $i:"
  curl -X POST "$BASE_URL/api/auth/verify-email/resend" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"ratelimit-test-$(date +%s)@gmail.com\"
    }" \
    -w "\nHTTP Status: %{http_code}\n" \
    -s | jq '.'
  echo ""
  sleep 1
done

echo "Press Enter to continue..."
read

# ============================================================================
# Test 13: Email Verification with Invalid Token
# ============================================================================
print_test "13. Email Verification - Invalid Token (GET /api/auth/verify-email)"
print_error "302 Redirect to /auth/error - Invalid token"

echo "Note: This will redirect to an error page"
echo ""

curl -X GET "$BASE_URL/api/auth/verify-email?token_hash=invalid_token_hash&type=email" \
  -L \
  -w "\nHTTP Status: %{http_code}\n\n" \
  -s

echo ""
echo "Press Enter to continue..."
read

# ============================================================================
# Test 14: Email Verification with Missing Parameters
# ============================================================================
print_test "14. Email Verification - Missing Parameters (GET /api/auth/verify-email)"
print_error "302 Redirect to /auth/error - Missing parameters"

echo "Note: This will redirect to an error page"
echo ""

curl -X GET "$BASE_URL/api/auth/verify-email" \
  -L \
  -w "\nHTTP Status: %{http_code}\n\n" \
  -s

echo ""
echo "Press Enter to continue..."
read

# ============================================================================
# Test 15: Email Verification with Wrong Type
# ============================================================================
print_test "15. Email Verification - Wrong Type (GET /api/auth/verify-email)"
print_error "302 Redirect to /auth/error - Invalid type"

echo "Note: This will redirect to an error page"
echo ""

curl -X GET "$BASE_URL/api/auth/verify-email?token_hash=some_token&type=recovery" \
  -L \
  -w "\nHTTP Status: %{http_code}\n\n" \
  -s

echo ""
echo "Press Enter to continue..."
read

# ============================================================================
# Test 16: Rate Limiting - Account Lockout (Trigger After 5 Signups)
# ============================================================================
print_test "16. Rate Limiting Test - Account Lockout (POST /api/auth/signup)"
print_error "429 Too Many Requests (after 5 failed attempts in 15 min)"

echo "Attempting 6 signups with same email to trigger account lockout..."
echo ""

LOCKOUT_EMAIL="lockout-test-$(date +%s)@gmail.com"

# First signup succeeds
echo "Request 1 (should succeed):"
curl -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$LOCKOUT_EMAIL\",
    \"password\": \"Test@Pass123\"
  }" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.'
echo ""
sleep 1

# Next 5 attempts should trigger rate limit
for i in {2..6}; do
  echo "Request $i (duplicate email):"
  curl -X POST "$BASE_URL/api/auth/signup" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$LOCKOUT_EMAIL\",
      \"password\": \"Test@Pass123\"
    }" \
    -w "\nHTTP Status: %{http_code}\n" \
    -s | jq '.'
  echo ""
  sleep 1
done

echo ""
echo "=========================================="
echo "Testing Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "- Created test user: $TEST_EMAIL"
echo "- To verify email, check your Supabase email logs or Mailpit (local dev)"
echo "- The verification link will contain token_hash and type=email parameters"
echo ""
echo "Example verification URL structure:"
echo "$BASE_URL/api/auth/verify-email?token_hash=<hash>&type=email&next=/dashboard"
echo ""
echo "For manual testing of email verification:"
echo "1. Check your email inbox or local email catcher (Mailpit)"
echo "2. Copy the verification link from the email"
echo "3. Visit the link in your browser"
echo "4. You should be redirected to /dashboard upon success"
echo ""
