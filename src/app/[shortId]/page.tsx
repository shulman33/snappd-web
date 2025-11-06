/**
 * Share page for viewing screenshots via short URL
 *
 * Features:
 * - Public viewing of screenshots
 * - Expiration checking (30 days for free tier)
 * - Access control (public, private, password-protected)
 * - View tracking for analytics
 */

import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { getOptimizedUrl } from '@/lib/uploads/storage'
import Image from 'next/image'
import Link from 'next/link'

interface SharePageProps {
  params: Promise<{
    shortId: string
  }>
}

export default async function SharePage({ params }: SharePageProps) {
  const { shortId } = await params
  const supabase = await createServerClient()

  // Fetch screenshot by short ID
  const { data: screenshot, error } = await supabase
    .from('screenshots')
    .select(`
      *,
      profiles!inner(
        full_name,
        plan
      )
    `)
    .eq('short_id', shortId)
    .single()

  if (error || !screenshot) {
    notFound()
  }

  // Get current user (if authenticated)
  const {
    data: { user }
  } = await supabase.auth.getUser()

  const isOwner = user?.id === screenshot.user_id

  // Check expiration
  const now = new Date()
  const isExpired = screenshot.expires_at && new Date(screenshot.expires_at) < now

  if (isExpired && !isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Link Expired</h1>
            <p className="text-gray-600 mb-6">
              This screenshot link has expired and is no longer accessible.
            </p>
            {screenshot.expires_at && (
              <p className="text-sm text-gray-500">
                Expired on {new Date(screenshot.expires_at).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              Want permanent links for your screenshots?{' '}
              <Link href="/pricing" className="font-medium underline hover:text-blue-900">
                Upgrade to Pro
              </Link>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Check sharing mode
  if (screenshot.sharing_mode === 'private' && !isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Private Screenshot</h1>
            <p className="text-gray-600 mb-6">
              This screenshot is private. Please sign in to view it.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  // TODO: Handle password-protected mode (T074)
  if (screenshot.sharing_mode === 'password' && !isOwner) {
    // For now, show a placeholder
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Password Protected
            </h1>
            <p className="text-gray-600 mb-6">
              This screenshot is password protected. Password verification will be implemented in Phase 7 (T074).
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Generate optimized image URL
  const imageUrl = getOptimizedUrl(screenshot.storage_path)

  // Calculate time remaining until expiration (if applicable)
  let expirationMessage = null
  if (screenshot.expires_at) {
    const expiresAt = new Date(screenshot.expires_at)
    const timeRemaining = expiresAt.getTime() - now.getTime()
    const daysRemaining = Math.floor(timeRemaining / (1000 * 60 * 60 * 24))
    const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60))

    if (daysRemaining > 0) {
      expirationMessage = `Expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`
    } else if (hoursRemaining > 0) {
      expirationMessage = `Expires in ${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}`
    } else {
      expirationMessage = 'Expires soon'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-2xl font-bold text-blue-600">
                Snappd
              </Link>
              {isOwner && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Your Screenshot
                </span>
              )}
            </div>
            <div className="flex items-center space-x-4">
              {expirationMessage && (
                <span className="text-sm text-gray-600">{expirationMessage}</span>
              )}
              {!user && (
                <Link
                  href="/login"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Image container */}
          <div className="relative bg-gray-900 flex items-center justify-center min-h-[400px]">
            <Image
              src={imageUrl}
              alt={screenshot.original_filename}
              width={screenshot.width}
              height={screenshot.height}
              className="max-w-full h-auto"
              priority
            />
          </div>

          {/* Screenshot details */}
          <div className="p-6 border-t border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {screenshot.original_filename}
                </h2>
                <p className="text-sm text-gray-500">
                  {screenshot.width} × {screenshot.height} •{' '}
                  {(screenshot.file_size / 1024).toFixed(2)} KB •{' '}
                  {screenshot.created_at ? new Date(screenshot.created_at).toLocaleDateString() : 'Unknown date'}
                </p>
              </div>
              {isOwner && (
                <Link
                  href="/dashboard/screenshots"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  View Dashboard
                </Link>
              )}
            </div>

            {/* View count */}
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              <span>{screenshot.views} views</span>
            </div>
          </div>
        </div>

        {/* CTA for non-users */}
        {!user && (
          <div className="mt-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-8 text-center text-white">
            <h3 className="text-2xl font-bold mb-2">
              Create your own screenshot sharing links
            </h3>
            <p className="text-blue-100 mb-6">
              Upload, share, and track your screenshots with Snappd
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-blue-600 bg-white hover:bg-gray-50 transition-colors"
            >
              Get Started for Free
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
