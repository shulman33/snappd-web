/**
 * Contract test for GET /api/s/[shortId]
 * Tests public screenshot viewer endpoint
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('GET /api/s/[shortId]', () => {
  let accessToken: string;
  let validShortId: string;
  let privateShortId: string;

  test.beforeAll(async ({ request }) => {
    // Create test user and get access token
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: `test-public-${Date.now()}@example.com`,
        password: 'SecurePass123!',
        full_name: 'Test User',
      },
    });

    const signupData = await signupResponse.json();
    accessToken = signupData.session.access_token;

    // Create a public screenshot for testing
    const signedUrlResponse = await request.post(`${BASE_URL}/api/upload/signed-url`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        filename: 'test-screenshot.png',
        mime_type: 'image/png',
        file_size: 1024,
      },
    });

    const signedUrlData = await signedUrlResponse.json();
    validShortId = signedUrlData.short_id;

    // Create screenshot record (simulating successful upload)
    const screenshotResponse = await request.post(`${BASE_URL}/api/screenshots`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        storage_path: signedUrlData.storage_path,
        filename: 'test-screenshot.png',
        file_size: 1024,
        width: 1920,
        height: 1080,
        mime_type: 'image/png',
      },
    });

    const screenshotData = await screenshotResponse.json();
    
    // Create a private screenshot
    const privateSignedUrlResponse = await request.post(`${BASE_URL}/api/upload/signed-url`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        filename: 'private-screenshot.png',
        mime_type: 'image/png',
        file_size: 1024,
      },
    });

    const privateSignedUrlData = await privateSignedUrlResponse.json();
    privateShortId = privateSignedUrlData.short_id;

    // Create private screenshot and set is_public to false
    const privateScreenshotResponse = await request.post(`${BASE_URL}/api/screenshots`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        storage_path: privateSignedUrlData.storage_path,
        filename: 'private-screenshot.png',
        file_size: 1024,
        width: 1920,
        height: 1080,
        mime_type: 'image/png',
      },
    });

    const privateScreenshotData = await privateScreenshotResponse.json();

    // Update the private screenshot to make it private
    await request.patch(`${BASE_URL}/api/screenshots/${privateScreenshotData.id}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        is_public: false,
      },
    });
  });

  test('should return 404 for invalid short ID format', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/s/invalid!@#`);
    expect(response.status()).toBe(404);
  });

  test('should return 404 for non-existent short ID', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/s/zzzzzz`);
    expect(response.status()).toBe(404);
  });

  test('should return 404 for private screenshot', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/s/${privateShortId}`);
    expect(response.status()).toBe(404);
  });

  test('should return public screenshot with metadata', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/s/${validShortId}`);
    
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('short_id');
    expect(body).toHaveProperty('original_filename');
    expect(body).toHaveProperty('width');
    expect(body).toHaveProperty('height');
    expect(body).toHaveProperty('storage_url');
    expect(body).toHaveProperty('views');
    expect(body).toHaveProperty('created_at');
    expect(body).toHaveProperty('seo_metadata');

    expect(body.short_id).toBe(validShortId);
    expect(body.original_filename).toBe('test-screenshot.png');
    expect(body.width).toBe(1920);
    expect(body.height).toBe(1080);
    expect(body.seo_metadata).toHaveProperty('title');
    expect(body.seo_metadata).toHaveProperty('description');
    expect(body.seo_metadata).toHaveProperty('image');
  });

  test('should increment view count on each access', async ({ request }) => {
    // First access
    const firstResponse = await request.get(`${BASE_URL}/api/s/${validShortId}`);
    const firstData = await firstResponse.json();
    const firstViews = firstData.views;

    // Second access
    const secondResponse = await request.get(`${BASE_URL}/api/s/${validShortId}`);
    const secondData = await secondResponse.json();
    const secondViews = secondData.views;

    // View count should increment
    expect(secondViews).toBeGreaterThan(firstViews);
  });

  test('should work without authentication (public access)', async ({ request }) => {
    // No Authorization header
    const response = await request.get(`${BASE_URL}/api/s/${validShortId}`);
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.short_id).toBe(validShortId);
  });

  test('should return 410 Gone for expired screenshot', async ({ request }) => {
    // Create an expired screenshot
    const expiredSignedUrlResponse = await request.post(`${BASE_URL}/api/upload/signed-url`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        filename: 'expired-screenshot.png',
        mime_type: 'image/png',
        file_size: 1024,
      },
    });

    const expiredSignedUrlData = await expiredSignedUrlResponse.json();
    const expiredShortId = expiredSignedUrlData.short_id;

    // Create screenshot with past expiration date
    await request.post(`${BASE_URL}/api/screenshots`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        short_id: expiredShortId,
        storage_path: expiredSignedUrlData.storage_path,
        original_filename: 'expired-screenshot.png',
        file_size: 1024,
        width: 1920,
        height: 1080,
        mime_type: 'image/png',
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
      },
    });

    const response = await request.get(`${BASE_URL}/api/s/${expiredShortId}`);
    expect(response.status()).toBe(410);
    
    const body = await response.json();
    expect(body.error.code).toBe('RESOURCE_GONE');
  });
});

