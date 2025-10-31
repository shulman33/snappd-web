/**
 * Contract test for GET /api/screenshots/[id]/download
 * Tests signed download URL generation
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('GET /api/screenshots/[id]/download', () => {
  let accessToken: string;
  let screenshotId: string;

  test.beforeAll(async ({ request }) => {
    const uniqueEmail = `test-download-${Date.now()}@example.com`;
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'SecurePass123!',
        full_name: 'Download Test User',
      },
    });

    const signupData = await signupResponse.json();
    accessToken = signupData.session.access_token;

    // Create screenshot
    const signedUrlResponse = await request.post(`${BASE_URL}/api/upload/signed-url`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        filename: 'download-test.png',
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
        filename: 'download-test.png',
        file_size: 1024,
        width: 1920,
        height: 1080,
        mime_type: 'image/png',
      },
    });

    const screenshotData = await screenshotResponse.json();
    screenshotId = screenshotData.id;
  });

  test('should generate signed download URL', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/screenshots/${screenshotId}/download`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('download_url');
    expect(body).toHaveProperty('expires_in');
    expect(body.download_url).toBeTruthy();
    expect(body.expires_in).toBeGreaterThan(0);
    
    // Signed URL should contain Supabase storage domain
    expect(body.download_url).toContain('supabase');
  });

  test('should return 401 when no auth token provided', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/screenshots/${screenshotId}/download`
    );
    expect(response.status()).toBe(401);
  });

  test('should return 404 for non-existent screenshot', async ({ request }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const response = await request.get(`${BASE_URL}/api/screenshots/${fakeId}/download`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(404);
  });

  test('should prevent downloading another user screenshot', async ({ request }) => {
    // Create second user and screenshot
    const otherEmail = `test-other-download-${Date.now()}@example.com`;
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
        filename: 'other-user-download.png',
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
        short_id: otherSignedUrlData.short_id,
        storage_path: otherSignedUrlData.storage_path,
        original_filename: 'other-user-download.png',
        file_size: 1024,
        width: 1920,
        height: 1080,
        mime_type: 'image/png',
      },
    });

    const otherScreenshotData = await otherScreenshotResponse.json();

    // Try to download as first user
    const downloadResponse = await request.get(
      `${BASE_URL}/api/screenshots/${otherScreenshotData.id}/download`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    expect(downloadResponse.status()).toBe(404);
  });

  test('should generate different URLs on subsequent requests', async ({ request }) => {
    const firstResponse = await request.get(
      `${BASE_URL}/api/screenshots/${screenshotId}/download`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const firstData = await firstResponse.json();

    // Wait a moment
    await new Promise((resolve) => setTimeout(resolve, 100));

    const secondResponse = await request.get(
      `${BASE_URL}/api/screenshots/${screenshotId}/download`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const secondData = await secondResponse.json();

    // URLs should be different (different tokens/expiry)
    expect(firstData.download_url).not.toBe(secondData.download_url);
  });

  test('should include expiration time', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/screenshots/${screenshotId}/download`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const body = await response.json();
    
    // Default expiration should be 1 hour (3600 seconds)
    expect(body.expires_in).toBe(3600);
  });
});

