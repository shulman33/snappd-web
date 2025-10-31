/**
 * GET /api/screenshots/[id]/download
 * Generate signed download URL for screenshot
 * 
 * @requires Authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUserClient, getUserIdFromToken } from '@/lib/supabase';
import { generateSignedDownloadUrl } from '@/lib/storage';
import { handleApiError, UnauthorizedError, NotFoundError, ForbiddenError } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // 2. Fetch screenshot
    const supabase = createUserClient(accessToken);
    const { data: screenshot, error } = await supabase
      .from('screenshots')
      .select('user_id, storage_path')
      .eq('id', id)
      .single();

    if (error || !screenshot) {
      throw new NotFoundError('Screenshot');
    }

    // 3. Verify ownership
    if (screenshot.user_id !== userId) {
      throw new ForbiddenError('You do not have permission to download this screenshot');
    }

    // 4. Generate signed download URL (1 hour expiration)
    const downloadUrl = await generateSignedDownloadUrl(screenshot.storage_path, 3600);

    return NextResponse.json(
      {
        download_url: downloadUrl,
        expires_in: 3600,
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

