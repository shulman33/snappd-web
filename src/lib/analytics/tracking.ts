/**
 * Analytics tracking utilities for screenshot views
 * Implements IP hashing for privacy compliance (GDPR/CCPA)
 */

/**
 * Hash an IP address using SHA-256 with a salt for privacy
 * Uses Web Crypto API for secure hashing
 *
 * @param ipAddress - The IP address to hash
 * @param salt - Optional salt value (defaults to env variable)
 * @returns Hexadecimal string of the SHA-256 hash
 */
export async function hashIP(
  ipAddress: string,
  salt?: string
): Promise<string> {
  // Use environment salt or fallback
  const hashSalt = salt || process.env.IP_HASH_SALT || 'default-salt-change-me';

  // Combine IP with salt
  const dataToHash = `${ipAddress}:${hashSalt}`;

  // Convert string to Uint8Array
  const encoder = new TextEncoder();
  const data = encoder.encode(dataToHash);

  // Hash using SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // Convert ArrayBuffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return hashHex;
}

/**
 * Hash user agent string for bot detection
 *
 * @param userAgent - The user agent string
 * @returns Hexadecimal string of the SHA-256 hash
 */
export async function hashUserAgent(userAgent: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(userAgent);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return hashHex;
}

/**
 * Extract IP address from Next.js request headers
 * Checks x-forwarded-for (from proxies/load balancers) and x-real-ip headers
 *
 * @param headers - Next.js Headers object or NextRequest
 * @returns IP address string or 'unknown' if not found
 */
export function getClientIP(headers: Headers): string {
  // Try x-forwarded-for first (comma-separated list, first is client IP)
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    return ips[0];
  }

  // Try x-real-ip
  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback
  return 'unknown';
}

/**
 * Detect if the user agent is a known bot/crawler
 *
 * @param userAgent - The user agent string
 * @returns true if bot detected, false otherwise
 */
export function isBot(userAgent: string | null): boolean {
  if (!userAgent) return false;

  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /googlebot/i,
    /bingbot/i,
    /yandex/i,
    /baiduspider/i,
    /facebookexternalhit/i,
    /twitterbot/i,
    /linkedinbot/i,
    /slackbot/i,
    /discordbot/i,
    /telegrambot/i,
    /whatsapp/i,
    /curl/i,
    /wget/i,
    /python-requests/i,
    /axios/i,
  ];

  return botPatterns.some(pattern => pattern.test(userAgent));
}

/**
 * Get country code from IP address using Vercel Edge geolocation
 * Note: This requires running in Vercel Edge runtime
 *
 * @param request - NextRequest object with geo data
 * @returns Two-letter country code or null if not available
 */
export function getCountryFromRequest(request: any): string | null {
  // Vercel Edge runtime adds geo data to request
  // https://vercel.com/docs/edge-network/headers#x-vercel-ip-country

  // Try Vercel's geolocation header
  const country = request.headers?.get?.('x-vercel-ip-country');
  if (country && country !== 'unknown') {
    return country.toUpperCase();
  }

  // Try alternative geolocation headers (Cloudflare, AWS, etc.)
  const cfCountry = request.headers?.get?.('cf-ipcountry');
  if (cfCountry && cfCountry !== 'XX') {
    return cfCountry.toUpperCase();
  }

  return null;
}
