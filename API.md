# snappd API Documentation

**Version**: 1.0.0  
**Base URL**: `https://snappd.app` (production) or `http://localhost:3000` (development)

## Overview

snappd is a screenshot sharing platform with a RESTful API backend. All authenticated endpoints require a JWT token in the `Authorization` header.

## Authentication

**Format**: `Authorization: Bearer <access_token>`

### Endpoints

#### POST /api/auth/signup
Create a new user account.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "full_name": "John Doe" // optional
}
```

**Response** (201):
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_in": 3600
  }
}
```

---

## Screenshots

### POST /api/upload/signed-url
Generate signed URL for direct file upload.

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "filename": "screenshot.png",
  "mime_type": "image/png",
  "file_size": 524288
}
```

**Response** (200):
```json
{
  "upload_url": "https://...",
  "storage_path": "user_id/timestamp_shortId.png",
  "expires_in": 300,
  "short_id": "abc123"
}
```

**Rate Limit**: 10 uploads/min per user

---

### POST /api/screenshots
Create screenshot metadata after upload.

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "filename": "screenshot.png",
  "mime_type": "image/png",
  "file_size": 524288,
  "width": 1920,
  "height": 1080,
  "storage_path": "user_id/timestamp_shortId.png"
}
```

**Response** (201):
```json
{
  "id": "uuid",
  "short_id": "abc123",
  "original_filename": "screenshot.png",
  "file_size": 524288,
  "width": 1920,
  "height": 1080,
  "mime_type": "image/png",
  "public_url": "https://snappd.app/s/abc123",
  "storage_url": "https://...",
  "expires_at": "2025-11-16T12:00:00Z",
  "views": 0,
  "is_public": true,
  "created_at": "2025-10-17T12:00:00Z",
  "updated_at": "2025-10-17T12:00:00Z"
}
```

---

### GET /api/s/[shortId]
View public screenshot (no auth required).

**Response** (200):
```json
{
  "short_id": "abc123",
  "original_filename": "screenshot.png",
  "width": 1920,
  "height": 1080,
  "storage_url": "https://...",
  "views": 42,
  "created_at": "2025-10-17T12:00:00Z",
  "seo_metadata": {
    "title": "Screenshot - screenshot.png",
    "description": "Shared via snappd",
    "image": "https://..."
  }
}
```

**Status Codes**:
- `200`: Success
- `404`: Screenshot not found
- `410`: Screenshot expired

---

### GET /api/screenshots
List user's screenshots (paginated).

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `limit` (default: 50, max: 100)
- `offset` (default: 0)
- `search` (optional): Filename substring search
- `from_date` (optional): ISO 8601 date
- `to_date` (optional): ISO 8601 date

**Response** (200):
```json
{
  "data": [/* screenshot objects */],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "has_more": true
  }
}
```

---

### GET /api/screenshots/[id]
Get screenshot metadata by ID.

**Headers**: `Authorization: Bearer <token>`

**Response** (200): Screenshot object

---

### PATCH /api/screenshots/[id]
Update screenshot metadata.

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "original_filename": "new-name.png", // optional
  "is_public": false // optional
}
```

**Response** (200): Updated screenshot object

---

### DELETE /api/screenshots/[id]
Delete screenshot (DB + storage file).

**Headers**: `Authorization: Bearer <token>`

**Response** (204): No content

---

### GET /api/screenshots/[id]/download
Generate signed download URL.

**Headers**: `Authorization: Bearer <token>`

**Response** (200):
```json
{
  "download_url": "https://...",
  "expires_in": 3600
}
```

---

## Usage & Billing

### GET /api/usage
Get current month usage statistics.

**Headers**: `Authorization: Bearer <token>`

**Response** (200):
```json
{
  "month": "2025-10",
  "screenshot_count": 5,
  "screenshot_limit": 10,
  "storage_bytes": 5242880,
  "storage_mb": 5.0,
  "bandwidth_bytes": 1048576,
  "bandwidth_mb": 1.0,
  "plan": "free",
  "limit_status": {
    "at_limit": false,
    "remaining": 5,
    "resets_at": "2025-11-01T00:00:00Z"
  },
  "upgrade_prompt": {
    "show_prompt": false,
    "message": "You've used 5 of 10 free screenshots this month.",
    "cta_text": "Upgrade to Pro - $9/month",
    "urgency_level": "low"
  }
}
```

---

### GET /api/usage/history
Get usage history (multiple months).

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `months` (default: 6, max: 12)

**Response** (200):
```json
{
  "months": [
    {
      "month": "2025-10",
      "screenshot_count": 5,
      "storage_mb": 5.0,
      "bandwidth_mb": 1.0
    }
  ],
  "total": {
    "screenshots": 30,
    "storage_mb": 30.0,
    "bandwidth_mb": 6.0
  }
}
```

---

### POST /api/billing/checkout
Create Stripe Checkout session for pro upgrade.

**Headers**: `Authorization: Bearer <token>`

**Response** (200):
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

---

### GET /api/billing/portal
Create Stripe Customer Portal session.

**Headers**: `Authorization: Bearer <token>`

**Response** (200):
```json
{
  "url": "https://billing.stripe.com/..."
}
```

---

### POST /api/billing/webhook
Handle Stripe webhook events (internal use).

**Headers**: `stripe-signature: <signature>`

**Events Handled**:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

---

## Profile Management

### GET /api/auth/me
Get current user profile.

**Headers**: `Authorization: Bearer <token>`

**Response** (200):
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "plan": "free",
  "created_at": "2025-10-17T12:00:00Z",
  "updated_at": "2025-10-17T12:00:00Z"
}
```

---

### PATCH /api/auth/me
Update user profile.

**Headers**: `Authorization: Bearer <token>`

**Request Body**:
```json
{
  "full_name": "Jane Doe", // optional
  "email": "newemail@example.com" // optional
}
```

**Response** (200): Updated profile object

---

### POST /api/auth/delete
Permanently delete account (GDPR compliance).

**Headers**: `Authorization: Bearer <token>`

**Response** (204): No content

**Warning**: This action is irreversible. Deletes:
- All screenshots (DB + storage)
- Monthly usage records
- Profile data
- Stripe customer
- Auth user

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": {} // optional
  }
}
```

**Common Error Codes**:
- `VALIDATION_ERROR` (400)
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `GONE` (410)
- `PAYLOAD_TOO_LARGE` (413)
- `RATE_LIMIT_EXCEEDED` (429)
- `INTERNAL_SERVER_ERROR` (500)

---

## Rate Limits

- **Upload endpoints**: 10 uploads/min per user
- **General API**: 100 requests/min per user

Rate limit headers:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1234567890
```

---

## For more details, see:
- [quickstart.md](./specs/001-api-backend/quickstart.md) - Setup guide
- [contracts/](./specs/001-api-backend/contracts/) - OpenAPI specs
- [data-model.md](./specs/001-api-backend/data-model.md) - Database schema

