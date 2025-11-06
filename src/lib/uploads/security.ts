/**
 * Security utilities for password hashing and verification
 *
 * Uses bcryptjs for secure password hashing with cost factor 10
 *
 * @module lib/uploads/security
 */

import bcrypt from 'bcryptjs';

/**
 * Cost factor for bcrypt hashing
 * 10 rounds = ~80ms hashing time (good balance of security and performance)
 */
const BCRYPT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 *
 * @param password - Plain text password to hash
 * @returns Promise resolving to bcrypt hash string
 *
 * @example
 * ```typescript
 * const hash = await hashPassword('mySecretPassword123');
 * // Returns: $2a$10$...
 * ```
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  if (password.length > 72) {
    throw new Error('Password must be 72 characters or less (bcrypt limitation)');
  }

  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a bcrypt hash
 *
 * @param password - Plain text password to verify
 * @param hash - Bcrypt hash to compare against
 * @returns Promise resolving to true if password matches, false otherwise
 *
 * @example
 * ```typescript
 * const isValid = await verifyPassword('mySecretPassword123', storedHash);
 * if (isValid) {
 *   // Password is correct
 * }
 * ```
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  if (!password || typeof password !== 'string') {
    return false;
  }

  if (!hash || typeof hash !== 'string') {
    return false;
  }

  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    // Log error but don't expose details to caller
    console.error('Password verification error:', error);
    return false;
  }
}

/**
 * Synchronous version of hashPassword (use sparingly, blocks event loop)
 *
 * @param password - Plain text password to hash
 * @returns Bcrypt hash string
 */
export function hashPasswordSync(password: string): string {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  if (password.length > 72) {
    throw new Error('Password must be 72 characters or less (bcrypt limitation)');
  }

  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

/**
 * Synchronous version of verifyPassword (use sparingly, blocks event loop)
 *
 * @param password - Plain text password to verify
 * @param hash - Bcrypt hash to compare against
 * @returns true if password matches, false otherwise
 */
export function verifyPasswordSync(password: string, hash: string): boolean {
  if (!password || typeof password !== 'string') {
    return false;
  }

  if (!hash || typeof hash !== 'string') {
    return false;
  }

  try {
    return bcrypt.compareSync(password, hash);
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

/**
 * Check if a password meets minimum security requirements
 *
 * @param password - Password to validate
 * @returns Object with isValid flag and error message if invalid
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  error?: string;
} {
  if (!password || typeof password !== 'string') {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters' };
  }

  if (password.length > 72) {
    return {
      isValid: false,
      error: 'Password must be 72 characters or less',
    };
  }

  // Optional: Add more complexity requirements here
  // (uppercase, lowercase, numbers, special chars)

  return { isValid: true };
}
