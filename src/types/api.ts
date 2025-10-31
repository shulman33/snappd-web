/**
 * API request and response types
 * Typed interfaces for REST API communication
 */

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  error: {
    message: string;
    code: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Signed URL response
 */
export interface SignedUrlResponse {
  upload_url: string;
  storage_path: string;
  expires_in: number;
}

/**
 * Screenshot response
 */
export interface ScreenshotResponse {
  id: string;
  short_id: string;
  original_filename: string;
  file_size: number;
  width: number;
  height: number;
  mime_type: string;
  public_url: string;
  share_url: string;
  storage_url: string;
  expires_at: string | null;
  views: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Public screenshot viewer response
 */
export interface PublicScreenshotResponse {
  short_id: string;
  original_filename: string;
  width: number;
  height: number;
  storage_url: string;
  views: number;
  created_at: string;
  seo_metadata: {
    title: string;
    description: string;
    image: string;
  };
}

/**
 * Profile response
 */
export interface ProfileResponse {
  id: string;
  email: string;
  full_name: string | null;
  plan: 'free' | 'pro' | 'team';
  created_at: string;
  updated_at: string;
}

/**
 * Auth session response
 */
export interface AuthSessionResponse {
  user: {
    id: string;
    email: string;
  };
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

/**
 * Usage response
 */
export interface UsageResponse {
  month: string;
  screenshot_count: number;
  screenshot_limit: number;
  storage_bytes: number;
  storage_mb: number;
  bandwidth_bytes: number;
  bandwidth_mb: number;
  plan: 'free' | 'pro' | 'team';
  limit_status: {
    at_limit: boolean;
    remaining: number;
    resets_at: string;
  };
  upgrade_prompt: {
    show_prompt: boolean;
    message: string;
    cta_text: string;
    urgency_level: 'low' | 'medium' | 'high';
  };
}

/**
 * Usage history response
 */
export interface UsageHistoryResponse {
  months: Array<{
    month: string;
    screenshot_count: number;
    storage_mb: number;
    bandwidth_mb: number;
  }>;
  total: {
    screenshots: number;
    storage_mb: number;
    bandwidth_mb: number;
  };
}

/**
 * Checkout session response
 */
export interface CheckoutSessionResponse {
  checkout_url: string;
}

/**
 * Portal session response
 */
export interface PortalSessionResponse {
  portal_url: string;
}

/**
 * Paginated list response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

