/**
 * SendGrid Email Service
 *
 * This module provides a reusable email service for sending transactional emails
 * via SendGrid. It includes retry logic, error handling, and logging.
 */

import sgMail from '@sendgrid/mail';
import type { MailDataRequired } from '@sendgrid/mail';

// Initialize SendGrid with API key
if (!process.env.SENDGRID_API_KEY) {
  console.warn('SENDGRID_API_KEY is not set. Email sending will fail.');
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Email template types
 */
export enum EmailTemplate {
  EMAIL_VERIFICATION = 'email-verification',
  PASSWORD_RESET = 'password-reset',
  MAGIC_LINK = 'magic-link',
  WELCOME = 'welcome',
  SCREENSHOT_SHARED = 'screenshot-shared',
}

/**
 * Base email options
 */
export interface SendEmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, any>;
  from?: {
    email: string;
    name?: string;
  };
  categories?: string[];
  customArgs?: Record<string, string>;
}

/**
 * Email verification data
 */
export interface EmailVerificationData {
  confirmationUrl: string;
  appName?: string;
}

/**
 * Password reset data
 */
export interface PasswordResetData {
  resetUrl: string;
  appName?: string;
  expiryHours?: number;
}

/**
 * Magic link data
 */
export interface MagicLinkData {
  loginUrl: string;
  appName?: string;
  expiryMinutes?: number;
}

/**
 * Welcome email data
 */
export interface WelcomeEmailData {
  userName?: string;
  appName?: string;
  dashboardUrl?: string;
}

/**
 * Screenshot shared email data
 */
export interface ScreenshotSharedData {
  screenshotUrl: string;
  sharedBy?: string;
  message?: string;
}

/**
 * Default sender configuration
 */
const DEFAULT_FROM = {
  email: process.env.SENDGRID_FROM_EMAIL || 'noreply@snappd.app',
  name: process.env.SENDGRID_FROM_NAME || 'Snappd',
};

/**
 * SendGrid email service class
 */
