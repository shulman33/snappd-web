/**
 * GET /api/v1/billing/invoices
 *
 * List user's invoices with pagination and filtering
 *
 * Features:
 * - Authentication required
 * - Pagination support (page, pageSize)
 * - Filter by date range (startDate, endDate)
 * - Filter by status (paid, open, void, etc.)
 * - Returns invoice list with PDF download URLs
 */

import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { ApiErrorHandler, ApiErrorCode } from '@/lib/api/errors'
import { ApiResponse } from '@/lib/api/response'
import { logger } from '@/lib/logger'
import { z } from 'zod'

// Validation schema for query parameters
const InvoiceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['draft', 'open', 'paid', 'void', 'uncollectible']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

export async function GET(request: NextRequest) {
  try {
    logger.info('Invoice list requested', request)

    const supabase = await createServerClient()

    // Check authentication
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return ApiErrorHandler.unauthorized(
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required to view invoices',
        undefined,
        request
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const queryParams = {
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '20',
      status: searchParams.get('status') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    }

    const validationResult = InvoiceListQuerySchema.safeParse(queryParams)

    if (!validationResult.success) {
      return ApiErrorHandler.badRequest(
        ApiErrorCode.VALIDATION_ERROR,
        'Invalid query parameters',
        validationResult.error.flatten().fieldErrors,
        request
      )
    }

    const { page, pageSize, status, startDate, endDate } = validationResult.data

    // Calculate offset
    const offset = (page - 1) * pageSize

    // Build query
    let query = supabase
      .from('invoices')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    if (startDate) {
      query = query.gte('created_at', startDate)
    }

    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    // Apply pagination
    query = query.range(offset, offset + pageSize - 1)

    // Execute query
    const { data: invoices, error: fetchError, count } = await query

    if (fetchError) {
      logger.error('Failed to fetch invoices', request, {
        userId: user.id,
        error: fetchError
      })
      return ApiErrorHandler.internal(
        ApiErrorCode.DATABASE_ERROR,
        'Failed to fetch invoices',
        undefined,
        request
      )
    }

    logger.info('Invoices retrieved successfully', request, {
      userId: user.id,
      count: invoices?.length || 0,
      total: count || 0,
      page,
      pageSize
    })

    // Format response
    const formattedInvoices = (invoices || []).map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      stripeInvoiceId: invoice.stripe_invoice_id,
      status: invoice.status,
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      total: invoice.total,
      amountPaid: invoice.amount_paid,
      amountDue: invoice.amount_due,
      currency: 'usd', // Default currency
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
      dueDate: invoice.due_date,
      paidAt: invoice.paid_at,
      hostedInvoiceUrl: invoice.stripe_hosted_invoice_url,
      pdfUrl: invoice.stripe_invoice_pdf,
      createdAt: invoice.created_at,
    }))

    return ApiResponse.paginated(
      formattedInvoices,
      {
        page,
        pageSize,
        total: count || 0
      }
    )
  } catch (error) {
    return ApiErrorHandler.handle(error, {
      request,
      logContext: {
        route: 'GET /api/v1/billing/invoices'
      }
    })
  }
}
