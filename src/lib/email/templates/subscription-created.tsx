/**
 * Subscription Created Email Template
 *
 * Sends a welcome email when a user creates a new subscription.
 * Includes subscription details and getting started information.
 */

import { SendGridEmailService, SendEmailOptions } from '../sendgrid'

/**
 * Subscription created email data
 */
export interface SubscriptionCreatedEmailData {
  userName?: string
  planName: string
  billingCycle: 'monthly' | 'annual'
  price: string
  trialEndDate?: string
  nextBillingDate: string
  dashboardUrl: string
  features?: string[]
  isTrialing: boolean
}

/**
 * Generate subscription created email HTML
 */
function generateSubscriptionCreatedEmailHtml(data: SubscriptionCreatedEmailData): string {
  const featuresHtml = data.features?.length
    ? `
      <div style="margin: 20px 0;">
        <p style="font-weight: 600; margin-bottom: 10px;">Here's what's included in your ${data.planName} plan:</p>
        <ul style="color: #666; padding-left: 20px;">
          ${data.features.map(feature => `<li style="margin-bottom: 8px;">${feature}</li>`).join('')}
        </ul>
      </div>
    `
    : ''

  const trialInfo = data.isTrialing && data.trialEndDate
    ? `
      <div style="background-color: #DBEAFE; border-radius: 6px; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #1E40AF;">
          <strong>Your 14-day free trial has started!</strong><br>
          You have full access to all ${data.planName} features until ${data.trialEndDate}. Your first payment of ${data.price} will be charged on ${data.nextBillingDate}.
        </p>
      </div>
    `
    : ''

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
          <h1 style="color: #10B981; margin-top: 0;">Welcome to ${data.planName}!</h1>
          ${data.userName ? `<p>Hi ${data.userName},</p>` : '<p>Hi there,</p>'}
          <p>Thank you for subscribing to Snappd <strong>${data.planName}</strong>! Your subscription is now active.</p>

          ${trialInfo}

          <div style="background-color: #f9fafb; border-radius: 6px; padding: 20px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Plan</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${data.planName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Billing</td>
                <td style="padding: 8px 0; text-align: right;">${data.billingCycle === 'annual' ? 'Annual' : 'Monthly'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Price</td>
                <td style="padding: 8px 0; text-align: right;">${data.price}/${data.billingCycle === 'annual' ? 'year' : 'month'}</td>
              </tr>
              ${!data.isTrialing ? `
              <tr>
                <td style="padding: 8px 0; color: #666;">Next billing date</td>
                <td style="padding: 8px 0; text-align: right;">${data.nextBillingDate}</td>
              </tr>
              ` : ''}
            </table>
          </div>

          ${featuresHtml}

          <div style="margin: 30px 0; text-align: center;">
            <a href="${data.dashboardUrl}"
               style="background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
              Go to Dashboard
            </a>
          </div>

          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            You can manage your subscription anytime from your account settings. If you have any questions, reach out to us at support@snappd.app.
          </p>
        </div>

        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
          This email was sent by Snappd to confirm your subscription.
        </p>
      </div>
    </body>
    </html>
  `
}

/**
 * Generate plain text version
 */
function generateSubscriptionCreatedEmailText(data: SubscriptionCreatedEmailData): string {
  let text = `Welcome to ${data.planName}!\n\n`
  text += `${data.userName ? `Hi ${data.userName},` : 'Hi there,'}\n\n`
  text += `Thank you for subscribing to Snappd ${data.planName}! Your subscription is now active.\n\n`

  if (data.isTrialing && data.trialEndDate) {
    text += `Your 14-day free trial has started!\n`
    text += `You have full access to all ${data.planName} features until ${data.trialEndDate}. `
    text += `Your first payment of ${data.price} will be charged on ${data.nextBillingDate}.\n\n`
  }

  text += `Subscription Details:\n`
  text += `- Plan: ${data.planName}\n`
  text += `- Billing: ${data.billingCycle === 'annual' ? 'Annual' : 'Monthly'}\n`
  text += `- Price: ${data.price}/${data.billingCycle === 'annual' ? 'year' : 'month'}\n`
  if (!data.isTrialing) {
    text += `- Next billing date: ${data.nextBillingDate}\n`
  }
  text += '\n'

  if (data.features?.length) {
    text += `What's included in your ${data.planName} plan:\n`
    data.features.forEach(feature => {
      text += `- ${feature}\n`
    })
    text += '\n'
  }

  text += `Go to your dashboard: ${data.dashboardUrl}\n\n`
  text += `You can manage your subscription anytime from your account settings. `
  text += `If you have any questions, reach out to us at support@snappd.app.`

  return text
}

/**
 * Send subscription created email
 *
 * @param to - Recipient email address
 * @param data - Subscription data
 * @param templateId - Optional SendGrid dynamic template ID
 */
export async function sendSubscriptionCreatedEmail(
  to: string,
  data: SubscriptionCreatedEmailData,
  templateId?: string
): Promise<void> {
  const subject = data.isTrialing
    ? `Welcome to ${data.planName} - Your trial has started!`
    : `Welcome to ${data.planName}!`

  const options: SendEmailOptions = {
    to,
    subject,
    categories: ['subscription-created', 'billing'],
    customArgs: {
      type: 'subscription-created',
      plan: data.planName.toLowerCase(),
      is_trialing: data.isTrialing.toString(),
    },
  }

  if (templateId) {
    // Use SendGrid dynamic template
    options.templateId = templateId
    options.dynamicTemplateData = data
  } else {
    // Use inline HTML
    options.html = generateSubscriptionCreatedEmailHtml(data)
    options.text = generateSubscriptionCreatedEmailText(data)
  }

  await SendGridEmailService.send(options)
}

export default sendSubscriptionCreatedEmail
