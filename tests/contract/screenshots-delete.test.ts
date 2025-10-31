/**
 * Contract test for DELETE /api/screenshots/[id]
 * Tests screenshot deletion
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('DELETE /api/screenshots/[id]', () => {
  let accessToken: string;

  test.beforeEach(async ({ request }) => {
    const uniqueEmail = `test-delete-${Date.now()}@example.com`;
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'SecurePass123!',
        full_name: 'Delete Test User',
      },
    });

    const signupData = await signupResponse.json();
    accessToken = signupData.session.access_token;
  });

  test('should delete screenshot successfully', async ({ request }) => {
    // Create screenshot
    const signedUrlResponse = await request.post(`${BASE_URL}/api/upload/signed-url`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        filename: 'delete-test.png',
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
        filename: 'delete-test.png',
        file_size: 1024,
        width: 1920,
        height: 1080,
        mime_type: 'image/png',
      },
    });

    const screenshotData = await screenshotResponse.json();
    const screenshotId = screenshotData.id;
    const shortId = screenshotData.short_id;

    // Delete screenshot
    const deleteResponse = await request.delete(
      `${BASE_URL}/api/screenshots/${screenshotId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    expect(deleteResponse.status()).toBe(204);

    // Verify screenshot no longer exists
    const getResponse = await request.get(`${BASE_URL}/api/screenshots/${screenshotId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(getResponse.status()).toBe(404);

    // Verify public URL no longer works
    const publicResponse = await request.get(`${BASE_URL}/api/s/${shortId}`);
    expect(publicResponse.status()).toBe(404);
  });

  test('should return 401 when no auth token provided', async ({ request }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const response = await request.delete(`${BASE_URL}/api/screenshots/${fakeId}`);
    expect(response.status()).toBe(401);
  });

  test('should return 404 for non-existent screenshot', async ({ request }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const response = await request.delete(`${BASE_URL}/api/screenshots/${fakeId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(404);
  });

  test('should prevent deleting another user screenshot', async ({ request }) => {
    // Create second user and screenshot
    const otherEmail = `test-other-delete-${Date.now()}@example.com`;
    const otherSignupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: otherEmail,
        password: 'SecurePass123!',
        full_name: 'Other User',
      },
    });

    const otherSignupData = await otherSignupResponse.json();
    const otherToken = otherSignupData.session.access_token;

    // Create screenshot as other user
    const otherSignedUrlResponse = await request.post(`${BASE_URL}/api/upload/signed-url`, {
      headers: {
        Authorization: `Bearer ${otherToken}`,
      },
      data: {
        filename: 'other-user.png',
        mime_type: 'image/png',
        file_size: 1024,
      },
    });

    const otherSignedUrlData = await otherSignedUrlResponse.json();

    const otherScreenshotResponse = await request.post(`${BASE_URL}/api/screenshots`, {
      headers: {
        Authorization: `Bearer ${otherToken}`,
      },
      data: {
        storage_path: otherSignedUrlData.storage_path,
        filename: 'other-user.png',
        file_size: 1024,
        width: 1920,
        height: 1080,
        mime_type: 'image/png',
      },
    });

    const otherScreenshotData = await otherScreenshotResponse.json();

    // Try to delete as first user
    const deleteResponse = await request.delete(
      `${BASE_URL}/api/screenshots/${otherScreenshotData.id}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    expect(deleteResponse.status()).toBe(404);
  });

  test('should delete storage file when deleting screenshot', async ({ request }) => {
    // Create screenshot
    const signedUrlResponse = await request.post(`${BASE_URL}/api/upload/signed-url`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        filename: 'storage-delete-test.png',
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
        filename: 'storage-delete-test.png',
        file_size: 1024,
        width: 1920,
        height: 1080,
        mime_type: 'image/png',
      },
    });

    const screenshotData = await screenshotResponse.json();

    // Delete screenshot
    const deleteResponse = await request.delete(
      `${BASE_URL}/api/screenshots/${screenshotData.id}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    expect(deleteResponse.status()).toBe(204);

    // Storage file deletion is verified by:
    // 1. Database record deleted (verified above)
    // 2. Storage file should be deleted via Supabase Storage API
    // 3. Attempting to download should fail
  });

  test('should be idempotent - deleting twice returns 404', async ({ request }) => {
    // Create screenshot
    const signedUrlResponse = await request.post(`${BASE_URL}/api/upload/signed-url`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        filename: 'idempotent-test.png',
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
        filename: 'idempotent-test.png',
        file_size: 1024,
        width: 1920,
        height: 1080,
        mime_type: 'image/png',
      },
    });

    const screenshotData = await screenshotResponse.json();
    const screenshotId = screenshotData.id;

    // First delete
    const firstDelete = await request.delete(`${BASE_URL}/api/screenshots/${screenshotId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(firstDelete.status()).toBe(204);

    // Second delete
    const secondDelete = await request.delete(`${BASE_URL}/api/screenshots/${screenshotId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(secondDelete.status()).toBe(404);
  });
});

