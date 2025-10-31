/**
 * Contract test for GET /api/usage/history
 * Tests historical usage statistics
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('GET /api/usage/history', () => {
  let accessToken: string;

  test.beforeAll(async ({ request }) => {
    const uniqueEmail = `test-history-${Date.now()}@example.com`;
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'SecurePass123!',
        full_name: 'History Test User',
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
          filename: `history-test-${i}.png`,
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
          filename: `history-test-${i}.png`,
          file_size: 1024,
          width: 1920,
          height: 1080,
          mime_type: 'image/png',
        },
      });
    }
  });

  test('should return usage history', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/usage/history`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('months');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.months)).toBe(true);
  });

  test('should return 401 when no auth token provided', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/usage/history`);
    expect(response.status()).toBe(401);
  });

  test('should include current month in history', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/usage/history`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const body = await response.json();
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    const currentMonthData = body.months.find((h: any) => h.month === currentMonth);
    expect(currentMonthData).toBeDefined();
    
    if (currentMonthData) {
      expect(currentMonthData).toHaveProperty('screenshot_count');
      expect(currentMonthData).toHaveProperty('storage_mb');
      expect(currentMonthData).toHaveProperty('bandwidth_mb');
      expect(currentMonthData.screenshot_count).toBeGreaterThanOrEqual(3);
    }
  });

  test('should calculate aggregate totals', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/usage/history`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const body = await response.json();
    expect(body.total).toHaveProperty('screenshots');
    expect(body.total).toHaveProperty('storage_mb');
    expect(body.total).toHaveProperty('bandwidth_mb');
    
    expect(body.total.screenshots).toBeGreaterThanOrEqual(3);
    expect(body.total.storage_mb).toBeGreaterThan(0);
  });

  test('should sort history by month descending', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/usage/history`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const body = await response.json();
    
    if (body.months.length >= 2) {
      const first = body.months[0].month;
      const second = body.months[1].month;
      expect(first >= second).toBe(true);
    }
  });

  test('should limit history to recent months', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/usage/history`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const body = await response.json();
    
    // Should not return more than 12 months of history
    expect(body.months.length).toBeLessThanOrEqual(12);
  });

  test('should handle users with no usage history', async ({ request }) => {
    // Create new user with no screenshots
    const newEmail = `test-no-history-${Date.now()}@example.com`;
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: newEmail,
        password: 'SecurePass123!',
        full_name: 'No History User',
      },
    });

    const signupData = await signupResponse.json();
    const newToken = signupData.session.access_token;

    const historyResponse = await request.get(`${BASE_URL}/api/usage/history`, {
      headers: {
        Authorization: `Bearer ${newToken}`,
      },
    });

    expect(historyResponse.status()).toBe(200);
    const historyData = await historyResponse.json();
    expect(historyData.months.length).toBe(6); // API returns 6 months by default, even with 0 usage
    expect(historyData.total.screenshots).toBe(0);
    expect(historyData.total.storage_mb).toBe(0);
    expect(historyData.total.bandwidth_mb).toBe(0);
  });

  test('should show month format as YYYY-MM', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/usage/history`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const body = await response.json();
    
    if (body.months.length > 0) {
      expect(body.months[0].month).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  test('should include all usage metrics per month', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/usage/history`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const body = await response.json();
    
    if (body.months.length > 0) {
      const monthData = body.months[0];
      expect(monthData).toHaveProperty('month');
      expect(monthData).toHaveProperty('screenshot_count');
      expect(monthData).toHaveProperty('storage_mb');
      expect(monthData).toHaveProperty('bandwidth_mb');
      
      expect(typeof monthData.screenshot_count).toBe('number');
      expect(typeof monthData.storage_mb).toBe('number');
      expect(typeof monthData.bandwidth_mb).toBe('number');
    }
  });
});

