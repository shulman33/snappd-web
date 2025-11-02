/**
 * Stripe Customer Management Utilities
 *
 * This module provides utilities for creating and managing Stripe customers,
 * integrating with the Supabase profiles table to maintain synchronization
 * between authentication and payment systems.
 *
 * Features:
 * - Create Stripe customers from user profiles
 * - Link Stripe customer IDs to user profiles
 * - Retrieve customer details
 * - Update customer information
 * - Handle customer metadata
 *
 * @see research.md section on Stripe integration
 * @see data-model.md for profiles table schema
 */

import Stripe from 'stripe';
import { createServerClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

/**
 * Initialize Stripe client with API key
 *
 * IMPORTANT: This client is initialized with the secret key and should only
 * be used in server-side contexts (API routes, server actions).
 * NEVER expose the secret key to the client.
 */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-10-29.clover',
  typescript: true,
});

/**
 * Type for profile row from Supabase
 */
type Profile = Database['public']['Tables']['profiles']['Row'];

/**
 * Parameters for creating a Stripe customer
 */
export interface CreateStripeCustomerParams {
  userId: string;
  email: string;
  fullName?: string | null;
  metadata?: Record<string, string>;
}

/**
 * Result of customer creation operation
 */
export interface CustomerCreationResult {
  customerId: string;
  customer: Stripe.Customer;
  profile: Profile;
}

/**
 * Error types for Stripe customer operations
 */
export class StripeCustomerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'StripeCustomerError';
  }
}

/**
 * Creates a Stripe customer and links it to a user profile
 *
 * This function:
 * 1. Verifies the user profile exists in Supabase
 * 2. Checks if customer already exists (prevents duplicates)
 * 3. Creates a new Stripe customer with user details
 * 4. Updates the profile with the Stripe customer ID
 *
 * @param params - Customer creation parameters
 * @returns CustomerCreationResult with customer and profile data
 * @throws StripeCustomerError if operation fails
 *
 * @example
 * ```typescript
 * // In an API route handler
 * export async function POST(request: NextRequest) {
 *   const supabase = await createServerClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *
 *   if (!user) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *
 *   try {
 *     const result = await createStripeCustomer({
 *       userId: user.id,
 *       email: user.email!,
 *       fullName: user.user_metadata.full_name,
 *     });
 *
 *     return NextResponse.json(result);
 *   } catch (error) {
 *     if (error instanceof StripeCustomerError) {
 *       return NextResponse.json(
 *         { error: error.message, code: error.code },
 *         { status: 400 }
 *       );
 *     }
 *     throw error;
 *   }
 * }
 * ```
 */
export async function createStripeCustomer(
  params: CreateStripeCustomerParams
): Promise<CustomerCreationResult> {
  const { userId, email, fullName, metadata = {} } = params;

  try {
    // Initialize Supabase client
    const supabase = await createServerClient();

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new StripeCustomerError(
        'User profile not found',
        'PROFILE_NOT_FOUND',
        profileError
      );
    }

    // Check if customer already exists
    if (profile.stripe_customer_id) {
      // Retrieve existing customer from Stripe
      const existingCustomer = await stripe.customers.retrieve(
        profile.stripe_customer_id
      );

      if (!existingCustomer.deleted) {
        return {
          customerId: profile.stripe_customer_id,
          customer: existingCustomer as Stripe.Customer,
          profile,
        };
      }

      // If customer was deleted in Stripe, we'll create a new one
      // and update the profile
    }

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email,
      name: fullName || undefined,
      description: `User ${userId}`,
      metadata: {
        user_id: userId,
        ...metadata,
      },
    });

    // Update profile with Stripe customer ID
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({
        stripe_customer_id: customer.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError || !updatedProfile) {
      // Rollback: Delete the Stripe customer if profile update fails
      await stripe.customers.del(customer.id);

      throw new StripeCustomerError(
        'Failed to link Stripe customer to profile',
        'PROFILE_UPDATE_FAILED',
        updateError
      );
    }

    return {
      customerId: customer.id,
      customer,
      profile: updatedProfile,
    };
  } catch (error) {
    // Handle Stripe-specific errors
    if (error instanceof Stripe.errors.StripeError) {
      throw new StripeCustomerError(
        `Stripe error: ${error.message}`,
        error.type || 'STRIPE_ERROR',
        {
          code: error.code,
          statusCode: error.statusCode,
          requestId: error.requestId,
        }
      );
    }

    // Re-throw StripeCustomerError
    if (error instanceof StripeCustomerError) {
      throw error;
    }

    // Handle unexpected errors
    throw new StripeCustomerError(
      'Failed to create Stripe customer',
      'UNKNOWN_ERROR',
      error
    );
  }
}

