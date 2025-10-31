/**
 * Contract tests for GET /api/auth/me and PATCH /api/auth/me
 * Tests user profile retrieval and updates
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('GET /api/auth/me', () => {
  let accessToken: string;
  let userEmail: string;

  test.beforeAll(async ({ request }) => {
    userEmail = `test-profile-${Date.now()}@example.com`;
    
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: userEmail,
        password: 'SecurePass123!',
        full_name: 'Profile Test User',
      },
    });

    const signupData = await signupResponse.json();
    accessToken = signupData.session.access_token;
  });

  test('should return user profile with valid token', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('email');
    expect(body).toHaveProperty('full_name');
    expect(body).toHaveProperty('plan');
    expect(body).toHaveProperty('created_at');
    expect(body).toHaveProperty('updated_at');

    expect(body.email).toBe(userEmail);
    expect(body.full_name).toBe('Profile Test User');
    expect(body.plan).toBe('free');
  });

  test('should return 401 when no auth token provided', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/auth/me`);
    expect(response.status()).toBe(401);
    
    const body = await response.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('should return 401 with invalid token', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: 'Bearer invalid-token-12345',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('should not expose sensitive fields', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const body = await response.json();
    
    // Should NOT contain sensitive fields
    expect(body).not.toHaveProperty('stripe_customer_id');
    expect(body).not.toHaveProperty('stripe_subscription_id');
    expect(body).not.toHaveProperty('downgraded_at');
  });
});

test.describe('PATCH /api/auth/me', () => {
  let accessToken: string;
  let userEmail: string;

  test.beforeEach(async ({ request }) => {
    userEmail = `test-update-${Date.now()}@example.com`;
    
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: userEmail,
        password: 'SecurePass123!',
        full_name: 'Update Test User',
      },
    });

    const signupData = await signupResponse.json();
    accessToken = signupData.session.access_token;
  });

  test('should update full_name', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        full_name: 'Updated Name',
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.full_name).toBe('Updated Name');
    expect(body.email).toBe(userEmail); // Email unchanged
  });

  test('should update email', async ({ request }) => {
    const newEmail = `updated-${Date.now()}@example.com`;
    
    const response = await request.patch(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        email: newEmail,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.email).toBe(newEmail);
  });

  test('should update both full_name and email', async ({ request }) => {
    const newEmail = `both-${Date.now()}@example.com`;
    
    const response = await request.patch(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        email: newEmail,
        full_name: 'Both Updated',
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.email).toBe(newEmail);
    expect(body.full_name).toBe('Both Updated');
  });

  test('should return 401 when no auth token provided', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/auth/me`, {
      data: {
        full_name: 'No Auth',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('should reject invalid email format', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        email: 'not-an-email',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should reject duplicate email', async ({ request }) => {
    // Create another user
    const existingEmail = `existing-${Date.now()}@example.com`;
    await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: existingEmail,
        password: 'SecurePass123!',
        full_name: 'Existing User',
      },
    });

    // Try to update to existing email
    const response = await request.patch(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        email: existingEmail,
      },
    });

    expect(response.status()).toBe(400);
  });

  test('should handle empty update gracefully', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {},
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.email).toBe(userEmail);
    expect(body.full_name).toBe('Update Test User');
  });

  test('should trim whitespace from updated fields', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        full_name: '  Trimmed Name  ',
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.full_name).toBe('Trimmed Name');
  });

  test('should not allow updating plan directly', async ({ request }) => {
    const response = await request.patch(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        plan: 'pro', // Attempt to upgrade without payment
      },
    });

    // Should either ignore or reject
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.plan).toBe('free'); // Should remain free
  });

  test('should preserve updated_at timestamp', async ({ request }) => {
    const beforeResponse = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const beforeData = await beforeResponse.json();
    const beforeUpdatedAt = new Date(beforeData.updated_at);

    // Wait a bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const updateResponse = await request.patch(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        full_name: 'Timestamp Test',
      },
    });

    const afterData = await updateResponse.json();
    const afterUpdatedAt = new Date(afterData.updated_at);

    expect(afterUpdatedAt.getTime()).toBeGreaterThan(beforeUpdatedAt.getTime());
  });
});

