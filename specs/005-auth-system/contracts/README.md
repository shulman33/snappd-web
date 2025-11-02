# Authentication API Contracts

This directory contains the API contract specifications for the Snappd authentication system.

## Files

### `openapi.yaml`
OpenAPI 3.1 specification for all authentication endpoints. This spec:
- Documents all request/response schemas
- Defines authentication security schemes
- Includes example requests and responses
- Specifies error codes and rate limiting behavior

**Usage:**
- Import into Postman/Insomnia for API testing
- Generate API documentation with tools like Redoc or Swagger UI
- Validate API responses match contract
- Share with frontend/mobile developers

**View Documentation:**
```bash
# Using Redoc (recommended)
npx redoc-cli serve openapi.yaml

# Using Swagger UI
npx swagger-ui-watcher openapi.yaml
```

### `schemas/zod-schemas.ts`
TypeScript/Zod schemas for runtime validation. These schemas:
- Provide type-safe request validation
- Enforce password requirements
- Transform and sanitize user input
- Generate TypeScript types via `z.infer`

**Implementation Location:**
Copy to `src/lib/schemas/auth.ts` when implementing.

**Usage Example:**
```typescript
import { signupSchema } from '@/lib/schemas/auth';

export async function POST(request: Request) {
  const body = await request.json();

  try {
    // Validates and transforms data
    const validatedData = signupSchema.parse(body);

    // TypeScript knows the exact type here
    const { email, password, fullName } = validatedData;

    // Proceed with signup...
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({
        error: 'VALIDATION_ERROR',
        details: formatZodError(error)
      }, { status: 400 });
    }
  }
}
```

## Validation Rules

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (@$!%*?&)

### Email Requirements
- Valid RFC 5322 email format
- Maximum 255 characters
- Automatically lowercased and trimmed

### Rate Limits

| Endpoint | Limit | Window | Scope |
|----------|-------|--------|-------|
| POST /api/auth/signin | 5 attempts | 15 minutes | Per account |
| POST /api/auth/signin | 20 attempts | 15 minutes | Per IP |
| POST /api/auth/reset-password | 3 requests | 1 hour | Per email |
| POST /api/auth/magic-link | 5 requests | 1 hour | Per email |
| POST /api/auth/verify-email resend | 3 requests | 1 hour | Per email |

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_CREDENTIALS` | 401 | Email or password incorrect |
| `EMAIL_EXISTS` | 409 | Email already registered |
| `EMAIL_NOT_VERIFIED` | 403 | Email verification required |
| `INVALID_TOKEN` | 400 | Expired or invalid token |
| `ACCOUNT_LOCKED` | 429 | Too many failed login attempts |
| `IP_BLOCKED` | 429 | IP temporarily blocked |
| `RATE_LIMIT_EXCEEDED` | 429 | Generic rate limit exceeded |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Security Notes

### Session Cookies
All authenticated endpoints use HTTP-only cookies:
- **Name**: `sb-access-token`
- **HttpOnly**: true (prevents JavaScript access)
- **Secure**: true (HTTPS only in production)
- **SameSite**: Lax (CSRF protection)
- **Max-Age**: 604800 (7 days)

### CORS Configuration
API allows requests from:
- Production: `https://app.snappd.io`
- Browser extension: `chrome-extension://*`, `moz-extension://*`
- Localhost (development): `http://localhost:3000`

Credentials (cookies) are included via `Access-Control-Allow-Credentials: true`.

### Token Security
- All tokens (verification, reset, magic link) are hashed before storage
- Tokens are single-use (invalidated after first use)
- Short expiration times (15 min for magic links, 1 hour for resets)

## Testing

### Postman Collection
Import `openapi.yaml` to generate a Postman collection:

1. Open Postman
2. Import → Upload Files → Select `openapi.yaml`
3. Collection auto-generated with all endpoints

### Manual Testing
```bash
# Signup
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!","fullName":"Test User"}'

# Signin
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}' \
  -c cookies.txt

# Get current user (requires session cookie)
curl -X GET http://localhost:3000/api/auth/user \
  -b cookies.txt

# Signout
curl -X POST http://localhost:3000/api/auth/signout \
  -b cookies.txt
```

## Implementation Checklist

- [ ] Copy `zod-schemas.ts` to `src/lib/schemas/auth.ts`
- [ ] Implement all 8 API route handlers
- [ ] Add validation using Zod schemas
- [ ] Implement rate limiting middleware
- [ ] Add error handling for all error codes
- [ ] Write unit tests for each schema
- [ ] Write integration tests for each endpoint
- [ ] Add E2E tests for complete auth flows
- [ ] Generate TypeScript types from Supabase schema
- [ ] Configure CORS for browser extension
- [ ] Set up session cookie configuration
- [ ] Test all OAuth flows (Google, GitHub)
- [ ] Verify rate limiting behavior
- [ ] Test email delivery (verification, reset)
- [ ] Load test authentication endpoints

## Related Documentation

- [research.md](../research.md) - Technology decisions and patterns
- [data-model.md](../data-model.md) - Database schema and entities
- [quickstart.md](../quickstart.md) - Developer setup guide
- [plan.md](../plan.md) - Full implementation plan

## Questions?

Refer to the OpenAPI specification for detailed endpoint documentation and example requests/responses.
