/**
 * File hashing utilities using Web Crypto API
 * Provides SHA-256 hashing for file deduplication and integrity checks
 */

/**
 * Calculate SHA-256 hash of a file
 * @param file - File or Blob to hash
 * @returns Hex-encoded hash string
 *
 * @example
 * const file = new File(['content'], 'test.txt')
 * const hash = await generateFileHash(file)
 * console.log(hash) // "ed7002b439e9ac845f22357d822bac1444730fbdb6016d3ec9432297b9ec9f73"
 */
export async function generateFileHash(file: File | Blob): Promise<string> {
  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer()

  // Calculate SHA-256 hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('')

  return hashHex
}

/**
 * Hash a string using SHA-256
 * @param input - String to hash
 * @returns Hex-encoded hash string
 *
 * @example
 * const hash = await hashString('password123')
 * console.log(hash) // "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f"
 */
export async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)

  const hashBuffer = await crypto.subtle.digest('SHA-256', data)

  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('')

  return hashHex
}

/**
 * Hash an IP address with a salt for privacy compliance (GDPR)
 * @param ipAddress - IP address to hash
 * @param salt - Salt value for hashing
 * @returns Hex-encoded hash string
 *
 * @example
 * const hashedIp = await hashIpAddress('192.168.1.1', 'my-secret-salt')
 */
export async function hashIpAddress(ipAddress: string, salt: string): Promise<string> {
  const combined = `${ipAddress}:${salt}`
  return hashString(combined)
}

/**
 * Verify a file matches a given hash
 * @param file - File to verify
 * @param expectedHash - Expected hash value
 * @returns True if hash matches, false otherwise
 *
 * @example
 * const file = new File(['content'], 'test.txt')
 * const hash = await generateFileHash(file)
 * const isValid = await verifyFileHash(file, hash) // true
 */
export async function verifyFileHash(file: File | Blob, expectedHash: string): Promise<boolean> {
  const actualHash = await generateFileHash(file)
  return actualHash === expectedHash
}
