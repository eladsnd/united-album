/**
 * Password Hashing Utilities (Security Layer)
 *
 * Provides secure password hashing and verification using bcrypt.
 * Uses 12 rounds for strong protection against brute-force attacks.
 *
 * Pattern: Facade pattern for bcrypt
 *
 * Usage:
 * ```javascript
 * import { hashPassword, verifyPassword } from '@/lib/auth/passwordHash';
 *
 * // Registration
 * const hash = await hashPassword('userPassword123');
 * await saveUser({ email, passwordHash: hash });
 *
 * // Login
 * const isValid = await verifyPassword('userPassword123', user.passwordHash);
 * if (isValid) { // grant access }
 * ```
 */

import bcrypt from 'bcryptjs';

// Salt rounds for bcrypt (12 = strong security, ~250ms per hash)
const SALT_ROUNDS = 12;

/**
 * Hash a plain-text password using bcrypt
 *
 * @param {string} password - Plain-text password to hash
 * @returns {Promise<string>} Bcrypt hash (60 characters)
 * @throws {Error} If password is empty or hashing fails
 *
 * @example
 * const hash = await hashPassword('mySecurePassword123');
 * // Returns: $2a$12$abcdefghijklmnopqrstuvwxyz...
 */
export async function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return hash;
  } catch (error) {
    console.error('[passwordHash] Hashing failed:', error);
    throw new Error('Failed to hash password');
  }
}

/**
 * Verify a plain-text password against a bcrypt hash
 *
 * @param {string} password - Plain-text password to verify
 * @param {string} hash - Bcrypt hash to compare against
 * @returns {Promise<boolean>} True if password matches hash
 * @throws {Error} If inputs are invalid or verification fails
 *
 * @example
 * const isValid = await verifyPassword('myPassword', user.passwordHash);
 * if (isValid) {
 *   console.log('Correct password!');
 * }
 */
export async function verifyPassword(password, hash) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  if (!hash || typeof hash !== 'string') {
    throw new Error('Hash must be a non-empty string');
  }

  try {
    const isMatch = await bcrypt.compare(password, hash);
    return isMatch;
  } catch (error) {
    console.error('[passwordHash] Verification failed:', error);
    throw new Error('Failed to verify password');
  }
}
