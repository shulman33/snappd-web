/**
 * Payment Failed Email Template
 *
 * Sends notification when a subscription payment fails.
 * Provides clear instructions for updating payment method and grace period information.
 */

import { SendGridEmailService, SendEmailOptions } from '../sendgrid'

/**
 * Payment failed email data
 */
export interface PaymentFailedEmailData {
  userName?: string
  planName: string
  failureReason: string
  amountDue: string
  attemptNumber: number
  daysRemaining: number
  updatePaymentUrl: string
  invoiceUrl?: string
}

/**
 * Get urgency level based on attempt number
 */
function getUrgencyLevel(attemptNumber: number): {
  color: string
  backgroundColor: string
  title: string
  tone: 'gentle' | 'urgent' | 'critical'
} {
  switch (attemptNumber) {
    case 1:
      return {
        color: '#F59E0B',
        backgroundColor: '#FEF3C7',
        title: 'Payment Failed',
        tone: 'gentle',
      }
    case 2:
      return {
        color: '#EF4444',
        backgroundColor: '#FEE2E2',
        title: 'Urgent: Payment Still Failing',
        tone: 'urgent',
      }
    case 3:
    default:
      return {
        color: '#DC2626',
        backgroundColor: '#FEE2E2',
        title: 'Final Notice: Payment Required',
        tone: 'critical',
      }
  }
}

/**
 * Generate payment failed email HTML
 */
function generatePaymentFailedEmailHtml(data: PaymentFailedEmailData): string {
  const urgency = getUrgencyLevel(data.attemptNumber)

  const attemptMessage =
    data.attemptNumber === 1
      ? 'We attempted to charge your payment method'
      : data.attemptNumber === 2
        ? 'We attempted to charge your payment method again'
        : 'This is our final attempt to charge your payment method'

  const consequenceMessage =
    data.attemptNumber === 1
      ? `<p>Don't worry - you still have <strong>${data.daysRemaining} days</strong> to update your payment method before your subscription is suspended.</p>`
      : data.attemptNumber === 2
        ? `<p><strong>Time is running out!</strong> You have <strong>${data.daysRemaining} days remaining</strong> to update your payment method and avoid service suspension.</p>`
        : `<p><strong>This is your last chance!</strong> If you don't update your payment method within <strong>${data.daysRemaining} days</strong>, your subscription will be suspended and you'll lose access to all premium features.</p>`

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
          <h1 style="color: ${urgency.color}; margin-top: 0;">${urgency.title}</h1>
          ${data.userName ? `<p>Hi ${data.userName},</p>` : '<p>Hi there,</p>'}

          <p>${attemptMessage} for your <strong>${data.planName}</strong> subscription, but the payment was unsuccessful.</p>

          <div style="background-color: #f9fafb; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #666;">
              <strong>Amount Due:</strong> ${data.amountDue}<br>
              <strong>Reason:</strong> ${data.failureReason}
            </p>
          </div>

          ${consequenceMessage}

          <div style="background-color: ${urgency.backgroundColor}; border-left: 4px solid ${urgency.color}; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #78350F;">
              <strong>What you need to do:</strong><br>
              Please update your payment method immediately to avoid service interruption. Your premium features will remain active during the grace period.
            </p>
          </div>

          <div style="margin: 30px 0; text-align: center;">
            <a href="${data.updatePaymentUrl}"
               style="background-color: ${urgency.color}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
              Update Payment Method
            </a>
          </div>

          ${data.invoiceUrl ? `<p style="text-align: center; margin-top: 10px;"><a href="${data.invoiceUrl}" style="color: #4F46E5; text-decoration: none; font-size: 14px;">View Invoice</a></p>` : ''}

          <div style="background-color: #f9fafb; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #666;">
              <strong>Grace Period:</strong> ${data.daysRemaining} days remaining<br>
              <strong>Retry Attempt:</strong> ${data.attemptNumber} of 3
            </p>
          </div>

          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            Having trouble? Contact us at support@snappd.app and we'll help you get this resolved.
          </p>
        </div>

        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
          This email was sent by Snappd because we were unable to process your payment.
        </p>
      </div>
    </body>
    </html>
  `
}

/**
 * Generate plain text version
 */
function generatePaymentFailedEmailText(data: PaymentFailedEmailData): string {
  const urgency = getUrgencyLevel(data.attemptNumber)

  const attemptMessage =
    data.attemptNumber === 1
      ? 'We attempted to charge your payment method'
      : data.attemptNumber === 2
        ? 'We attempted to charge your payment method again'
        : 'This is our final attempt to charge your payment method'

  const consequenceMessage =
    data.attemptNumber === 1
      ? `Don't worry - you still have ${data.daysRemaining} days to update your payment method before your subscription is suspended.`
      : data.attemptNumber === 2
        ? `Time is running out! You have ${data.daysRemaining} days remaining to update your payment method and avoid service suspension.`
        : `This is your last chance! If you don't update your payment method within ${data.daysRemaining} days, your subscription will be suspended and you'll lose access to all premium features.`

  let text = `${urgency.title}\n\n`
  text += `${data.userName ? `Hi ${data.userName},` : 'Hi there,'}\n\n`
  text += `${attemptMessage} for your ${data.planName} subscription, but the payment was unsuccessful.\n\n`
  text += `Amount Due: ${data.amountDue}\n`
  text += `Reason: ${data.failureReason}\n\n`
  text += `${consequenceMessage}\n\n`
  text += `What you need to do:\n`
  text += `Please update your payment method immediately to avoid service interruption. Your premium features will remain active during the grace period.\n\n`
  text += `Update your payment method here:\n${data.updatePaymentUrl}\n\n`

  if (data.invoiceUrl) {
    text += `View Invoice: ${data.invoiceUrl}\n\n`
  }

  text += `Grace Period: ${data.daysRemaining} days remaining\n`
  text += `Retry Attempt: ${data.attemptNumber} of 3\n\n`
  text += `Having trouble? Contact us at support@snappd.app and we'll help you get this resolved.`

  return text
}

/**
 * Send payment failed email
 *
 * @param to - Recipient email address
 * @param data - Payment failure data
 * @param templateId - Optional SendGrid dynamic template ID
 */
export async function sendPaymentFailedEmail(
  to: string,
  data: PaymentFailedEmailData,
  templateId?: string
): Promise<void> {
  const urgency = getUrgencyLevel(data.attemptNumber)
  const subjectPrefix =
    data.attemptNumber === 1
      ? 'Payment Failed'
      : data.attemptNumber === 2
        ? 'Urgent: Payment Failed'
        : 'Final Notice: Payment Required'

  const options: SendEmailOptions = {
    to,
    subject: `${subjectPrefix} - ${data.planName} Subscription`,
    categories: ['payment-failed', 'billing', 'dunning'],
    customArgs: {
      type: 'payment-failed',
      attempt_number: data.attemptNumber.toString(),
      days_remaining: data.daysRemaining.toString(),
    },
  }

  if (templateId) {
    // Use SendGrid dynamic template
    options.templateId = templateId
    options.dynamicTemplateData = data
  } else {
    // Use inline HTML
    options.html = generatePaymentFailedEmailHtml(data)
    options.text = generatePaymentFailedEmailText(data)
  }

  await SendGridEmailService.send(options)
}

export default sendPaymentFailedEmail
