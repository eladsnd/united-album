/**
 * Admin Authentication Utilities
 *
 * Provides server-side authentication for admin operations using
 * environment variable-based password and session tokens.
 */

import crypto from 'crypto';

// Token expiry time in milliseconds (24 hours)
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Secret key for token generation (derived from admin password)
const getTokenSecret = () => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD environment variable is not set');
  }
  // Create a stable secret from the password for token generation
  return crypto.createHash('sha256').update(adminPassword).digest('hex');
};

/**
 * Verify admin password against environment variable
 *
 * @param {string} password - Password to verify
 * @returns {boolean} - True if password matches
 */
export function verifyAdminPassword(password) {
  if (!password || typeof password !== 'string') {
    return false;
  }

  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error('ADMIN_PASSWORD environment variable is not set');
    return false;
  }

  // Use timing-safe comparison to prevent timing attacks
  const passwordBuffer = Buffer.from(password);
  const adminPasswordBuffer = Buffer.from(adminPassword);

  // Ensure buffers are the same length before comparison
  if (passwordBuffer.length !== adminPasswordBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(passwordBuffer, adminPasswordBuffer);
}

/**
 * Generate admin session token
 *
 * Token format: `${hash}_${timestamp}`
 * Hash is created from secret + timestamp for validation
 *
 * @returns {string} - Admin session token
 */
export function generateAdminToken() {
  const timestamp = Date.now();
  const secret = getTokenSecret();

  // Create hash from secret + timestamp
  const hash = crypto
    .createHmac('sha256', secret)
    .update(timestamp.toString())
    .digest('hex');

  return `${hash}_${timestamp}`;
}

/**
 * Verify admin session token
 *
 * Validates token structure, hash integrity, and expiry time
 *
 * @param {string} token - Token to verify
 * @returns {boolean} - True if token is valid and not expired
 */
export function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') {
    return false;
  }

  try {
    // Parse token format: hash_timestamp
    const parts = token.split('_');
    if (parts.length !== 2) {
      return false;
    }

    const [providedHash, timestampStr] = parts;
    const timestamp = parseInt(timestampStr, 10);

    // Validate timestamp is a valid number
    if (isNaN(timestamp)) {
      return false;
    }

    // Check if token has expired (24 hours)
    const now = Date.now();
    const age = now - timestamp;

    if (age > TOKEN_EXPIRY_MS || age < 0) {
      return false;
    }

    // Verify hash integrity
    const secret = getTokenSecret();
    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(timestampStr)
      .digest('hex');

    // Use timing-safe comparison
    const providedHashBuffer = Buffer.from(providedHash);
    const expectedHashBuffer = Buffer.from(expectedHash);

    if (providedHashBuffer.length !== expectedHashBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(providedHashBuffer, expectedHashBuffer);
  } catch (error) {
    console.error('Error verifying admin token:', error);
    return false;
  }
}

/**
 * Get token expiry time in milliseconds
 *
 * @returns {number} - Token expiry time in milliseconds
 */
export function getTokenExpiryMs() {
  return TOKEN_EXPIRY_MS;
}

/**
 * Extract admin middleware for API routes
 *
 * Use this in API routes to require admin authentication
 *
 * @param {Request} request - Next.js request object
 * @returns {boolean} - True if authenticated
 */
export function isAdminAuthenticated(request) {
  // Check Authorization header
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  return verifyAdminToken(token);
}
