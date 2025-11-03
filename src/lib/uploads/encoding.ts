/**
 * Base62 encoding utilities for generating short IDs
 *
 * Base62 uses: 0-9, a-z, A-Z (62 characters)
 * This provides shorter URLs than base10 while being URL-safe
 */

const BASE62_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const BASE = 62

/**
 * Encode a number to base62 string
 * @param num - Number to encode
 * @returns Base62 encoded string
 *
 * @example
 * encodeBase62(1000) // Returns "g8"
 * encodeBase62(1000000) // Returns "4c92"
 */
export function encodeBase62(num: number): string {
  if (num === 0) return BASE62_ALPHABET[0]

  let encoded = ''
  let remaining = num

  while (remaining > 0) {
    const remainder = remaining % BASE
    encoded = BASE62_ALPHABET[remainder] + encoded
    remaining = Math.floor(remaining / BASE)
  }

  return encoded
}

/**
 * Decode a base62 string to number
 * @param str - Base62 string to decode
 * @returns Decoded number
 *
 * @example
 * decodeBase62("g8") // Returns 1000
 * decodeBase62("4c92") // Returns 1000000
 */
export function decodeBase62(str: string): number {
  let decoded = 0

  for (let i = 0; i < str.length; i++) {
    const char = str[i]
    const index = BASE62_ALPHABET.indexOf(char)

    if (index === -1) {
      throw new Error(`Invalid base62 character: ${char}`)
    }

    decoded = decoded * BASE + index
  }

  return decoded
}

/**
 * Generate a short ID from a timestamp and optional random component
 * @param timestamp - Unix timestamp in milliseconds
 * @param randomSuffix - Optional random number for collision avoidance
 * @returns Short ID string
 *
 * @example
 * generateShortId(Date.now()) // Returns something like "2rF3mK"
 */
export function generateShortId(timestamp: number = Date.now(), randomSuffix?: number): string {
  const baseId = encodeBase62(timestamp)

  if (randomSuffix !== undefined) {
    const suffix = encodeBase62(randomSuffix)
    return `${baseId}${suffix}`
  }

  return baseId
}
