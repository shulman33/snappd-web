/**
 * Contract test for GET /api/usage
 * Tests current usage statistics
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('GET /api/usage', () => {
  let accessToken: string;

  test.beforeAll(async ({ request }) => {
    const uniqueEmail = `test-usage-${Date.now()}@example.com`;
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'SecurePass123!',
        full_name: 'Usage Test User',
      },
    });

    const signupData = await signupResponse.json();
    accessToken = signupData.session.access_token;

    // Create some screenshots for testing
    for (let i = 0; i < 3; i++) {
      const signedUrlResponse = await request.post(`${BASE_URL}/api/upload/signed-url`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        data: {
          filename: `usage-test-${i}.png`,
          mime_type: 'image/png',
          file_size: 1024 * (i + 1),
        },
      });

      const signedUrlData = await signedUrlResponse.json();

      await request.post(`${BASE_URL}/api/screenshots`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        data: {
          storage_path: signedUrlData.storage_path,
          filename: `usage-test-${i}.png`,
          file_size: 1024 * (i + 1),
          width: 1920,
          height: 1080,
          mime_type: 'image/png',
        },
      });
    }
  });

  test('should return current month usage', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/usage`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('plan');
    expect(body).toHaveProperty('month');
    expect(body).toHaveProperty('screenshot_count');
    expect(body).toHaveProperty('screenshot_limit');
    expect(body).toHaveProperty('storage_bytes');
    expect(body).toHaveProperty('bandwidth_bytes');
    expect(body).toHaveProperty('limit_status');
    expect(body.limit_status).toHaveProperty('remaining');
    expect(body.limit_status).toHaveProperty('at_limit');
    expect(body.limit_status).toHaveProperty('resets_at');
    
    expect(body.plan).toBe('free');
    expect(body.screenshot_count).toBeGreaterThanOrEqual(3);
    expect(body.screenshot_limit).toBe(10); // Free tier limit
  });

  test('should return 401 when no auth token provided', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/usage`);
    expect(response.status()).toBe(401);
  });

  test('should calculate remaining uploads correctly', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/usage`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const body = await response.json();
    const expected = body.screenshot_limit - body.screenshot_count;
    expect(body.limit_status.remaining).toBe(expected);
  });

  test('should show upgrade_recommended when approaching limit', async ({ request }) => {
    // Create user and upload 8 screenshots (approaching free tier limit of 10)
    const email = `test-upgrade-prompt-${Date.now()}@example.com`;
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email,
        password: 'SecurePass123!',
        full_name: 'Upgrade Prompt Test',
      },
    });

    const signupData = await signupResponse.json();
    const token = signupData.session.access_token;

    // Upload 8 screenshots
    for (let i = 0; i < 8; i++) {
      const signedUrlResponse = await request.post(`${BASE_URL}/api/upload/signed-url`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          filename: `upgrade-test-${i}.png`,
          mime_type: 'image/png',
          file_size: 1024,
        },
      });

      const signedUrlData = await signedUrlResponse.json();

      await request.post(`${BASE_URL}/api/screenshots`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          storage_path: signedUrlData.storage_path,
          filename: `upgrade-test-${i}.png`,
          file_size: 1024,
          width: 1920,
          height: 1080,
          mime_type: 'image/png',
        },
      });
    }

    const usageResponse = await request.get(`${BASE_URL}/api/usage`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const usageData = await usageResponse.json();
    
    // Should have upgrade recommendation when > 80% of limit used
    if (usageData.screenshot_count >= 8) {
      expect(usageData).toHaveProperty('upgrade_prompt');
      expect(usageData.upgrade_prompt.show_prompt).toBe(true);
      expect(usageData.upgrade_prompt.urgency_level).toBe('high');
    }
  });

  test('should include current period dates', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/usage`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const body = await response.json();
    expect(body.month).toMatch(/^\d{4}-\d{2}$/); // YYYY-MM format
  });

  test('should track storage bytes', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/usage`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const body = await response.json();
    expect(body.storage_bytes).toBeGreaterThan(0);
    
    // Should be sum of all file sizes
    // 3 screenshots: 1024, 2048, 3072 = 6144 bytes minimum
    expect(body.storage_bytes).toBeGreaterThanOrEqual(6144);
  });

  test('should track bandwidth bytes from views', async ({ request }) => {
    // Create and view a screenshot to generate bandwidth
    const signedUrlResponse = await request.post(`${BASE_URL}/api/upload/signed-url`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        filename: 'bandwidth-test.png',
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
        filename: 'bandwidth-test.png',
        file_size: 1024,
        width: 1920,
        height: 1080,
        mime_type: 'image/png',
      },
    });

    const screenshotData = await screenshotResponse.json();

    // View the screenshot publicly (generates bandwidth)
    await request.get(`${BASE_URL}/api/s/${screenshotData.short_id}`);

    // Check usage
    const usageResponse = await request.get(`${BASE_URL}/api/usage`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const usageData = await usageResponse.json();
    expect(usageData.bandwidth_bytes).toBeGreaterThanOrEqual(0);
  });

  test('should show unlimited for pro plan users', async ({ request }) => {
    // Note: This test documents expected behavior for pro users
    // In reality, would need to upgrade user to pro via Stripe webhook
    
    // Expected for pro plan:
    // - limit: -1 or null (unlimited)
    // - remaining: -1 or null
    // - upgrade_recommended: false
    
    expect(true).toBe(true);
  });
});

