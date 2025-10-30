/**
 * Contract test for GET /api/screenshots/[id]
 * Tests individual screenshot retrieval
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('GET /api/screenshots/[id]', () => {
  let accessToken: string;
  let screenshotId: string;
  let otherUserToken: string;
  let otherUserScreenshotId: string;

  test.beforeAll(async ({ request }) => {
    // Create first user and screenshot
    const uniqueEmail = `test-get-${Date.now()}@example.com`;
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'SecurePass123!',
        full_name: 'Get Test User',
      },
    });

    const signupData = await signupResponse.json();
    accessToken = signupData.session.access_token;

    const signedUrlResponse = await request.post(`${BASE_URL}/api/upload/signed-url`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        filename: 'get-test.png',
        mime_type: 'image/png',
        file_size: 1024,
      },
    });

    const signedUrlData = await signedUrlResponse.json();

    const screenshotResponse = await request.post(`${BASE_URL}/api/screenshots`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        storage_path: signedUrlData.storage_path,
        filename: 'get-test.png',
        file_size: 1024,
        width: 1920,
        height: 1080,
        mime_type: 'image/png',
      },
    });

    const screenshotData = await screenshotResponse.json();
    screenshotId = screenshotData.id;

    // Create second user and screenshot for ownership tests
    const otherEmail = `test-other-${Date.now()}@example.com`;
    const otherSignupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: otherEmail,
        password: 'SecurePass123!',
        full_name: 'Other User',
      },
    });

    const otherSignupData = await otherSignupResponse.json();
    otherUserToken = otherSignupData.session.access_token;

    const otherSignedUrlResponse = await request.post(`${BASE_URL}/api/upload/signed-url`, {
      headers: {
        Authorization: `Bearer ${otherUserToken}`,
      },
      data: {
        filename: 'other-test.png',
        mime_type: 'image/png',
        file_size: 1024,
      },
    });

    const otherSignedUrlData = await otherSignedUrlResponse.json();

    const otherScreenshotResponse = await request.post(`${BASE_URL}/api/screenshots`, {
      headers: {
        Authorization: `Bearer ${otherUserToken}`,
      },
      data: {
        storage_path: otherSignedUrlData.storage_path,
        filename: 'other-test.png',
        file_size: 1024,
        width: 1920,
        height: 1080,
        mime_type: 'image/png',
      },
    });

    const otherScreenshotData = await otherScreenshotResponse.json();
    otherUserScreenshotId = otherScreenshotData.id;
  });

  test('should return screenshot details', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/screenshots/${screenshotId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.id).toBe(screenshotId);
    expect(body.original_filename).toBe('get-test.png');
    expect(body.file_size).toBe(1024);
    expect(body.width).toBe(1920);
    expect(body.height).toBe(1080);
    expect(body.mime_type).toBe('image/png');
    expect(body).toHaveProperty('short_id');
    expect(body).toHaveProperty('storage_url');
    expect(body).toHaveProperty('share_url');
    expect(body).toHaveProperty('views');
    expect(body).toHaveProperty('is_public');
    expect(body).toHaveProperty('created_at');
    expect(body).toHaveProperty('updated_at');
  });

  test('should return 401 when no auth token provided', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/screenshots/${screenshotId}`);
    expect(response.status()).toBe(401);
  });

  test('should return 404 for non-existent screenshot', async ({ request }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const response = await request.get(`${BASE_URL}/api/screenshots/${fakeId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(404);
  });

  test('should return 404 when accessing another user screenshot', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/screenshots/${otherUserScreenshotId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(404);
  });

  test('should return 400 for invalid UUID format', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/screenshots/invalid-id`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(400);
  });
});

