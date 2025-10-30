/**
 * Contract test for GET /api/screenshots (list)
 * Tests screenshot history with pagination and filtering
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('GET /api/screenshots', () => {
  let accessToken: string;
  let screenshotIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    const uniqueEmail = `test-list-${Date.now()}@example.com`;
    
    // Create user
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'SecurePass123!',
        full_name: 'List Test User',
      },
    });

    const signupData = await signupResponse.json();
    accessToken = signupData.session.access_token;

    // Create multiple screenshots for testing
    for (let i = 0; i < 5; i++) {
      const signedUrlResponse = await request.post(`${BASE_URL}/api/upload/signed-url`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        data: {
          filename: `test-${i}.png`,
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
          filename: `test-${i}.png`,
          file_size: 1024 * (i + 1),
          width: 1920,
          height: 1080,
          mime_type: 'image/png',
        },
      });

      const screenshotData = await screenshotResponse.json();
      screenshotIds.push(screenshotData.id);
    }
  });

  test('should return user screenshots', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/screenshots`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('screenshots');
    expect(body).toHaveProperty('pagination');
    expect(Array.isArray(body.screenshots)).toBe(true);
    expect(body.screenshots.length).toBeGreaterThanOrEqual(5);

    // Verify screenshot structure
    const screenshot = body.screenshots[0];
    expect(screenshot).toHaveProperty('id');
    expect(screenshot).toHaveProperty('short_id');
    expect(screenshot).toHaveProperty('original_filename');
    expect(screenshot).toHaveProperty('file_size');
    expect(screenshot).toHaveProperty('width');
    expect(screenshot).toHaveProperty('height');
    expect(screenshot).toHaveProperty('views');
    expect(screenshot).toHaveProperty('is_public');
    expect(screenshot).toHaveProperty('created_at');
  });

  test('should return 401 when no auth token provided', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/screenshots`);
    expect(response.status()).toBe(401);
  });

  test('should support pagination with limit', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/screenshots?limit=2`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.screenshots.length).toBeLessThanOrEqual(2);
    expect(body.pagination.limit).toBe(2);
  });

  test('should support pagination with offset', async ({ request }) => {
    const firstResponse = await request.get(`${BASE_URL}/api/screenshots?limit=2`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const firstData = await firstResponse.json();
    const firstScreenshot = firstData.screenshots[0];

    const secondResponse = await request.get(`${BASE_URL}/api/screenshots?limit=2&offset=2`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const secondData = await secondResponse.json();
    const secondScreenshot = secondData.screenshots[0];

    // Screenshots should be different
    expect(firstScreenshot.id).not.toBe(secondScreenshot.id);
  });

  test('should filter by filename search', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/screenshots?search=test-0`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.screenshots.length).toBeGreaterThan(0);
    
    const hasMatch = body.screenshots.some(
      (s: any) => s.original_filename.includes('test-0')
    );
    expect(hasMatch).toBe(true);
  });

  test('should filter by date range', async ({ request }) => {
    const today = new Date().toISOString().split('T')[0];
    
    const response = await request.get(
      `${BASE_URL}/api/screenshots?from_date=${today}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.screenshots.length).toBeGreaterThan(0);
  });

  test('should sort by created_at descending by default', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/screenshots`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const body = await response.json();
    
    if (body.screenshots.length >= 2) {
      const first = new Date(body.screenshots[0].created_at);
      const second = new Date(body.screenshots[1].created_at);
      expect(first.getTime()).toBeGreaterThanOrEqual(second.getTime());
    }
  });

  test('should include pagination metadata', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/screenshots?limit=2`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const body = await response.json();
    expect(body.pagination).toHaveProperty('total');
    expect(body.pagination).toHaveProperty('limit');
    expect(body.pagination).toHaveProperty('offset');
    expect(body.pagination.total).toBeGreaterThanOrEqual(5);
  });

  test('should return empty array for user with no screenshots', async ({ request }) => {
    // Create new user with no screenshots
    const newEmail = `test-empty-${Date.now()}@example.com`;
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: newEmail,
        password: 'SecurePass123!',
        full_name: 'Empty User',
      },
    });

    const signupData = await signupResponse.json();
    const newToken = signupData.session.access_token;

    const response = await request.get(`${BASE_URL}/api/screenshots`, {
      headers: {
        Authorization: `Bearer ${newToken}`,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.screenshots).toEqual([]);
    expect(body.pagination.total).toBe(0);
  });
});

