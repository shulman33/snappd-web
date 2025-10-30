/**
 * Contract test for POST /api/billing/checkout
 * Tests Stripe checkout session creation
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('POST /api/billing/checkout', () => {
  let accessToken: string;
  let userEmail: string;

  test.beforeAll(async ({ request }) => {
    userEmail = `test-checkout-${Date.now()}@example.com`;
    
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: userEmail,
        password: 'SecurePass123!',
        full_name: 'Checkout Test User',
      },
    });

    const signupData = await signupResponse.json();
    accessToken = signupData.session.access_token;
  });

  test('should create checkout session for pro plan', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/billing/checkout`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        plan: 'pro',
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('checkout_url');
    expect(body.checkout_url).toContain('checkout.stripe.com');
  });

  test('should create checkout session for team plan', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/billing/checkout`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        plan: 'team',
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('checkout_url');
    expect(body.checkout_url).toContain('checkout.stripe.com');
  });

  test('should return 401 when no auth token provided', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/billing/checkout`, {
      data: {
        plan: 'pro',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('should reject invalid plan', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/billing/checkout`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        plan: 'invalid-plan',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('should reject free plan upgrade attempt', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/billing/checkout`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        plan: 'free',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('should reject missing plan field', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/billing/checkout`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {},
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

test.describe('GET /api/billing/portal', () => {
  let accessToken: string;

  test.beforeAll(async ({ request }) => {
    const userEmail = `test-portal-${Date.now()}@example.com`;
    
    const signupResponse = await request.post(`${BASE_URL}/api/auth/signup`, {
      data: {
        email: userEmail,
        password: 'SecurePass123!',
        full_name: 'Portal Test User',
      },
    });

    const signupData = await signupResponse.json();
    accessToken = signupData.session.access_token;
  });

  test('should create billing portal session', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/billing/portal`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('portal_url');
    expect(body.portal_url).toContain('billing.stripe.com');
  });

  test('should return 401 when no auth token provided', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/billing/portal`);
    expect(response.status()).toBe(401);
  });

  test('should return 401 with invalid token', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/billing/portal`, {
      headers: {
        Authorization: 'Bearer invalid-token',
      },
    });

    expect(response.status()).toBe(401);
  });
});