/**
 * Retrieves a Stripe customer by ID
 *
 * @param customerId - Stripe customer ID
 * @returns Stripe.Customer object
 * @throws StripeCustomerError if customer not found or deleted
 *
 * @example
 * ```typescript
 * const customer = await getStripeCustomer('cus_123');
 * console.log(customer.email);
 * ```
 */
export async function getStripeCustomer(
  customerId: string
): Promise<Stripe.Customer> {
  try {
    const customer = await stripe.customers.retrieve(customerId);

    if (customer.deleted) {
      throw new StripeCustomerError(
        'Customer has been deleted',
        'CUSTOMER_DELETED'
      );
    }

    return customer as Stripe.Customer;
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      throw new StripeCustomerError(
        `Failed to retrieve customer: ${error.message}`,
        error.type || 'STRIPE_ERROR',
        error
      );
    }

    throw error;
  }
}

/**
 * Updates a Stripe customer's information
 *
 * @param customerId - Stripe customer ID
 * @param updates - Fields to update
 * @returns Updated Stripe.Customer object
 *
 * @example
 * ```typescript
 * const updated = await updateStripeCustomer('cus_123', {
 *   email: 'newemail@example.com',
 *   name: 'New Name',
 * });
 * ```
 */
export async function updateStripeCustomer(
  customerId: string,
  updates: Stripe.CustomerUpdateParams
): Promise<Stripe.Customer> {
  try {
    const customer = await stripe.customers.update(customerId, updates);
    return customer;
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      throw new StripeCustomerError(
        `Failed to update customer: ${error.message}`,
        error.type || 'STRIPE_ERROR',
        error
      );
    }

    throw error;
  }
}

/**
 * Retrieves a Stripe customer for a given user ID
 *
 * @param userId - User ID from auth.users table
 * @returns Stripe.Customer object or null if not found
 * @throws StripeCustomerError on errors other than customer not found
 *
 * @example
 * ```typescript
 * const customer = await getStripeCustomerByUserId(user.id);
 * if (customer) {
 *   console.log(`Customer ID: ${customer.id}`);
 * }
 * ```
 */
export async function getStripeCustomerByUserId(
  userId: string
): Promise<Stripe.Customer | null> {
  try {
    const supabase = await createServerClient();

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new StripeCustomerError(
        'User profile not found',
        'PROFILE_NOT_FOUND',
        profileError
      );
    }

    // Return null if no customer ID is set
    if (!profile.stripe_customer_id) {
      return null;
    }

    // Retrieve customer from Stripe
    return await getStripeCustomer(profile.stripe_customer_id);
  } catch (error) {
    if (error instanceof StripeCustomerError) {
      throw error;
    }

    throw new StripeCustomerError(
      'Failed to retrieve customer by user ID',
      'UNKNOWN_ERROR',
      error
    );
  }
}

/**
 * Deletes a Stripe customer (marks as deleted)
 *
 * IMPORTANT: This only marks the customer as deleted in Stripe.
 * The profile's stripe_customer_id should be cleared separately
 * if needed.
 *
 * @param customerId - Stripe customer ID
 * @returns Confirmation object
 *
 * @example
 * ```typescript
 * const result = await deleteStripeCustomer('cus_123');
 * console.log(`Deleted: ${result.deleted}`); // true
 * ```
 */
export async function deleteStripeCustomer(
  customerId: string
): Promise<Stripe.DeletedCustomer> {
  try {
    const deleted = await stripe.customers.del(customerId);
    return deleted;
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      throw new StripeCustomerError(
        `Failed to delete customer: ${error.message}`,
        error.type || 'STRIPE_ERROR',
        error
      );
    }

    throw error;
  }
}

/**
 * Lists all payment methods for a customer
 *
 * @param customerId - Stripe customer ID
 * @param type - Payment method type (default: 'card')
 * @returns Array of payment methods
 *
 * @example
 * ```typescript
 * const paymentMethods = await listCustomerPaymentMethods('cus_123');
 * for (const pm of paymentMethods) {
 *   console.log(`Card: ${pm.card?.last4}`);
 * }
 * ```
 */
export async function listCustomerPaymentMethods(
  customerId: string,
  type: 'card' | 'us_bank_account' = 'card'
): Promise<Stripe.PaymentMethod[]> {
  try {
    const paymentMethods = await stripe.customers.listPaymentMethods(
      customerId,
      { type }
    );
    return paymentMethods.data;
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      throw new StripeCustomerError(
        `Failed to list payment methods: ${error.message}`,
        error.type || 'STRIPE_ERROR',
        error
      );
    }

    throw error;
  }
}

/**
 * Export the Stripe client for advanced usage
 *
 * IMPORTANT: Only use this in server-side contexts.
 * Never expose Stripe operations to the client.
 */
export { stripe };
