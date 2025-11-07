/**
 * Billing and Subscription Type Definitions
 *
 * This file contains all type definitions for the subscription billing system
 * including plans, subscriptions, invoices, team management, and usage tracking.
 */

// Plan Types
export type PlanType = 'free' | 'pro' | 'team';
export type BillingCycle = 'monthly' | 'annual';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'suspended';

/**
 * Plan configuration with quota limits
 */
export interface Plan {
  type: PlanType;
  name: string;
  description: string;
  price: {
    monthly: number; // in cents
    annual: number; // in cents
  };
  quotas: {
    screenshots: number | null; // null = unlimited
    storage: number | null; // in bytes, null = unlimited
    bandwidth: number | null; // in bytes per month, null = unlimited
  };
  features: string[];
  stripePriceIds: {
    monthly: string;
    annual: string;
  };
  minSeats?: number; // For team plans
}

/**
 * Active subscription with current billing status
 */
export interface Subscription {
  id: string;
  userId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string;
  planType: PlanType;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  seatCount: number | null; // For team plans
  teamId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Team subscription with multi-user management
 */
export interface Team {
  id: string;
  name: string;
  adminUserId: string;
  subscriptionId: string | null;
  seatCount: number;
  filledSeats: number;
  billingEmail: string | null;
  companyName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Team member with invitation and access status
 */
export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: 'admin' | 'member';
  status: 'pending' | 'active' | 'removed';
  invitationToken: string | null;
  invitationExpiresAt: Date | null;
  invitedAt: Date;
  joinedAt: Date | null;
  removedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Monthly usage tracking against quotas
 */
export interface UsageRecord {
  id: string;
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  screenshotCount: number;
  storageBytes: number;
  bandwidthBytes: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Invoice with line items and tax breakdown
 */
export interface Invoice {
  id: string;
  userId: string;
  subscriptionId: string | null;
  stripeInvoiceId: string;
  stripeHostedInvoiceUrl: string | null;
  stripeInvoicePdf: string | null;
  invoiceNumber: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  subtotal: number; // in cents
  tax: number; // in cents
  total: number; // in cents
  amountPaid: number; // in cents
  amountDue: number; // in cents
  lineItems: InvoiceLineItem[];
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Individual line item on an invoice
 */
export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: number; // in cents
  amount: number; // in cents
  metadata?: Record<string, string>;
}

/**
 * Credit balance from downgrades and refunds
 */
export interface CreditBalance {
  id: string;
  userId: string;
  currentBalance: number; // in cents
  transactions: CreditTransaction[];
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Individual credit transaction
 */
export interface CreditTransaction {
  type: 'credit' | 'debit' | 'expiration';
  amount: number; // in cents
  description: string;
  timestamp: Date;
  metadata?: Record<string, string>;
}

/**
 * Subscription lifecycle event for audit trail
 */
export interface SubscriptionEvent {
  id: string;
  subscriptionId: string;
  userId: string;
  eventType:
    | 'created'
    | 'trial_started'
    | 'trial_converted'
    | 'trial_canceled'
    | 'upgraded'
    | 'downgraded'
    | 'canceled'
    | 'reactivated'
    | 'payment_succeeded'
    | 'payment_failed'
    | 'suspended'
    | 'resumed';
  previousPlan: string | null;
  newPlan: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Payment recovery attempt during dunning
 */
export interface DunningAttempt {
  id: string;
  subscriptionId: string;
  attemptNumber: number; // 1, 2, or 3
  attemptDate: Date;
  paymentResult: 'pending' | 'success' | 'failed';
  failureReason: string | null;
  nextRetryDate: Date | null;
  notificationSent: boolean;
  notificationSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Quota check result with upgrade information
 */
export interface QuotaCheckResult {
  allowed: boolean;
  current: number;
  limit: number | null; // null = unlimited
  unit: string; // 'screenshots', 'bytes', etc.
  planType: PlanType;
  upgrade?: {
    message: string;
    plan: PlanType;
    url: string;
  };
}

/**
 * Stripe webhook event for idempotency tracking
 */
export interface StripeWebhookEvent {
  id: string; // Stripe event ID
  type: string;
  apiVersion: string | null;
  data: Record<string, unknown>;
  processed: boolean;
  processedAt: Date | null;
  error: string | null;
  createdAt: Date;
}

/**
 * Checkout session creation parameters
 */
export interface CreateCheckoutSessionParams {
  userId: string;
  email: string;
  planType: PlanType;
  billingCycle: BillingCycle;
  seatCount?: number; // Required for team plans
  successUrl: string;
  cancelUrl: string;
}

/**
 * Subscription update parameters
 */
export interface UpdateSubscriptionParams {
  subscriptionId: string;
  newPlanType?: PlanType;
  newBillingCycle?: BillingCycle;
  newSeatCount?: number;
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
}

/**
 * Team invitation parameters
 */
export interface CreateTeamInvitationParams {
  teamId: string;
  email: string;
  role: 'admin' | 'member';
  invitedByUserId: string;
}

/**
 * Usage statistics response
 */
export interface UsageStats {
  periodStart: Date;
  periodEnd: Date;
  screenshots: {
    current: number;
    limit: number | null;
    percentage: number | null;
  };
  storage: {
    current: number; // in bytes
    limit: number | null;
    percentage: number | null;
  };
  bandwidth: {
    current: number; // in bytes
    limit: number | null;
    percentage: number | null;
  };
  subscription: {
    plan: PlanType;
    status: SubscriptionStatus;
    trialEndsAt: Date | null;
    renewsAt: Date;
    cancelAtPeriodEnd: boolean;
  };
}

/**
 * Proration preview for plan changes
 */
export interface ProrationPreview {
  amountDue: number; // in cents
  proratedCredit: number; // in cents (negative)
  proratedCharge: number; // in cents (positive)
  nextBillingDate: Date;
  lineItems: InvoiceLineItem[];
}

/**
 * Analytics metrics for subscription reporting
 */
export interface SubscriptionAnalytics {
  mrr: number; // Monthly Recurring Revenue in cents
  arr: number; // Annual Recurring Revenue in cents
  activeSubscriptions: number;
  trialSubscriptions: number;
  churnedSubscriptions: number;
  conversionRate: number; // percentage
  churnRate: number; // percentage
  averageRevenuePerUser: number; // in cents
  lifetimeValue: number; // in cents
}
