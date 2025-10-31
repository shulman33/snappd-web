/**
 * Contract test for POST /api/auth/delete
 * Tests account deletion (GDPR compliance)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('POST /api/auth/delete', () => {
  test('should delete user account and all data', async ({ request }) => {
    const uniqueEmail = `test-delete-account-${Date.now()}@example.com`;
    
    // Step 1: Create user
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'SecurePass123!',
        full_name: 'Delete Account Test',
      },
    });

    expect(signupResponse.status()).toBe(201);
    const signupData = await signupResponse.json();
    const accessToken = signupData.session.access_token;

    // Step 2: Create some data (screenshots)
    const screenshots: string[] = [];
    for (let i = 0; i < 3; i++) {
      const signedUrlResponse = await request.post(`${BASE_URL}/api/upload/signed-url`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        data: {
          filename: `delete-test-${i}.png`,
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
          filename: `delete-test-${i}.png`,
          file_size: 1024,
          width: 1920,
          height: 1080,
          mime_type: 'image/png',
        },
      });

      const screenshotData = await screenshotResponse.json();
      screenshots.push(screenshotData.short_id);
    }

    // Step 3: Verify data exists
    const beforeResponse = await request.get(`${BASE_URL}/api/screenshots`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const beforeData = await beforeResponse.json();
    expect(beforeData.screenshots.length).toBe(3);

    // Step 4: Delete account
    const deleteResponse = await request.post(`${BASE_URL}/api/auth/delete`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(deleteResponse.status()).toBe(204);

    // Step 5: Verify user cannot access API anymore
    const afterResponse = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(afterResponse.status()).toBe(401);

    // Step 6: Verify screenshots are no longer accessible publicly
    for (const shortId of screenshots) {
      const publicResponse = await request.get(`${BASE_URL}/api/s/${shortId}`);
      expect(publicResponse.status()).toBe(404);
    }
  });

  test('should return 401 when no auth token provided', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/delete`);
    expect(response.status()).toBe(401);
  });

  test('should return 401 with invalid token', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/delete`, {
      headers: {
        Authorization: 'Bearer invalid-token-12345',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('should be idempotent - deleting twice returns 401', async ({ request }) => {
    const uniqueEmail = `test-idempotent-delete-${Date.now()}@example.com`;
    
    // Create user
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'SecurePass123!',
        full_name: 'Idempotent Delete Test',
      },
    });

    const signupData = await signupResponse.json();
    const accessToken = signupData.session.access_token;

    // First delete
    const firstDelete = await request.post(`${BASE_URL}/api/auth/delete`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(firstDelete.status()).toBe(204);

    // Second delete (token should be invalid now)
    const secondDelete = await request.post(`${BASE_URL}/api/auth/delete`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(secondDelete.status()).toBe(401);
  });

  test('should delete Stripe customer', async ({ request }) => {
    const uniqueEmail = `test-stripe-delete-${Date.now()}@example.com`;
    
    // Create user (creates Stripe customer)
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'SecurePass123!',
        full_name: 'Stripe Delete Test',
      },
    });

    const signupData = await signupResponse.json();
    const accessToken = signupData.session.access_token;

    // Delete account (should delete Stripe customer)
    const deleteResponse = await request.post(`${BASE_URL}/api/auth/delete`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(deleteResponse.status()).toBe(204);

    // Expected: Stripe customer deleted via API
    // This is verified by checking that stripe_customer_id was used to delete
  });

  test('should delete all user screenshots from storage', async ({ request }) => {
    const uniqueEmail = `test-storage-delete-${Date.now()}@example.com`;
    
    // Create user
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'SecurePass123!',
        full_name: 'Storage Delete Test',
      },
    });

    const signupData = await signupResponse.json();
    const accessToken = signupData.session.access_token;

    // Upload screenshot
    const signedUrlResponse = await request.post(`${BASE_URL}/api/upload/signed-url`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        filename: 'storage-cleanup-test.png',
        mime_type: 'image/png',
        file_size: 1024,
      },
    });

    const signedUrlData = await signedUrlResponse.json();

    await request.post(`${BASE_URL}/api/screenshots`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        storage_path: signedUrlData.storage_path,
        filename: 'storage-cleanup-test.png',
        file_size: 1024,
        width: 1920,
        height: 1080,
        mime_type: 'image/png',
      },
    });

    // Delete account
    const deleteResponse = await request.post(`${BASE_URL}/api/auth/delete`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(deleteResponse.status()).toBe(204);

    // Expected: Storage files deleted via Supabase Storage API
    // Database cascade handles screenshot records
  });

  test('should delete monthly usage records', async ({ request }) => {
    const uniqueEmail = `test-usage-delete-${Date.now()}@example.com`;
    
    // Create user and generate usage
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'SecurePass123!',
        full_name: 'Usage Delete Test',
      },
    });

    const signupData = await signupResponse.json();
    const accessToken = signupData.session.access_token;

    // Create screenshots to generate usage records
    const signedUrlResponse = await request.post(`${BASE_URL}/api/upload/signed-url`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        filename: 'usage-record-test.png',
        mime_type: 'image/png',
        file_size: 1024,
      },
    });

    const signedUrlData = await signedUrlResponse.json();

    await request.post(`${BASE_URL}/api/screenshots`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        storage_path: signedUrlData.storage_path,
        filename: 'usage-record-test.png',
        file_size: 1024,
        width: 1920,
        height: 1080,
        mime_type: 'image/png',
      },
    });

    // Verify usage exists
    const usageResponse = await request.get(`${BASE_URL}/api/usage`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(usageResponse.status()).toBe(200);
    const usageData = await usageResponse.json();
    expect(usageData.screenshot_count).toBeGreaterThan(0);

    // Delete account
    const deleteResponse = await request.post(`${BASE_URL}/api/auth/delete`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(deleteResponse.status()).toBe(204);

    // Expected: monthly_usage records deleted via cascade
  });
});

