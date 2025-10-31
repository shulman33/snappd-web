/**
 * GET /api/screenshots/[id]
 * Get screenshot metadata by ID
 * 
 * PATCH /api/screenshots/[id]
 * Update screenshot metadata
 * 
 * DELETE /api/screenshots/[id]
 * Delete screenshot and storage file
 * 
 * @requires Authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUserClient, getUserIdFromToken } from '@/lib/supabase';
import { validateRequest, updateScreenshotSchema } from '@/lib/validation';
import { getPublicUrl, deleteFile } from '@/lib/storage';
import { handleApiError, UnauthorizedError, NotFoundError, ValidationError, ForbiddenError } from '@/lib/errors';
import type { ScreenshotResponse } from '@/types/api';

/**
 * GET /api/screenshots/[id]
 * Fetch screenshot metadata
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new ValidationError('Invalid screenshot ID format');
    }

    // 2. Extract and validate authentication
    const authHeader = request.headers.get('authorization');
    const accessToken = authHeader?.replace('Bearer ', '');

    if (!accessToken) {
      throw new UnauthorizedError('Missing authorization token');
    }

    const userId = await getUserIdFromToken(accessToken);
    if (!userId) {
      throw new UnauthorizedError('Invalid authorization token');
    }

    // 3. Fetch screenshot - filter by user_id to ensure ownership
    const supabase = createUserClient(accessToken);
    const { data: screenshot, error } = await supabase
      .from('screenshots')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId) // Only fetch if user owns it
      .single();

    if (error || !screenshot) {
      throw new NotFoundError('Screenshot');
    }

    // 4. Return screenshot response
    const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/s/${screenshot.short_id}`;
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
      storage_url: getPublicUrl(screenshot.storage_path),
      expires_at: screenshot.expires_at,
      views: screenshot.views,
      is_public: screenshot.is_public,
      created_at: screenshot.created_at,
      updated_at: screenshot.updated_at,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/screenshots/[id]
 * Update screenshot metadata
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new NotFoundError('Screenshot');
    }

    // 2. Extract and validate authentication
    const authHeader = request.headers.get('authorization');
    const accessToken = authHeader?.replace('Bearer ', '');

    if (!accessToken) {
      throw new UnauthorizedError('Missing authorization token');
    }

    const userId = await getUserIdFromToken(accessToken);
    if (!userId) {
      throw new UnauthorizedError('Invalid authorization token');
    }

    // 3. Parse and validate request body
    const body = await request.json();
    const validated = validateRequest(updateScreenshotSchema, body);

    // 4. Check if screenshot exists first
    const supabase = createUserClient(accessToken);
    const { data: existing, error: fetchError } = await supabase
      .from('screenshots')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundError('Screenshot');
    }

    // 5. Build update object
    const updateData: { original_filename?: string; is_public?: boolean } = {};
    if (validated.original_filename !== undefined) updateData.original_filename = validated.original_filename;
    if (validated.is_public !== undefined) updateData.is_public = validated.is_public;

    // 6. Update screenshot
    const { data: screenshot, error } = await supabase
      .from('screenshots')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId) // RLS enforcement
      .select()
      .single();

    if (error || !screenshot) {
      throw new ValidationError('Failed to update screenshot', { error: error?.message });
    }

    // 5. Return updated screenshot
    const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/s/${screenshot.short_id}`;
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
      storage_url: getPublicUrl(screenshot.storage_path),
      expires_at: screenshot.expires_at,
      views: screenshot.views,
      is_public: screenshot.is_public,
      created_at: screenshot.created_at,
      updated_at: screenshot.updated_at,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/screenshots/[id]
 * Delete screenshot and storage file
 */
export async function DELETE(
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

    // 2. Fetch screenshot to get storage path
    const supabase = createUserClient(accessToken);
    const { data: screenshot, error: fetchError } = await supabase
      .from('screenshots')
      .select('storage_path')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !screenshot) {
      throw new NotFoundError('Screenshot');
    }

    // 3. Delete storage file
    try {
      await deleteFile(screenshot.storage_path);
    } catch (storageError) {
      console.error('Failed to delete storage file:', storageError);
      // Continue with database deletion even if storage fails
    }

    // 4. Delete database record
    const { error: deleteError } = await supabase
      .from('screenshots')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (deleteError) {
      throw new ValidationError('Failed to delete screenshot', { error: deleteError.message });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}

