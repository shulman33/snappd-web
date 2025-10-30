/**
 * Short ID generation for public screenshot URLs
 * Uses nanoid with collision retry logic
 */

import { nanoid } from 'nanoid';

/**
 * Short ID length (6 characters)
 * Provides ~56 billion unique combinations (62^6)
 */
const SHORT_ID_LENGTH = 6;

/**
 * Maximum retry attempts for collision handling
 */
const MAX_RETRIES = 3;

/**
 * Generate a unique short ID with collision retry
 * 
 * @param checkExists - Async function to check if ID already exists
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Unique 6-character short ID
 * @throws Error if max retries exceeded
 * 
 * @example
 * const shortId = await generateUniqueShortId(async (id) => {
 *   const { data } = await supabase
 *     .from('screenshots')
 *     .select('id')
 *     .eq('short_id', id)
 *     .single();
 *   return data !== null;
 * });
 */
export const generateUniqueShortId = async (
  checkExists: (id: string) => Promise<boolean>,
  maxRetries = MAX_RETRIES
): Promise<string> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const id = nanoid(SHORT_ID_LENGTH);
    
    // Check if ID already exists in database
    const exists = await checkExists(id);
    
    if (!exists) {
      return id;
    }
    
    // Log collision (rare but should be monitored)
    console.warn(`Short ID collision detected: ${id} (attempt ${attempt + 1}/${maxRetries})`);
  }
  
  // Extremely rare case - all retries exhausted
  throw new Error('Failed to generate unique short ID after max retries');
};

/**
 * Validate short ID format
 * 
 * @param id - Short ID to validate
 * @returns true if valid format, false otherwise
 */
export const isValidShortId = (id: string): boolean => {
  return /^[A-Za-z0-9_-]{6}$/.test(id);
};

