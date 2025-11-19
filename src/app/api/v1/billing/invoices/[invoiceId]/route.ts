/**
 * GET /api/v1/billing/invoices/[invoiceId]
 *
 * Get detailed information about a specific invoice
 *
 * Features:
 * - Authentication required
 * - Returns full invoice details including line items
 * - Includes PDF download URL and hosted invoice URL
 */

import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { ApiErrorHandler, ApiErrorCode } from '@/lib/api/errors'
import { ApiResponse } from '@/lib/api/response'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{
    invoiceId: string
  }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { invoiceId } = await params

    logger.info('Invoice detail requested', request, { invoiceId })

    const supabase = await createServerClient()

    // Check authentication
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return ApiErrorHandler.unauthorized(
        ApiErrorCode.UNAUTHORIZED,
        'Authentication required to view invoice',
        undefined,
        request
      )
    }

    // Fetch invoice
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return ApiErrorHandler.notFound(
          ApiErrorCode.NOT_FOUND,
          'Invoice not found',
          undefined,
          request
        )
      }

      logger.error('Failed to fetch invoice', request, {
        userId: user.id,
        invoiceId,
        error: fetchError
      })
      return ApiErrorHandler.internal(
        ApiErrorCode.DATABASE_ERROR,
        'Failed to fetch invoice',
        undefined,
        request
      )
    }

    if (!invoice) {
      return ApiErrorHandler.notFound(
        ApiErrorCode.NOT_FOUND,
        'Invoice not found',
        undefined,
        request
      )
    }

    logger.info('Invoice retrieved successfully', request, {
      userId: user.id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number
    })

    // Format response
    const formattedInvoice = {
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      stripeInvoiceId: invoice.stripe_invoice_id,
      subscriptionId: invoice.subscription_id,
      status: invoice.status,
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      total: invoice.total,
      amountPaid: invoice.amount_paid,
      amountDue: invoice.amount_due,
      currency: 'usd', // Default currency
      lineItems: invoice.line_items,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
      dueDate: invoice.due_date,
      paidAt: invoice.paid_at,
      hostedInvoiceUrl: invoice.stripe_hosted_invoice_url,
      pdfUrl: invoice.stripe_invoice_pdf,
      createdAt: invoice.created_at,
      updatedAt: invoice.updated_at,
    }

    return ApiResponse.success(
      formattedInvoice,
      'Invoice retrieved successfully'
    )
  } catch (error) {
    return ApiErrorHandler.handle(error, {
      request,
      logContext: {
        route: 'GET /api/v1/billing/invoices/[invoiceId]'
      }
    })
  }
}
