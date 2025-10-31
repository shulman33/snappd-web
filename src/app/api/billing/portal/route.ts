/**
 * GET /api/billing/portal
 * Create Stripe Customer Portal session
 * Allows users to manage subscriptions and billing
 * 
 * @requires Authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUserClient, getUserIdFromToken } from '@/lib/supabase';
import { createPortalSession } from '@/lib/stripe';
import { handleApiError, UnauthorizedError, ValidationError } from '@/lib/errors';
import type { PortalSessionResponse } from '@/types/api';

export async function GET(request: NextRequest) {
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

    // 2. Get user profile and Stripe customer ID
    const supabase = createUserClient(accessToken);
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      throw new UnauthorizedError('User profile not found');
    }

    if (!profile.stripe_customer_id) {
      throw new ValidationError('Stripe customer ID not found');
    }

    // 3. Create Stripe Customer Portal session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const portalUrl = await createPortalSession(
      profile.stripe_customer_id,
      `${appUrl}/dashboard`
    );

    // 4. Return portal URL
    const response: PortalSessionResponse = {
      portal_url: portalUrl,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

