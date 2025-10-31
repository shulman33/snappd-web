/**
 * Contract test for POST /api/screenshots
 * Tests screenshot metadata creation
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('POST /api/screenshots', () => {
  let accessToken: string;
  let storagePath: string;

  test.beforeAll(async ({ request }) => {
    // Create test user and get access token
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: `test-screenshots-${Date.now()}@example.com`,
        password: 'SecurePass123!',
        full_name: 'Test User',
      },
    });

    const signupData = await signupResponse.json();
    accessToken = signupData.session.access_token;

    // Get signed URL
    const signedUrlResponse = await request.post(`${BASE_URL}/api/upload/signed-url`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        filename: 'test.png',
        mime_type: 'image/png',
        file_size: 1024,
      },
    });

    const signedUrlData = await signedUrlResponse.json();
    storagePath = signedUrlData.storage_path;
  });

  test('should create screenshot metadata', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/screenshots`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        filename: 'test-screenshot.png',
        mime_type: 'image/png',
        file_size: 1024,
        width: 1920,
        height: 1080,
        storage_path: storagePath,
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('short_id');
    expect(body).toHaveProperty('public_url');
    expect(body).toHaveProperty('storage_url');
    expect(body).toHaveProperty('expires_at');
    expect(body.original_filename).toBe('test-screenshot.png');
    expect(body.width).toBe(1920);
    expect(body.height).toBe(1080);
    expect(body.views).toBe(0);
    expect(body.is_public).toBe(true);
  });

  test('should return 401 when no auth token provided', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/screenshots`, {
      data: {
        filename: 'test.png',
        mime_type: 'image/png',
        file_size: 1024,
        width: 1920,
        height: 1080,
        storage_path: storagePath,
      },
    });

    expect(response.status()).toBe(401);
  });
});