export class SendGridEmailService {
  /**
   * Send a generic email
   */
  static async send(options: SendEmailOptions): Promise<void> {
    const msg: MailDataRequired = {
      to: options.to,
      from: options.from || DEFAULT_FROM,
      subject: options.subject,
      ...(options.html && { html: options.html }),
      ...(options.text && { text: options.text }),
      ...(options.templateId && { templateId: options.templateId }),
      ...(options.dynamicTemplateData && {
        dynamicTemplateData: options.dynamicTemplateData
      }),
      ...(options.categories && { categories: options.categories }),
      ...(options.customArgs && { customArgs: options.customArgs }),
    };

    try {
      await sgMail.send(msg);
      console.log(`Email sent successfully to ${options.to}`);
    } catch (error) {
      console.error('SendGrid email error:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const sgError = error as { response?: { body?: any } };
        console.error('SendGrid error details:', sgError.response?.body);
      }
      throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send email with retry logic
   */
  static async sendWithRetry(
    options: SendEmailOptions,
    maxAttempts: number = 3,
    delays: number[] = [0, 120000, 300000] // 0ms, 2min, 5min
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Wait for delay if not first attempt
        if (attempt > 0 && delays[attempt]) {
          await new Promise(resolve => setTimeout(resolve, delays[attempt]));
        }

        await this.send(options);
        console.log(`Email sent successfully on attempt ${attempt + 1}`);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`Email send attempt ${attempt + 1} failed:`, lastError.message);

        if (attempt === maxAttempts - 1) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error('Failed to send email after retries');
  }

  /**
   * Send email verification
   */
  static async sendEmailVerification(
    to: string,
    data: EmailVerificationData,
    templateId?: string
  ): Promise<void> {
    const options: SendEmailOptions = {
      to,
      subject: 'Verify Your Email Address',
      categories: ['email-verification'],
      customArgs: {
        type: EmailTemplate.EMAIL_VERIFICATION,
      },
    };

    if (templateId) {
      // Use SendGrid dynamic template
      options.templateId = templateId;
      options.dynamicTemplateData = {
        confirmationUrl: data.confirmationUrl,
        appName: data.appName || 'Snappd',
      };
    } else {
      // Use inline HTML
      options.html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4F46E5;">Verify Your Email Address</h1>
            <p>Thanks for signing up for ${data.appName || 'Snappd'}!</p>
            <p>Please click the button below to verify your email address:</p>
            <div style="margin: 30px 0;">
              <a href="${data.confirmationUrl}"
                 style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Verify Email Address
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${data.confirmationUrl}" style="color: #4F46E5;">${data.confirmationUrl}</a>
            </p>
            <p style="color: #666; font-size: 14px;">
              This link will expire in 24 hours.
            </p>
          </div>
        </body>
        </html>
      `;
      options.text = `Verify Your Email Address\n\nThanks for signing up for ${data.appName || 'Snappd'}!\n\nPlease click the link below to verify your email address:\n${data.confirmationUrl}\n\nThis link will expire in 24 hours.`;
    }

    await this.send(options);
  }

  /**
   * Send password reset email
   */
  static async sendPasswordReset(
    to: string,
    data: PasswordResetData,
    templateId?: string
  ): Promise<void> {
    const options: SendEmailOptions = {
      to,
      subject: 'Reset Your Password',
      categories: ['password-reset'],
      customArgs: {
        type: EmailTemplate.PASSWORD_RESET,
      },
    };

    if (templateId) {
      // Use SendGrid dynamic template
      options.templateId = templateId;
      options.dynamicTemplateData = {
        resetUrl: data.resetUrl,
        appName: data.appName || 'Snappd',
        expiryHours: data.expiryHours || 1,
      };
    } else {
      // Use inline HTML
      options.html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4F46E5;">Reset Your Password</h1>
            <p>We received a request to reset your password for your ${data.appName || 'Snappd'} account.</p>
            <p>Click the button below to reset your password:</p>
            <div style="margin: 30px 0;">
              <a href="${data.resetUrl}"
                 style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${data.resetUrl}" style="color: #4F46E5;">${data.resetUrl}</a>
            </p>
            <p style="color: #666; font-size: 14px;">
              This link will expire in ${data.expiryHours || 1} hour(s).
            </p>
            <p style="color: #999; font-size: 13px; margin-top: 30px;">
              If you didn't request this password reset, you can safely ignore this email.
            </p>
          </div>
        </body>
        </html>
      `;
      options.text = `Reset Your Password\n\nWe received a request to reset your password for your ${data.appName || 'Snappd'} account.\n\nClick the link below to reset your password:\n${data.resetUrl}\n\nThis link will expire in ${data.expiryHours || 1} hour(s).\n\nIf you didn't request this password reset, you can safely ignore this email.`;
    }

    await this.sendWithRetry(options);
  }

  /**
   * Send magic link email
   */
  static async sendMagicLink(
    to: string,
    data: MagicLinkData,
    templateId?: string
  ): Promise<void> {
    const options: SendEmailOptions = {
      to,
      subject: 'Your Login Link',
      categories: ['magic-link'],
      customArgs: {
        type: EmailTemplate.MAGIC_LINK,
      },
    };

    if (templateId) {
      // Use SendGrid dynamic template
      options.templateId = templateId;
      options.dynamicTemplateData = {
        loginUrl: data.loginUrl,
        appName: data.appName || 'Snappd',
        expiryMinutes: data.expiryMinutes || 60,
      };
    } else {
      // Use inline HTML
      options.html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4F46E5;">Your Login Link</h1>
            <p>Click the button below to sign in to ${data.appName || 'Snappd'}:</p>
            <div style="margin: 30px 0;">
              <a href="${data.loginUrl}"
                 style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Sign In
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${data.loginUrl}" style="color: #4F46E5;">${data.loginUrl}</a>
            </p>
            <p style="color: #666; font-size: 14px;">
              This link will expire in ${data.expiryMinutes || 60} minutes.
            </p>
            <p style="color: #999; font-size: 13px; margin-top: 30px;">
              If you didn't request this login link, you can safely ignore this email.
            </p>
          </div>
        </body>
        </html>
      `;
      options.text = `Your Login Link\n\nClick the link below to sign in to ${data.appName || 'Snappd'}:\n${data.loginUrl}\n\nThis link will expire in ${data.expiryMinutes || 60} minutes.\n\nIf you didn't request this login link, you can safely ignore this email.`;
    }

    await this.sendWithRetry(options);
  }

  /**
   * Send welcome email
   */
  static async sendWelcomeEmail(
    to: string,
    data: WelcomeEmailData,
    templateId?: string
  ): Promise<void> {
    const options: SendEmailOptions = {
      to,
      subject: `Welcome to ${data.appName || 'Snappd'}!`,
      categories: ['welcome'],
      customArgs: {
        type: EmailTemplate.WELCOME,
      },
    };

    if (templateId) {
      // Use SendGrid dynamic template
      options.templateId = templateId;
      options.dynamicTemplateData = {
        userName: data.userName,
        appName: data.appName || 'Snappd',
        dashboardUrl: data.dashboardUrl || process.env.NEXT_PUBLIC_APP_URL,
      };
    } else {
      // Use inline HTML
      options.html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4F46E5;">Welcome to ${data.appName || 'Snappd'}!</h1>
            ${data.userName ? `<p>Hi ${data.userName},</p>` : '<p>Hi there,</p>'}
            <p>Thanks for joining ${data.appName || 'Snappd'}! We're excited to have you on board.</p>
            <p>You can now start capturing and sharing screenshots with ease.</p>
            ${data.dashboardUrl ? `
              <div style="margin: 30px 0;">
                <a href="${data.dashboardUrl}"
                   style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Go to Dashboard
                </a>
              </div>
            ` : ''}
            <p>If you have any questions, feel free to reply to this email.</p>
            <p>Happy screenshotting!</p>
          </div>
        </body>
        </html>
      `;
      options.text = `Welcome to ${data.appName || 'Snappd'}!\n\n${data.userName ? `Hi ${data.userName},` : 'Hi there,'}\n\nThanks for joining ${data.appName || 'Snappd'}! We're excited to have you on board.\n\nYou can now start capturing and sharing screenshots with ease.\n\n${data.dashboardUrl ? `Go to your dashboard: ${data.dashboardUrl}\n\n` : ''}If you have any questions, feel free to reply to this email.\n\nHappy screenshotting!`;
    }

    await this.send(options);
  }

  /**
   * Send screenshot shared notification
   */
  static async sendScreenshotShared(
    to: string,
    data: ScreenshotSharedData,
    templateId?: string
  ): Promise<void> {
    const options: SendEmailOptions = {
      to,
      subject: 'Someone shared a screenshot with you',
      categories: ['screenshot-shared'],
      customArgs: {
        type: EmailTemplate.SCREENSHOT_SHARED,
      },
    };

    if (templateId) {
      // Use SendGrid dynamic template
      options.templateId = templateId;
      options.dynamicTemplateData = {
        screenshotUrl: data.screenshotUrl,
        sharedBy: data.sharedBy,
        message: data.message,
      };
    } else {
      // Use inline HTML
      options.html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #4F46E5;">Screenshot Shared</h1>
            ${data.sharedBy ? `<p>${data.sharedBy} shared a screenshot with you.</p>` : '<p>Someone shared a screenshot with you.</p>'}
            ${data.message ? `<p style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; font-style: italic;">"${data.message}"</p>` : ''}
            <div style="margin: 30px 0;">
              <a href="${data.screenshotUrl}"
                 style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Screenshot
              </a>
            </div>
          </div>
        </body>
        </html>
      `;
      options.text = `Screenshot Shared\n\n${data.sharedBy ? `${data.sharedBy} shared a screenshot with you.` : 'Someone shared a screenshot with you.'}\n\n${data.message ? `Message: "${data.message}"\n\n` : ''}View screenshot: ${data.screenshotUrl}`;
    }

    await this.send(options);
  }
}

export default SendGridEmailService;
