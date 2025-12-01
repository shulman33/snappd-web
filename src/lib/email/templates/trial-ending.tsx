/**
 * Trial Ending Email Template
 *
 * Sends a reminder email when a user's free trial is about to end.
 * Encourages conversion to paid subscription.
 */

import { SendGridEmailService, SendEmailOptions } from '../sendgrid'

/**
 * Trial ending email data
 */
export interface TrialEndingEmailData {
  userName?: string
  planName: string
  trialEndDate: string
  daysRemaining: number
  upgradeUrl: string
  features?: string[]
}

/**
 * Generate trial ending email HTML
 */
function generateTrialEndingEmailHtml(data: TrialEndingEmailData): string {
  const featuresHtml = data.features?.length
    ? `
      <div style="margin: 20px 0;">
        <p style="font-weight: 600; margin-bottom: 10px;">What you'll keep with ${data.planName}:</p>
        <ul style="color: #666; padding-left: 20px;">
          ${data.features.map(feature => `<li style="margin-bottom: 8px;">${feature}</li>`).join('')}
        </ul>
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
          <h1 style="color: #F59E0B; margin-top: 0;">Your Trial Ends ${data.daysRemaining === 1 ? 'Tomorrow' : `in ${data.daysRemaining} Days`}</h1>
          ${data.userName ? `<p>Hi ${data.userName},</p>` : '<p>Hi there,</p>'}
          <p>Your free trial of <strong>${data.planName}</strong> will end on <strong>${data.trialEndDate}</strong>.</p>

          <p>To keep using your premium features without interruption, make sure your payment method is set up.</p>

          ${featuresHtml}

          <div style="background-color: #FEF3C7; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #92400E;">
              <strong>What happens if you don't add a payment method?</strong><br>
              Your subscription will be canceled and you'll lose access to premium features. Don't worry - your data will be retained for 90 days if you decide to resubscribe.
            </p>
          </div>

          <div style="margin: 30px 0; text-align: center;">
            <a href="${data.upgradeUrl}"
               style="background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
              Keep My ${data.planName} Plan
            </a>
          </div>

          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            If you have any questions about your subscription, please contact us at support@snappd.app.
          </p>
        </div>

        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
          This email was sent by Snappd because your trial is ending soon.
        </p>
      </div>
    </body>
    </html>
  `
}

/**
 * Generate plain text version
 */
function generateTrialEndingEmailText(data: TrialEndingEmailData): string {
  let text = `Your Trial Ends ${data.daysRemaining === 1 ? 'Tomorrow' : `in ${data.daysRemaining} Days`}\n\n`
  text += `${data.userName ? `Hi ${data.userName},` : 'Hi there,'}\n\n`
  text += `Your free trial of ${data.planName} will end on ${data.trialEndDate}.\n\n`
  text += `To keep using your premium features without interruption, make sure your payment method is set up.\n\n`

  if (data.features?.length) {
    text += `What you'll keep with ${data.planName}:\n`
    data.features.forEach(feature => {
      text += `- ${feature}\n`
    })
    text += '\n'
  }

  text += `What happens if you don't add a payment method?\n`
  text += `Your subscription will be canceled and you'll lose access to premium features. Don't worry - your data will be retained for 90 days if you decide to resubscribe.\n\n`
  text += `Keep your plan: ${data.upgradeUrl}\n\n`
  text += `If you have any questions, contact us at support@snappd.app.`

  return text
}

/**
 * Send trial ending email
 *
 * @param to - Recipient email address
 * @param data - Trial ending data
 * @param templateId - Optional SendGrid dynamic template ID
 */
export async function sendTrialEndingEmail(
  to: string,
  data: TrialEndingEmailData,
  templateId?: string
): Promise<void> {
  const options: SendEmailOptions = {
    to,
    subject: `Your ${data.planName} trial ends ${data.daysRemaining === 1 ? 'tomorrow' : `in ${data.daysRemaining} days`}`,
    categories: ['trial-ending', 'billing'],
    customArgs: {
      type: 'trial-ending',
      days_remaining: data.daysRemaining.toString(),
    },
  }

  if (templateId) {
    // Use SendGrid dynamic template
    options.templateId = templateId
    options.dynamicTemplateData = data
  } else {
    // Use inline HTML
    options.html = generateTrialEndingEmailHtml(data)
    options.text = generateTrialEndingEmailText(data)
  }

  await SendGridEmailService.send(options)
}

export default sendTrialEndingEmail
