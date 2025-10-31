import { NextRequest } from 'next/server';

/**
 * Options for creating a mock NextRequest
 */
export interface MockRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  searchParams?: Record<string, string>;
}

/**
 * Create a mock NextRequest for testing API routes
 *
 * @example
 * const request = createMockRequest({
 *   method: 'POST',
 *   url: 'http://localhost:3000/api/auth/signup',
 *   body: { email: 'test@example.com', password: 'Pass123!' },
 * });
 */
export function createMockRequest(options: MockRequestOptions): NextRequest {
  const {
    method = 'GET',
    url = 'http://localhost:3000/api/test',
    headers = {},
    body,
    searchParams,
  } = options;

  // Build URL with search params
  const fullUrl = new URL(url);
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      fullUrl.searchParams.set(key, value);
    });
  }

  // Create Request init object
  const requestInit: RequestInit = {
    method,
    headers: new Headers(headers),
  };

  // Add body for POST/PATCH/PUT requests
  if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    requestInit.body = JSON.stringify(body);

    // Set Content-Type header if not already set
    const headerObj = requestInit.headers as Headers;
    if (!headerObj.has('Content-Type')) {
      headerObj.set('Content-Type', 'application/json');
    }
  }

  return new NextRequest(fullUrl.toString(), requestInit);
}

/**
 * Create authorization header object
 *
 * @example
 * const headers = withAuth('my-token-123');
 * // Returns: { 'Authorization': 'Bearer my-token-123' }
 */
export function withAuth(token: string = 'test-access-token'): Record<string, string> {
  return {
    'Authorization': `Bearer ${token}`,
  };
}

/**
 * Create an authenticated mock NextRequest
 *
 * @example
 * const request = createAuthRequest({
 *   method: 'GET',
 *   url: 'http://localhost:3000/api/auth/me',
 *   token: 'custom-token',
 * });
 */
export function createAuthRequest(
  options: MockRequestOptions & { token?: string }
): NextRequest {
  const { token = 'test-access-token', headers = {}, ...rest } = options;

  return createMockRequest({
    ...rest,
    headers: {
      ...withAuth(token),
      ...headers,
    },
  });
}

/**
 * Extract JSON body from NextResponse
 *
 * @example
 * const response = await POST(request);
 * const body = await getResponseBody(response);
 */
export async function getResponseBody<T = any>(response: Response): Promise<T> {
  return response.json();
}

/**
 * Create a mock request for a dynamic route parameter
 *
 * @example
 * // For route: /api/screenshots/[id]/route.ts
 * const request = createMockRequest({
 *   url: 'http://localhost:3000/api/screenshots/screenshot-123',
 * });
 */
export function createDynamicRouteRequest(
  options: MockRequestOptions & { params?: Record<string, string> }
): { request: NextRequest; params: Record<string, string> } {
  const { params = {}, ...requestOptions } = options;

  return {
    request: createMockRequest(requestOptions),
    params,
  };
}
