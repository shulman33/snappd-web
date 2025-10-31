/**
 * GET /api/s/[shortId]
 * Public screenshot viewer endpoint
 * Accessible by anyone with the short URL
 * Increments view count and returns screenshot metadata with SEO
 * 
 * @public No authentication required
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getPublicUrl } from '@/lib/storage';
import { handleApiError, NotFoundError, GoneError } from '@/lib/errors';
import { isValidShortId } from '@/lib/short-id';
import type { PublicScreenshotResponse } from '@/types/api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortId: string }> }
) {
  try {
    const { shortId } = await params;

    // 1. Validate short ID format
    if (!isValidShortId(shortId)) {
      throw new NotFoundError('Screenshot');
    }

    // 2. Fetch screenshot by short_id (use admin client for public access)
    const { data: screenshot, error } = await supabaseAdmin
      .from('screenshots')
      .select('*')
      .eq('short_id', shortId)
      .single();

    if (error || !screenshot) {
      throw new NotFoundError('Screenshot');
    }

    // 3. Check if screenshot is public
    if (!screenshot.is_public) {
      throw new NotFoundError('Screenshot');
    }

    // 4. Check if screenshot has expired
    if (screenshot.expires_at) {
      const expiresAt = new Date(screenshot.expires_at);
      const now = new Date();
      
      if (now > expiresAt) {
        throw new GoneError('Screenshot has expired');
      }
    }

    // 5. Increment view count (fire and forget - don't block response)
    supabaseAdmin
      .from('screenshots')
      .update({ views: screenshot.views + 1 })
      .eq('id', screenshot.id)
      .then(() => {
        // Update bandwidth tracking in monthly_usage
        const currentMonth = new Date().toISOString().slice(0, 7);
        return supabaseAdmin.rpc('increment_bandwidth', {
          p_user_id: screenshot.user_id,
          p_month: currentMonth,
          p_bytes: screenshot.file_size,
        });
      })
      .catch((err) => {
        console.error('Failed to increment view count:', err);
      });

    // 6. Get public storage URL
    const storageUrl = getPublicUrl(screenshot.storage_path);

    // 7. Generate SEO metadata
    const seoMetadata = {
      title: `Screenshot - ${screenshot.original_filename}`,
      description: 'Shared via snappd',
      image: storageUrl,
    };

    // 8. Return public screenshot response
    const response: PublicScreenshotResponse = {
      short_id: screenshot.short_id,
      original_filename: screenshot.original_filename,
      width: screenshot.width,
      height: screenshot.height,
      storage_url: storageUrl,
      views: screenshot.views + 1, // Include incremented count
      created_at: screenshot.created_at,
      seo_metadata: seoMetadata,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

