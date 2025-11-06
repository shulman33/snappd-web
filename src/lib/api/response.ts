/**
 * Unified API Response Helpers
 *
 * Standard response formatting for successful API operations.
 * Use in conjunction with ApiErrorHandler for consistent API responses.
 *
 * @module lib/api/response
 */

import { NextResponse } from 'next/server';

/**
 * Standard success response structure
 */
export interface ApiSuccessResponse<T = unknown> {
  /** Success flag */
  success: true;
  /** Response data */
  data: T;
  /** Optional success message */
  message?: string;
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
  /** Success flag */
  success: true;
  /** Array of items */
  data: T[];
  /** Pagination metadata */
  pagination: {
    /** Current page number */
    page: number;
    /** Items per page */
    pageSize: number;
    /** Total number of items */
    total: number;
    /** Total number of pages */
    totalPages: number;
    /** Whether there is a next page */
    hasNext: boolean;
    /** Whether there is a previous page */
    hasPrevious: boolean;
  };
}

/**
 * Bulk operation success response
 */
export interface BulkSuccessResponse {
  /** Success flag */
  success: true;
  /** Total items requested */
  totalRequested: number;
  /** Number of successful operations */
  successCount: number;
  /** Number of failed operations (should be 0 for complete success) */
  failedCount: number;
  /** Optional message */
  message?: string;
}

/**
 * API Response Helpers
 */
export class ApiResponse {
  /**
   * Create a successful response
   *
   * @example
   * return ApiResponse.success({ userId: '123' });
   * return ApiResponse.success({ userId: '123' }, 'User created successfully');
   */
  static success<T>(data: T, message?: string, status: number = 200): NextResponse<ApiSuccessResponse<T>> {
    const response: ApiSuccessResponse<T> = {
      success: true,
      data,
    };

    if (message) {
      response.message = message;
    }

    return NextResponse.json(response, { status });
  }

  /**
   * Create a successful response with 201 Created status
   *
   * @example
   * return ApiResponse.created({ id: 'abc123' }, 'Screenshot uploaded successfully');
   */
  static created<T>(data: T, message?: string): NextResponse<ApiSuccessResponse<T>> {
    return this.success(data, message, 201);
  }

  /**
   * Create a successful response with 204 No Content status
   * Note: No body is returned for 204 responses
   *
   * @example
   * return ApiResponse.noContent();
   */
  static noContent(): NextResponse {
    return new NextResponse(null, { status: 204 });
  }

  /**
   * Create a paginated response
   *
   * @example
   * return ApiResponse.paginated(screenshots, { page: 1, pageSize: 20, total: 50 });
   */
  static paginated<T>(
    data: T[],
    pagination: {
      page: number;
      pageSize: number;
      total: number;
    }
  ): NextResponse<PaginatedResponse<T>> {
    const totalPages = Math.ceil(pagination.total / pagination.pageSize);
    const hasNext = pagination.page < totalPages;
    const hasPrevious = pagination.page > 1;

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        totalPages,
        hasNext,
        hasPrevious,
      },
    });
  }

  /**
   * Create a bulk operation success response
   *
   * @example
   * return ApiResponse.bulkSuccess(10, 10, 'All screenshots deleted successfully');
   */
  static bulkSuccess(
    totalRequested: number,
    successCount: number,
    message?: string
  ): NextResponse<BulkSuccessResponse> {
    return NextResponse.json({
      success: true,
      totalRequested,
      successCount,
      failedCount: 0,
      ...(message && { message }),
    });
  }

  /**
   * Create a simple JSON response (for backward compatibility)
   *
   * @example
   * return ApiResponse.json({ key: 'value' });
   */
  static json<T>(data: T, status: number = 200): NextResponse<T> {
    return NextResponse.json(data, { status });
  }
}
