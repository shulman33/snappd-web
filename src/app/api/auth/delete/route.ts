/**
 * POST /api/auth/delete
 * Permanently delete user account and all associated data (GDPR compliance)
 * Cascade deletes: screenshots (DB + storage), monthly_usage, profile, auth user
 * 
 * @requires Authentication
 * @warning DESTRUCTIVE - Cannot be undone
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, getUserIdFromToken } from '@/lib/supabase';
import { deleteFile } from '@/lib/storage';
import { stripe } from '@/lib/stripe';
import { handleApiError, UnauthorizedError, ValidationError } from '@/lib/errors';

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

    // 2. Get user profile for Stripe customer ID
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!profile) {
      throw new UnauthorizedError('User profile not found');
    }

    // 3. Fetch all screenshots to delete storage files
    const { data: screenshots } = await supabaseAdmin
      .from('screenshots')
      .select('storage_path')
      .eq('user_id', userId);

    // 4. Delete all screenshot storage files (fire and forget - don't block on failures)
    if (screenshots && screenshots.length > 0) {
      const deletePromises = screenshots.map((screenshot) =>
        deleteFile(screenshot.storage_path).catch((error) => {
          console.error(`Failed to delete file ${screenshot.storage_path}:`, error);
        })
      );

      // Wait for all deletions to complete (with timeout)
      await Promise.allSettled(deletePromises);
    }

    // 5. Delete Stripe customer (cancels active subscriptions)
    if (profile.stripe_customer_id) {
      try {
        await stripe.customers.del(profile.stripe_customer_id);
      } catch (stripeError) {
        console.error('Failed to delete Stripe customer:', stripeError);
        // Continue with deletion even if Stripe fails
      }
    }

    // 6. Delete database records (cascade via foreign keys)
    // Order: screenshots → monthly_usage → profile → auth.users

    // Delete screenshots (cascade handled by RLS)
    const { error: screenshotsError } = await supabaseAdmin
      .from('screenshots')
      .delete()
      .eq('user_id', userId);

    if (screenshotsError) {
      console.error('Failed to delete screenshots:', screenshotsError);
    }

    // Delete monthly_usage records
    const { error: usageError } = await supabaseAdmin
      .from('monthly_usage')
      .delete()
      .eq('user_id', userId);

    if (usageError) {
      console.error('Failed to delete monthly_usage:', usageError);
    }

    // Delete profile record
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error('Failed to delete profile:', profileError);
    }

    // 7. Delete auth user (final step)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      throw new ValidationError('Failed to delete user account', {
        error: authError.message,
      });
    }

    // 8. Return success response
    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}

