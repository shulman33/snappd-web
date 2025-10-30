/**
 * Contract test for PATCH /api/screenshots/[id]
 * Tests screenshot metadata updates
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('PATCH /api/screenshots/[id]', () => {
  let accessToken: string;
  let screenshotId: string;

  test.beforeEach(async ({ request }) => {
    // Create new user and screenshot for each test
    const uniqueEmail = `test-update-${Date.now()}@example.com`;
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'SecurePass123!',
        full_name: 'Update Test User',
      },
    });

    const signupData = await signupResponse.json();
    accessToken = signupData.session.access_token;

    const signedUrlResponse = await request.post(`${BASE_URL}/api/upload/signed-url`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        filename: 'update-test.png',
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
        filename: 'update-test.png',
        file_size: 1024,
        width: 1920,
        height: 1080,
        mime_type: 'image/png',
      },
    });

    const screenshotData = await screenshotResponse.json();
    screenshotId = screenshotData.id;
  });

  test('should update original_filename', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/screenshots/${screenshotId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        original_filename: 'renamed-file.png',
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.original_filename).toBe('renamed-file.png');
  });

  test('should update is_public flag', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/screenshots/${screenshotId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        is_public: false,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.is_public).toBe(false);
  });

  test('should update both filename and is_public', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/screenshots/${screenshotId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        original_filename: 'private-renamed.png',
        is_public: false,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.original_filename).toBe('private-renamed.png');
    expect(body.is_public).toBe(false);
  });

  test('should return 401 when no auth token provided', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/screenshots/${screenshotId}`, {
      data: {
        original_filename: 'unauthorized.png',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('should return 404 for non-existent screenshot', async ({ request }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const response = await request.patch(`${BASE_URL}/api/screenshots/${fakeId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        original_filename: 'test.png',
      },
    });

    expect(response.status()).toBe(404);
  });

  test('should reject empty update', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/screenshots/${screenshotId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {},
    });

    expect(response.status()).toBe(400);
  });

  test('should not allow updating immutable fields', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/screenshots/${screenshotId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        file_size: 99999, // Attempt to modify immutable field
      },
    });

    // Should either ignore or reject
    if (response.status() === 200) {
      const body = await response.json();
      expect(body.file_size).toBe(1024); // Original value
    } else {
      expect(response.status()).toBe(400);
    }
  });

  test('should update updated_at timestamp', async ({ request }) => {
    // Get original timestamp
    const getResponse = await request.get(`${BASE_URL}/api/screenshots/${screenshotId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const originalData = await getResponse.json();
    const originalUpdatedAt = new Date(originalData.updated_at);

    // Wait and update
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const updateResponse = await request.patch(`${BASE_URL}/api/screenshots/${screenshotId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        original_filename: 'timestamp-test.png',
      },
    });

    const updatedData = await updateResponse.json();
    const newUpdatedAt = new Date(updatedData.updated_at);

    expect(newUpdatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });
});

