/**
 * Unit test for short ID generation with collision retry
 */

import { describe, it, expect } from 'vitest';
import { generateUniqueShortId, isValidShortId } from '@/lib/short-id';

describe('Short ID Generation', () => {
  it('should generate 6-character ID', async () => {
    const id = await generateUniqueShortId(async () => false);
    expect(id).toHaveLength(6);
  });

  it('should only contain URL-safe characters', async () => {
    const id = await generateUniqueShortId(async () => false);
    expect(/^[A-Za-z0-9_-]{6}$/.test(id)).toBe(true);
  });

  it('should retry on collision and succeed', async () => {
    let attempts = 0;
    const id = await generateUniqueShortId(async () => {
      attempts++;
      return attempts < 2; // First attempt collides, second succeeds
    });
    
    expect(id).toHaveLength(6);
    expect(attempts).toBe(2);
  });

  it('should throw after max retries', async () => {
    await expect(
      generateUniqueShortId(async () => true, 3) // Always collides
    ).rejects.toThrow('Failed to generate unique short ID after max retries');
  });

  it('should validate correct short ID format', () => {
    expect(isValidShortId('abc123')).toBe(true);
    expect(isValidShortId('XYZ-_0')).toBe(true);
  });

  it('should reject invalid short ID format', () => {
    expect(isValidShortId('abc')).toBe(false); // Too short
    expect(isValidShortId('abc12345')).toBe(false); // Too long
    expect(isValidShortId('abc!@#')).toBe(false); // Invalid characters
    expect(isValidShortId('abc 12')).toBe(false); // Contains space
  });
});

