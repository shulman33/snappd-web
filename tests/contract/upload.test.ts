/**
 * Contract test for POST /api/upload/signed-url
 * Tests signed URL generation for screenshot uploads
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('POST /api/upload/signed-url', () => {
  let accessToken: string;

  test.beforeAll(async ({ request }) => {
    // Create test user and get access token
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: `test-upload-${Date.now()}@example.com`,
        password: 'SecurePass123!',
        full_name: 'Test User',
      },
    });

    const signupData = await signupResponse.json();
    accessToken = signupData.session.access_token;
  });

  test('should return 401 when no auth token provided', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/upload/signed-url`, {
      data: {
        filename: 'test.png',
        mime_type: 'image/png',
        file_size: 1024,
      },
    });

    expect(response.status()).toBe(401);
  });

  test('should generate signed URL for valid request', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/upload/signed-url`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        filename: 'test-screenshot.png',
        mime_type: 'image/png',
        file_size: 524288, // 512KB
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('upload_url');
    expect(body).toHaveProperty('storage_path');
    expect(body).toHaveProperty('expires_in');
    expect(body).toHaveProperty('short_id');
    expect(body.expires_in).toBe(300); // 5 minutes
    expect(body.short_id).toHaveLength(6);
  });

  test('should reject invalid MIME type', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/upload/signed-url`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        filename: 'test.pdf',
        mime_type: 'application/pdf',
        file_size: 1024,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should reject file size exceeding 10MB', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/upload/signed-url`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        filename: 'large-file.png',
        mime_type: 'image/png',
        file_size: 11 * 1024 * 1024, // 11MB
      },
    });

    expect(response.status()).toBe(400);
  });
});

