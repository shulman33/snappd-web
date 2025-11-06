/**
 * Email Types and Interfaces
 *
 * This module defines TypeScript types and interfaces for email functionality.
 */

/**
 * Email provider types
 */
export type EmailProvider = 'sendgrid' | 'supabase';

/**
 * Email delivery status
 */
export enum EmailDeliveryStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  BOUNCED = 'bounced',
}

/**
 * Email event types (for webhooks)
 */
export enum EmailEventType {
  PROCESSED = 'processed',
  DROPPED = 'dropped',
  DELIVERED = 'delivered',
  DEFERRED = 'deferred',
  BOUNCE = 'bounce',
  OPEN = 'open',
  CLICK = 'click',
  SPAM_REPORT = 'spamreport',
  UNSUBSCRIBE = 'unsubscribe',
  GROUP_UNSUBSCRIBE = 'group_unsubscribe',
  GROUP_RESUBSCRIBE = 'group_resubscribe',
}

/**
 * SendGrid webhook event payload
 */
export interface SendGridWebhookEvent {
  email: string;
  timestamp: number;
  event: EmailEventType;
  'smtp-id'?: string;
  sg_event_id?: string;
  sg_message_id?: string;
  reason?: string;
  status?: string;
  response?: string;
  attempt?: string;
  category?: string[];
  ip?: string;
  url?: string;
  useragent?: string;
  [key: string]: any;
}

/**
 * Email tracking metadata
 */
export interface EmailTrackingMetadata {
  emailId: string;
  userId?: string;
  templateType: string;
  sentAt: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  status: EmailDeliveryStatus;
  provider: EmailProvider;
  retryCount?: number;
  errorMessage?: string;
}

/**
 * Email rate limit configuration
 */
export interface EmailRateLimitConfig {
  maxEmailsPerHour: number;
  maxEmailsPerDay: number;
  cooldownPeriodMs: number;
}

/**
 * Default rate limits by email type
 */
export const EMAIL_RATE_LIMITS: Record<string, EmailRateLimitConfig> = {
  'email-verification': {
    maxEmailsPerHour: 3,
    maxEmailsPerDay: 10,
    cooldownPeriodMs: 60000, // 1 minute
  },
  'password-reset': {
    maxEmailsPerHour: 3,
    maxEmailsPerDay: 10,
    cooldownPeriodMs: 60000, // 1 minute
  },
  'magic-link': {
    maxEmailsPerHour: 5,
    maxEmailsPerDay: 20,
    cooldownPeriodMs: 30000, // 30 seconds
  },
  welcome: {
    maxEmailsPerHour: 1,
    maxEmailsPerDay: 1,
    cooldownPeriodMs: 0,
  },
  'screenshot-shared': {
    maxEmailsPerHour: 20,
    maxEmailsPerDay: 100,
    cooldownPeriodMs: 5000, // 5 seconds
  },
};

/**
 * Email queue item
 */
export interface EmailQueueItem {
  id: string;
  to: string;
  templateType: string;
  data: Record<string, any>;
  priority: number;
  retryCount: number;
  maxRetries: number;
  scheduledAt?: Date;
  createdAt: Date;
}

/**
 * Email validation result
 */
export interface EmailValidationResult {
  isValid: boolean;
  email?: string;
  error?: string;
  suggestions?: string[];
}

/**
 * Bulk email recipient
 */
export interface BulkEmailRecipient {
  email: string;
  name?: string;
  customData?: Record<string, any>;
}

/**
 * Bulk email options
 */
export interface BulkEmailOptions {
  recipients: BulkEmailRecipient[];
  templateId: string;
  subject: string;
  from?: {
    email: string;
    name?: string;
  };
  categories?: string[];
  sendAt?: Date;
  batchSize?: number;
}

/**
 * Email analytics data
 */
export interface EmailAnalytics {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  totalFailed: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

/**
 * Email template configuration
 */
export interface EmailTemplateConfig {
  id: string;
  name: string;
  type: string;
  sendgridTemplateId?: string;
  subject: string;
  description?: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
