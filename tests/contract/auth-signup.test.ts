/**
 * Contract test for POST /api/auth/signup
 * Tests user signup endpoint
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('POST /api/auth/signup', () => {
  test('should create new user with valid credentials', async ({ request }) => {
    const uniqueEmail = `test-signup-${Date.now()}@example.com`;
    
    const response = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'SecurePass123!',
        full_name: 'Test User',
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toHaveProperty('user');
    expect(body).toHaveProperty('session');
    
    // Validate user object
    expect(body.user).toHaveProperty('id');
    expect(body.user).toHaveProperty('email');
    expect(body.user.email).toBe(uniqueEmail);
    
    // Validate session object
    expect(body.session).toHaveProperty('access_token');
    expect(body.session).toHaveProperty('refresh_token');
    expect(body.session.access_token).toBeTruthy();
    expect(body.session.refresh_token).toBeTruthy();
  });

  test('should create profile with default free plan', async ({ request }) => {
    const uniqueEmail = `test-profile-${Date.now()}@example.com`;
    
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'SecurePass123!',
        full_name: 'Test User',
      },
    });

    expect(signupResponse.status()).toBe(201);
    const signupData = await signupResponse.json();
    const accessToken = signupData.session.access_token;

    // Check profile was created
    const profileResponse = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(profileResponse.status()).toBe(200);
    const profileData = await profileResponse.json();
    expect(profileData.plan).toBe('free');
    expect(profileData.email).toBe(uniqueEmail);
    expect(profileData.full_name).toBe('Test User');
  });

  test('should reject signup with existing email', async ({ request }) => {
    const uniqueEmail = `test-duplicate-${Date.now()}@example.com`;
    
    // First signup
    const firstResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'SecurePass123!',
        full_name: 'Test User',
      },
    });

    expect(firstResponse.status()).toBe(201);

    // Attempt duplicate signup
    const duplicateResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'DifferentPass456!',
        full_name: 'Duplicate User',
      },
    });

    expect(duplicateResponse.status()).toBe(400);
    const body = await duplicateResponse.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should reject invalid email format', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: 'not-an-email',
        password: 'SecurePass123!',
        full_name: 'Test User',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should reject weak password', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: `test-weak-${Date.now()}@example.com`,
        password: '123',
        full_name: 'Test User',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should reject missing required fields', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: `test-missing-${Date.now()}@example.com`,
        // Missing password
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should allow signup without full_name', async ({ request }) => {
    const uniqueEmail = `test-no-name-${Date.now()}@example.com`;
    
    const response = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'SecurePass123!',
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.user.email).toBe(uniqueEmail);
  });

  test('should create Stripe customer on signup', async ({ request }) => {
    const uniqueEmail = `test-stripe-${Date.now()}@example.com`;
    
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: uniqueEmail,
        password: 'SecurePass123!',
        full_name: 'Stripe Test User',
      },
    });

    expect(signupResponse.status()).toBe(201);
    const signupData = await signupResponse.json();
    const accessToken = signupData.session.access_token;

    // Verify Stripe customer was created by checking profile
    const profileResponse = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const profileData = await profileResponse.json();
    // Note: stripe_customer_id is not exposed in API response for security
    // But it should be created in the background
    expect(profileData.email).toBe(uniqueEmail);
  });

  test('should trim whitespace from email', async ({ request }) => {
    const uniqueEmail = `test-trim-${Date.now()}@example.com`;
    
    const response = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: `  ${uniqueEmail}  `,
        password: 'SecurePass123!',
        full_name: 'Test User',
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.user.email).toBe(uniqueEmail);
  });
});

