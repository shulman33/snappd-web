/**
 * POST /api/upload/signed-url
 * Generate signed URL for direct file upload to Supabase Storage
 * 
 * @requires Authentication
 * @rateLimit 10 uploads per minute per user
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUserClient, getUserIdFromToken } from '@/lib/supabase';
import { validateRequest, signedUrlSchema } from '@/lib/validation';
import { generateSignedUploadUrl, generateStoragePath, validateMimeType } from '@/lib/storage';
import { generateUniqueShortId } from '@/lib/short-id';
import { handleApiError, UnauthorizedError, ValidationError, RateLimitError } from '@/lib/errors';
import { checkRateLimit, uploadRateLimit, addRateLimitHeaders } from '@/lib/rate-limit';

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

    // 2. Check rate limit (10 uploads per minute)
    const rateLimitResult = await checkRateLimit(uploadRateLimit, userId);
    if (!rateLimitResult.success) {
      throw new RateLimitError(rateLimitResult.reset);
    }

    // 3. Parse and validate request body
    const body = await request.json();
    const validated = validateRequest(signedUrlSchema, body);

    // 4. Validate MIME type
    if (!validateMimeType(validated.mime_type)) {
      throw new ValidationError('Invalid MIME type', {
        allowed_types: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
      });
    }

    // 5. Check monthly upload limit for free tier
    const supabase = createUserClient(accessToken);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan, downgraded_at')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new UnauthorizedError('User profile not found');
    }

    // Check monthly limit for free tier
    if (profile.plan === 'free') {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      
      // Count screenshots uploaded this month (after downgrade if applicable)
      const { count } = await supabase
        .from('screenshots')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', (profile.downgraded_at || '1970-01-01') as string)
        .gte('created_at', `${currentMonth}-01`);

      if (count && count >= 10) {
        return NextResponse.json(
          {
            error: {
              message: 'Monthly upload limit reached (10 screenshots per month on free tier)',
              code: 'MONTHLY_LIMIT_EXCEEDED',
              details: {
                limit: 10,
                current: count,
                resets_at: `${currentMonth}-01T00:00:00Z`,
              },
            },
          },
          { status: 429 }
        );
      }
    }

    // 6. Generate unique short ID
    const shortId = await generateUniqueShortId(async (id) => {
      const { data } = await supabase
        .from('screenshots')
        .select('id')
        .eq('short_id', id as string)
        .single();
      return data !== null;
    });

    // 7. Generate storage path
    const storagePath = generateStoragePath(userId, validated.filename, shortId);

    // 8. Generate signed upload URL (5-minute expiration)
    const uploadUrl = await generateSignedUploadUrl(storagePath, 300);

    // 9. Return signed URL and metadata
    const response = NextResponse.json(
      {
        upload_url: uploadUrl,
        storage_path: storagePath,
        expires_in: 300,
        short_id: shortId,
      },
      { status: 200 }
    );

    // Add rate limit headers
    addRateLimitHeaders(response.headers, rateLimitResult);

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

