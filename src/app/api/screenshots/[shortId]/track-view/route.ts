/**
 * POST /api/screenshots/[shortId]/track-view
 *
 * Track view events for screenshots with privacy-compliant IP hashing
 * and owner detection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getClientIP, hashIP, hashUserAgent, isBot, getCountryFromRequest } from '@/lib/analytics/tracking';
import type { TrackViewResponse } from '@/types/analytics';
import { analyticsLimiter } from '@/lib/auth/rate-limit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shortId: string }> }
): Promise<NextResponse<TrackViewResponse | { error: string; message: string }>> {
  try {
    const { shortId } = await params;

    // Apply rate limiting to prevent analytics spam
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               '127.0.0.1';
    const { success } = await analyticsLimiter.limit(ip);

    // If rate limited, silently return success without tracking
    // This prevents breaking the user experience while stopping spam
    if (!success) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Create Supabase client with service role for RLS bypass
    const supabase = createServiceClient();

    // Get screenshot details
    const { data: screenshot, error: screenshotError } = await supabase
      .from('screenshots')
      .select('id, user_id')
      .eq('short_id', shortId)
      .single();

    if (screenshotError || !screenshot) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Screenshot not found' },
        { status: 404 }
      );
    }

    // Extract request information
    const userAgent = request.headers.get('user-agent') || '';

    // Skip tracking for bots
    if (isBot(userAgent)) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Get IP address and hash it for privacy
    const ipAddress = getClientIP(request.headers);
    const ipHash = await hashIP(ipAddress);
    const userAgentHash = await hashUserAgent(userAgent);

    // Get country from geolocation headers
    const country = getCountryFromRequest(request);

    // Check if viewer is authenticated and is the owner
    const { data: { user } } = await supabase.auth.getUser();
    const isAuthenticated = !!user;
    const isOwner = user?.id === screenshot.user_id;

    // Insert view event
    const { error: insertError } = await supabase
      .from('view_events')
      .insert({
        screenshot_id: screenshot.id,
        ip_hash: ipHash,
        country: country,
        is_authenticated: isAuthenticated,
        is_owner: isOwner,
        user_agent_hash: userAgentHash,
      });

    if (insertError) {
      console.error('Failed to insert view event:', insertError);
      // Return success anyway to not disrupt user experience
      return NextResponse.json({ success: true }, { status: 200 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Error tracking view:', error);
    // Fail silently - analytics failures shouldn't impact user experience
    return NextResponse.json({ success: true }, { status: 200 });
  }
}

// Enable edge runtime for better geolocation support
export const runtime = 'edge';
