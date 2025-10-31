/**
 * GET /api/auth/me
 * Get current user profile
 * 
 * PATCH /api/auth/me
 * Update current user profile
 * 
 * @requires Authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUserClient, getUserIdFromToken } from '@/lib/supabase';
import { validateRequest, updateProfileSchema } from '@/lib/validation';
import { handleApiError, UnauthorizedError, ValidationError } from '@/lib/errors';
import type { ProfileResponse } from '@/types/api';

/**
 * GET /api/auth/me
 * Fetch current user's profile
 */
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

    // 2. Fetch user profile
    const supabase = createUserClient(accessToken);
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, plan, created_at, updated_at')
      .eq('id', userId as string)
      .single();

    if (error || !profile) {
      throw new ValidationError('Failed to fetch profile', { error: error?.message });
    }

    // 3. Return profile response
    const response: ProfileResponse = {
      id: profile.id as string,
      email: profile.email as string,
      full_name: profile.full_name as string | null,
      plan: profile.plan as 'free' | 'pro' | 'team',
      created_at: profile.created_at as string,
      updated_at: profile.updated_at as string,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/auth/me
 * Update current user's profile
 */
export async function PATCH(request: NextRequest) {
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

    // 2. Parse and validate request body
    const body = await request.json();
    const validated = validateRequest(updateProfileSchema, body);

    // 3. Get current profile first
    const supabase = createUserClient(accessToken);
    const { data: currentProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, full_name, plan, created_at, updated_at')
      .eq('id', userId as string)
      .single();

    if (fetchError || !currentProfile) {
      throw new UnauthorizedError('User profile not found');
    }

    // 4. Build update data (excluding plan)
    const updateData: { full_name?: string; email?: string } = {};
    if (validated.full_name !== undefined) updateData.full_name = validated.full_name;
    if (validated.email !== undefined) updateData.email = validated.email;

    // 5. If no fields to update, return current profile
    if (Object.keys(updateData).length === 0) {
      const response: ProfileResponse = {
        id: currentProfile.id as string,
        email: currentProfile.email as string,
        full_name: currentProfile.full_name as string | null,
        plan: currentProfile.plan as 'free' | 'pro' | 'team',
        created_at: currentProfile.created_at as string,
        updated_at: currentProfile.updated_at as string,
      };
      return NextResponse.json(response, { status: 200 });
    }

    // 6. Check for duplicate email (if email is being changed)
    if (validated.email && validated.email !== currentProfile.email) {
      const { data: existingProfile, error: duplicateCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', validated.email)
        .neq('id', userId as string)
        .maybeSingle();

      if (existingProfile) {
        throw new ValidationError('Email already in use');
      }
    }

    // 7. Update profile (plan field is ignored)
    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId as string)
      .select('id, email, full_name, plan, created_at, updated_at')
      .single();

    if (error || !profile) {
      throw new ValidationError('Failed to update profile', { error: error?.message });
    }

    // 8. Update auth email if changed
    if (validated.email && validated.email !== (profile.email as string)) {
      const { error: authError } = await supabase.auth.updateUser({
        email: validated.email,
      });

      if (authError) {
        throw new ValidationError('Failed to update email', { error: authError.message });
      }
    }

    // 9. Return updated profile
    const response: ProfileResponse = {
      id: profile.id as string,
      email: profile.email as string,
      full_name: profile.full_name as string | null,
      plan: profile.plan as 'free' | 'pro' | 'team',
      created_at: profile.created_at as string,
      updated_at: profile.updated_at as string,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

