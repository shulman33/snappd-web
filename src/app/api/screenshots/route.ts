/**
 * POST /api/screenshots
 * Create screenshot metadata record after successful upload
 * 
 * GET /api/screenshots
 * List user's screenshots with pagination and filtering
 * 
 * @requires Authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUserClient, getUserIdFromToken, supabaseAdmin } from '@/lib/supabase';
import { validateRequest, uploadScreenshotSchema, listScreenshotsSchema } from '@/lib/validation';
import { getPublicUrl } from '@/lib/storage';
import { handleApiError, UnauthorizedError, ValidationError } from '@/lib/errors';
import type { ScreenshotResponse, PaginatedResponse } from '@/types/api';

/**
 * POST /api/screenshots
 * Create screenshot metadata after successful file upload
 */
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

    // 2. Parse and validate request body
    const body = await request.json();
    const validated = validateRequest(uploadScreenshotSchema, body);

    // 3. Get user profile to determine plan and expiration
    const supabase = createUserClient(accessToken);
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .single();

    if (!profile) {
      throw new UnauthorizedError('User profile not found');
    }

    // 4. Calculate expiration date (30 days for free tier, null for pro)
    // Allow override via expires_at field for testing purposes
    const expiresAt = validated.expires_at || (profile.plan === 'free' 
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null);

    // 5. Extract or use provided short_id
    // If short_id is provided (for testing), use it, otherwise extract from storage_path
    const shortId = validated.short_id || validated.storage_path.split('/')[1].split('_')[1].split('.')[0];

    // 6. Insert screenshot metadata
    const { data: screenshot, error } = await supabase
      .from('screenshots')
      .insert({
        user_id: userId,
        short_id: shortId,
        storage_path: validated.storage_path,
        original_filename: validated.filename,
        file_size: validated.file_size,
        width: validated.width,
        height: validated.height,
        mime_type: validated.mime_type,
        expires_at: expiresAt,
        views: 0,
        is_public: true,
      })
      .select()
      .single();

    if (error || !screenshot) {
      throw new ValidationError('Failed to create screenshot record', { error: error?.message });
    }

    // 7. Update monthly usage - increment counters (use admin client to bypass RLS)
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    // Check if monthly_usage record exists
    const { data: existingUsage } = await supabaseAdmin
      .from('monthly_usage')
      .select('screenshot_count, storage_bytes')
      .eq('user_id', userId)
      .eq('month', currentMonth)
      .single();

    if (existingUsage) {
      // Update existing record by incrementing
      await supabaseAdmin
        .from('monthly_usage')
        .update({
          screenshot_count: existingUsage.screenshot_count + 1,
          storage_bytes: existingUsage.storage_bytes + validated.file_size,
        })
        .eq('user_id', userId)
        .eq('month', currentMonth);
    } else {
      // Insert new record
      await supabaseAdmin
        .from('monthly_usage')
        .insert({
          user_id: userId,
          month: currentMonth,
          screenshot_count: 1,
          storage_bytes: validated.file_size,
        });
    }

    // 8. Get public storage URL
    const storageUrl = getPublicUrl(validated.storage_path);
    const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/s/${shortId}`;

    // 9. Return screenshot response
    const response: ScreenshotResponse = {
      id: screenshot.id,
      short_id: screenshot.short_id,
      original_filename: screenshot.original_filename,
      file_size: screenshot.file_size,
      width: screenshot.width,
      height: screenshot.height,
      mime_type: screenshot.mime_type,
      public_url: publicUrl,
      share_url: publicUrl,
      storage_url: storageUrl,
      expires_at: screenshot.expires_at,
      views: screenshot.views,
      is_public: screenshot.is_public,
      created_at: screenshot.created_at,
      updated_at: screenshot.updated_at,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/screenshots
 * List user's screenshots with pagination and optional filtering
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

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
      search: searchParams.get('search') || undefined,
      from_date: searchParams.get('from_date') || undefined,
      to_date: searchParams.get('to_date') || undefined,
    };

    const validated = validateRequest(listScreenshotsSchema, queryParams);

    // 3. Build query
    const supabase = createUserClient(accessToken);
    let query = supabase
      .from('screenshots')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(validated.offset, validated.offset + validated.limit - 1);

    // Apply filters
    if (validated.search) {
      query = query.ilike('original_filename', `%${validated.search}%`);
    }

    if (validated.from_date) {
      query = query.gte('created_at', validated.from_date);
    }

    if (validated.to_date) {
      query = query.lte('created_at', validated.to_date);
    }

    // 4. Execute query
    const { data: screenshots, error, count } = await query;

    if (error) {
      throw new ValidationError('Failed to fetch screenshots', { error: error.message });
    }

    // 5. Map to response format
    const publicUrlBase = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const data: ScreenshotResponse[] = (screenshots || []).map((s) => {
      const shareUrl = `${publicUrlBase}/s/${s.short_id}`;
      return {
        id: s.id,
        short_id: s.short_id,
        original_filename: s.original_filename,
        file_size: s.file_size,
        width: s.width,
        height: s.height,
        mime_type: s.mime_type,
        public_url: shareUrl,
        share_url: shareUrl,
        storage_url: getPublicUrl(s.storage_path),
        expires_at: s.expires_at,
        views: s.views,
        is_public: s.is_public,
        created_at: s.created_at,
        updated_at: s.updated_at,
      };
    });

    // 6. Return paginated response
    const response = {
      screenshots: data,
      pagination: {
        total: count || 0,
        limit: validated.limit,
        offset: validated.offset,
        has_more: (validated.offset + validated.limit) < (count || 0),
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

