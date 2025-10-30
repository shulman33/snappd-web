/**
 * POST /api/auth/signup
 * Create new user account with email/password
 * Automatically creates profile and Stripe customer
 * 
 * @public No authentication required
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { validateRequest, signupSchema } from '@/lib/validation';
import { createCustomer } from '@/lib/stripe';
import { handleApiError, ValidationError } from '@/lib/errors';
import type { AuthSessionResponse } from '@/types/api';

export async function POST(request: NextRequest) {
  try {
    // 1. Parse and validate request body
    const body = await request.json();
    const validated = validateRequest(signupSchema, body);

    // 2. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: validated.email,
      password: validated.password,
      email_confirm: true, // Auto-confirm for MVP (no email verification)
    });

    if (authError || !authData.user) {
      throw new ValidationError('Failed to create user account', {
        error: authError?.message,
      });
    }

    // 3. Create Stripe customer
    let stripeCustomerId: string;
    try {
      stripeCustomerId = await createCustomer(validated.email, authData.user.id);
    } catch (error) {
      // Rollback user creation if Stripe fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new ValidationError('Failed to create Stripe customer', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 4. Create user profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: validated.email,
        full_name: validated.full_name || null,
        plan: 'free',
        stripe_customer_id: stripeCustomerId,
      });

    if (profileError) {
      // Rollback user and customer creation if profile fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new ValidationError('Failed to create user profile', {
        error: profileError.message,
      });
    }

    // 5. Create session for user using anon client (user is auto-confirmed)
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: sessionData, error: sessionError } = 
      await anonClient.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

    if (sessionError || !sessionData.session) {
      throw new ValidationError('Failed to generate session', {
        error: sessionError?.message,
      });
    }

    // 6. Return auth response
    const response: AuthSessionResponse = {
      user: {
        id: authData.user.id,
        email: authData.user.email!,
      },
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_in: sessionData.session.expires_in || 3600,
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

