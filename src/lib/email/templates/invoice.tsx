/**
 * Invoice Email Template
 *
 * Sends invoice notification with PDF download link after successful payment.
 */

import { SendGridEmailService, SendEmailOptions } from '../sendgrid'

/**
 * Invoice email data
 */
export interface InvoiceEmailData {
  invoiceNumber: string
  invoiceUrl: string
  pdfUrl: string
  total: string
  subtotal: string
  tax?: string
  periodStart: string
  periodEnd: string
  planName: string
  userName?: string
}

/**
 * Generate invoice email HTML
 */
function generateInvoiceEmailHtml(data: InvoiceEmailData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h1 style="color: #4F46E5; margin-top: 0;">Invoice ${data.invoiceNumber}</h1>
          ${data.userName ? `<p>Hi ${data.userName},</p>` : '<p>Hi there,</p>'}
          <p>Your payment has been received. Here's your invoice for ${data.planName}.</p>

          <div style="background-color: #f9fafb; border-radius: 6px; padding: 20px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Invoice Number</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${data.invoiceNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Billing Period</td>
                <td style="padding: 8px 0; text-align: right;">${data.periodStart} - ${data.periodEnd}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Subtotal</td>
                <td style="padding: 8px 0; text-align: right;">${data.subtotal}</td>
              </tr>
              ${data.tax ? `
              <tr>
                <td style="padding: 8px 0; color: #666;">Tax</td>
                <td style="padding: 8px 0; text-align: right;">${data.tax}</td>
              </tr>
              ` : ''}
              <tr style="border-top: 2px solid #e5e7eb;">
                <td style="padding: 12px 0 8px; font-weight: 600;">Total</td>
                <td style="padding: 12px 0 8px; text-align: right; font-weight: 600; font-size: 18px; color: #4F46E5;">${data.total}</td>
              </tr>
            </table>
          </div>

          <div style="margin: 30px 0; text-align: center;">
            <a href="${data.invoiceUrl}"
               style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">
              View Invoice
            </a>
            <a href="${data.pdfUrl}"
               style="background-color: #6B7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Download PDF
            </a>
          </div>

          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            If you have any questions about this invoice, please contact us at support@snappd.app.
          </p>
        </div>

        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
          This email was sent by Snappd. You're receiving this because you have an active subscription.
        </p>
      </div>
    </body>
    </html>
  `
}

/**
 * Generate plain text version
 */
function generateInvoiceEmailText(data: InvoiceEmailData): string {
  let text = `Invoice ${data.invoiceNumber}\n\n`
  text += `${data.userName ? `Hi ${data.userName},` : 'Hi there,'}\n\n`
  text += `Your payment has been received. Here's your invoice for ${data.planName}.\n\n`
  text += `Invoice Details:\n`
  text += `- Invoice Number: ${data.invoiceNumber}\n`
  text += `- Billing Period: ${data.periodStart} - ${data.periodEnd}\n`
  text += `- Subtotal: ${data.subtotal}\n`
  if (data.tax) {
    text += `- Tax: ${data.tax}\n`
  }
  text += `- Total: ${data.total}\n\n`
  text += `View Invoice: ${data.invoiceUrl}\n`
  text += `Download PDF: ${data.pdfUrl}\n\n`
  text += `If you have any questions, contact us at support@snappd.app.`
  return text
}

/**
 * Send invoice email
 *
 * @param to - Recipient email address
 * @param data - Invoice data
 * @param templateId - Optional SendGrid dynamic template ID
 */
export async function sendInvoiceEmail(
  to: string,
  data: InvoiceEmailData,
  templateId?: string
): Promise<void> {
  const options: SendEmailOptions = {
    to,
    subject: `Invoice ${data.invoiceNumber} - Snappd`,
    categories: ['invoice'],
    customArgs: {
      type: 'invoice',
      invoice_number: data.invoiceNumber,
    },
  }

  if (templateId) {
    // Use SendGrid dynamic template
    options.templateId = templateId
    options.dynamicTemplateData = data
  } else {
    // Use inline HTML
    options.html = generateInvoiceEmailHtml(data)
    options.text = generateInvoiceEmailText(data)
  }

  await SendGridEmailService.send(options)
}

export default sendInvoiceEmail
