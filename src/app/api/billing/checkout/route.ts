/**
 * POST /api/billing/checkout
 * Create Stripe Checkout session for pro upgrade
 * 
 * @requires Authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUserClient, getUserIdFromToken } from '@/lib/supabase';
import { createCheckoutSession } from '@/lib/stripe';
import { validateRequest, checkoutSessionSchema } from '@/lib/validation';
import { handleApiError, UnauthorizedError, ValidationError } from '@/lib/errors';
import type { CheckoutSessionResponse } from '@/types/api';

export async function POST(request: NextRequest) {
  try {
    // 1. Extract and validate authentication
    const authHeader = request.headers.get('authorization');
    const accessToken = authHeader?.replace('Bearer ', '');

    if (!accessToken) {
      throw new UnauthorizedError('Missing authorization token');
    }

    const userId = await getUserIdFromToken(accessToken);
    if (!userId) {
      throw new UnauthorizedError('Invalid authorization token');
    }

    // 2. Validate request body
    const body = await request.json();
    const validated = validateRequest(checkoutSessionSchema, body);

    // 3. Get user profile and Stripe customer ID
    const supabase = createUserClient(accessToken);
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('stripe_customer_id, plan')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      throw new UnauthorizedError('User profile not found');
    }

    if (!profile.stripe_customer_id) {
      throw new ValidationError('Stripe customer ID not found');
    }

    // 4. Check if user is already on the requested plan
    if (profile.plan === validated.plan) {
      throw new ValidationError(`User is already on ${validated.plan} plan`);
    }

    // 5. Create Stripe Checkout session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const checkoutUrl = await createCheckoutSession(
      profile.stripe_customer_id,
      validated.plan,
      `${appUrl}/dashboard?upgrade=success`,
      `${appUrl}/dashboard?upgrade=cancelled`
    );

    // 6. Return checkout URL
    const response: CheckoutSessionResponse = {
      checkout_url: checkoutUrl,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

