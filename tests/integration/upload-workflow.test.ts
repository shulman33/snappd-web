/**
 * Integration test for full upload-to-share workflow
 * Tests the complete flow: signup → upload → share → public view
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Full Upload-to-Share Workflow', () => {
  test('should complete full upload and share workflow', async ({ request }) => {
    const uniqueEmail = `test-workflow-${Date.now()}@example.com`;
    
    // Step 1: User signs up
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'SecurePass123!',
        full_name: 'Integration Test User',
      },
    });

    expect(signupResponse.status()).toBe(201);
    const signupData = await signupResponse.json();
    expect(signupData).toHaveProperty('session');
    expect(signupData.session).toHaveProperty('access_token');
    
    const accessToken = signupData.session.access_token;

    // Step 2: User requests signed upload URL
    const signedUrlResponse = await request.post(`${BASE_URL}/api/upload/signed-url`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        filename: 'integration-test.png',
        mime_type: 'image/png',
        file_size: 2048,
      },
    });

    expect(signedUrlResponse.status()).toBe(200);
    const signedUrlData = await signedUrlResponse.json();
    expect(signedUrlData).toHaveProperty('upload_url');
    expect(signedUrlData).toHaveProperty('storage_path');
    expect(signedUrlData).toHaveProperty('short_id');
    expect(signedUrlData).toHaveProperty('expires_in');
    
    const { upload_url, storage_path, short_id, expires_in } = signedUrlData;
    
    // Validate response structure
    expect(short_id).toHaveLength(6);
    expect(expires_in).toBe(300);
    expect(storage_path).toContain(signupData.user.id);
    expect(storage_path).toContain(short_id);

    // Step 3: User uploads file to signed URL (simulated - we skip actual S3 upload in tests)
    // In a real scenario, client would PUT file to upload_url
    // For testing, we proceed to metadata creation

    // Step 4: User creates screenshot metadata record
    const screenshotResponse = await request.post(`${BASE_URL}/api/screenshots`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        short_id,
        storage_path,
        original_filename: 'integration-test.png',
        file_size: 2048,
        width: 1920,
        height: 1080,
        mime_type: 'image/png',
      },
    });

    expect(screenshotResponse.status()).toBe(201);
    const screenshotData = await screenshotResponse.json();
    expect(screenshotData).toHaveProperty('id');
    expect(screenshotData).toHaveProperty('short_id');
    expect(screenshotData).toHaveProperty('share_url');
    expect(screenshotData.short_id).toBe(short_id);
    expect(screenshotData.share_url).toContain(`/s/${short_id}`);

    const screenshotId = screenshotData.id;

    // Step 5: User views their screenshot in history
    const historyResponse = await request.get(`${BASE_URL}/api/screenshots`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(historyResponse.status()).toBe(200);
    const historyData = await historyResponse.json();
    expect(historyData).toHaveProperty('screenshots');
    expect(Array.isArray(historyData.screenshots)).toBe(true);
    expect(historyData.screenshots.length).toBeGreaterThan(0);
    
    const uploadedScreenshot = historyData.screenshots.find(
      (s: any) => s.short_id === short_id
    );
    expect(uploadedScreenshot).toBeDefined();
    expect(uploadedScreenshot.original_filename).toBe('integration-test.png');

    // Step 6: Anonymous user accesses public share URL
    const publicResponse = await request.get(`${BASE_URL}/api/s/${short_id}`);
    
    expect(publicResponse.status()).toBe(200);
    const publicData = await publicResponse.json();
    expect(publicData.short_id).toBe(short_id);
    expect(publicData.original_filename).toBe('integration-test.png');
    expect(publicData.width).toBe(1920);
    expect(publicData.height).toBe(1080);
    expect(publicData).toHaveProperty('storage_url');
    expect(publicData).toHaveProperty('views');
    expect(publicData).toHaveProperty('seo_metadata');
    expect(publicData.views).toBeGreaterThan(0);

    // Step 7: Verify view count incremented
    const secondPublicResponse = await request.get(`${BASE_URL}/api/s/${short_id}`);
    const secondPublicData = await secondPublicResponse.json();
    expect(secondPublicData.views).toBeGreaterThan(publicData.views);

    // Step 8: User checks their usage stats
    const usageResponse = await request.get(`${BASE_URL}/api/usage`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(usageResponse.status()).toBe(200);
    const usageData = await usageResponse.json();
    expect(usageData).toHaveProperty('current_month');
    expect(usageData.current_month).toHaveProperty('screenshot_count');
    expect(usageData.current_month.screenshot_count).toBeGreaterThanOrEqual(1);

    // Step 9: User updates screenshot metadata
    const updateResponse = await request.patch(
      `${BASE_URL}/api/screenshots/${screenshotId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        data: {
          original_filename: 'renamed-screenshot.png',
        },
      }
    );

    expect(updateResponse.status()).toBe(200);
    const updatedData = await updateResponse.json();
    expect(updatedData.original_filename).toBe('renamed-screenshot.png');

    // Step 10: User deletes screenshot
    const deleteResponse = await request.delete(
      `${BASE_URL}/api/screenshots/${screenshotId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    expect(deleteResponse.status()).toBe(204);

    // Step 11: Verify screenshot no longer accessible publicly
    const deletedPublicResponse = await request.get(`${BASE_URL}/api/s/${short_id}`);
    expect(deletedPublicResponse.status()).toBe(404);

    // Step 12: Verify screenshot removed from user's history
    const finalHistoryResponse = await request.get(`${BASE_URL}/api/screenshots`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const finalHistoryData = await finalHistoryResponse.json();
    const deletedScreenshot = finalHistoryData.screenshots.find(
      (s: any) => s.short_id === short_id
    );
    expect(deletedScreenshot).toBeUndefined();
  });

  test('should enforce monthly upload limit for free tier', async ({ request }) => {
    const uniqueEmail = `test-limit-${Date.now()}@example.com`;
    
    // Create free tier user
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'SecurePass123!',
        full_name: 'Free Tier User',
      },
    });

    const signupData = await signupResponse.json();
    const accessToken = signupData.session.access_token;

    // Upload 10 screenshots (free tier limit)
    for (let i = 0; i < 10; i++) {
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

      expect(signedUrlResponse.status()).toBe(200);
      const signedUrlData = await signedUrlResponse.json();

      // Create screenshot record
      await request.post(`${BASE_URL}/api/screenshots`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        data: {
          short_id: signedUrlData.short_id,
          storage_path: signedUrlData.storage_path,
          original_filename: `test-${i}.png`,
          file_size: 1024,
          width: 1920,
          height: 1080,
          mime_type: 'image/png',
        },
      });
    }

    // Attempt 11th upload (should be rate limited)
    const limitedResponse = await request.post(`${BASE_URL}/api/upload/signed-url`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        filename: 'test-11.png',
        mime_type: 'image/png',
        file_size: 1024,
      },
    });

    expect(limitedResponse.status()).toBe(429);
    const limitedData = await limitedResponse.json();
    expect(limitedData.error.code).toBe('MONTHLY_LIMIT_EXCEEDED');
    expect(limitedData.error.details.limit).toBe(10);
  });

  test('should handle expired screenshots correctly', async ({ request }) => {
    const uniqueEmail = `test-expiry-${Date.now()}@example.com`;
    
    // Create user
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'SecurePass123!',
        full_name: 'Expiry Test User',
      },
    });

    const signupData = await signupResponse.json();
    const accessToken = signupData.session.access_token;

    // Get signed URL
    const signedUrlResponse = await request.post(`${BASE_URL}/api/upload/signed-url`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        filename: 'expiring-screenshot.png',
        mime_type: 'image/png',
        file_size: 1024,
      },
    });

    const signedUrlData = await signedUrlResponse.json();

    // Create screenshot with past expiration
    const screenshotResponse = await request.post(`${BASE_URL}/api/screenshots`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        short_id: signedUrlData.short_id,
        storage_path: signedUrlData.storage_path,
        original_filename: 'expiring-screenshot.png',
        file_size: 1024,
        width: 1920,
        height: 1080,
        mime_type: 'image/png',
        expires_at: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
      },
    });

    expect(screenshotResponse.status()).toBe(201);
    const screenshotData = await screenshotResponse.json();

    // Try to access expired screenshot
    const publicResponse = await request.get(`${BASE_URL}/api/s/${screenshotData.short_id}`);
    
    expect(publicResponse.status()).toBe(410);
    const publicData = await publicResponse.json();
    expect(publicData.error.code).toBe('RESOURCE_GONE');
  });
});

