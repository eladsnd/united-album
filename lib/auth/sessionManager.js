/**
 * JWT Session Manager (Authentication Layer)
 *
 * Handles JWT token generation, verification, and user extraction from requests.
 * Uses environment-based secrets and configurable expiry.
 *
 * Pattern: Facade pattern for jsonwebtoken
 *
 * Usage:
 * ```javascript
 * import { generateToken, verifyToken, getUserFromRequest } from '@/lib/auth/sessionManager';
 *
 * // Login - generate token
 * const token = generateToken(user);
 * res.json({ token });
 *
 * // Verify request
 * const user = getUserFromRequest(request);
 * if (!user) return res.status(401).json({ error: 'Unauthorized' });
 * ```
 */

import jwt from 'jsonwebtoken';

// JWT configuration from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const TOKEN_EXPIRY = process.env.JWT_EXPIRY || '7d'; // 7 days default

/**
 * Generate a JWT token for a user
 *
 * Payload includes:
 * - userId: User's unique ID
 * - email: User's email
 * - role: User's role (SUPER_ADMIN, EVENT_ADMIN, GUEST)
 *
 * @param {Object} user - User object from database
 * @param {string} user.id - User ID
 * @param {string} user.email - User email
 * @param {string} user.role - User role
 * @returns {string} JWT token
 *
 * @example
 * const token = generateToken({ id: '123', email: 'admin@example.com', role: 'SUPER_ADMIN' });
 * // Returns: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 */
export function generateToken(user) {
  if (!user || !user.id || !user.email || !user.role) {
    throw new Error('User must have id, email, and role');
  }

  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  try {
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: TOKEN_EXPIRY,
      algorithm: 'HS256',
    });

    return token;
  } catch (error) {
    console.error('[sessionManager] Token generation failed:', error);
    throw new Error('Failed to generate token');
  }
}

/**
 * Verify and decode a JWT token
 *
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded payload if valid, null if invalid/expired
 *
 * @example
 * const payload = verifyToken(token);
 * if (payload) {
 *   console.log('User ID:', payload.userId);
 * }
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    });

    return payload;
  } catch (error) {
    // Token invalid, expired, or malformed
    if (error.name === 'TokenExpiredError') {
      console.log('[sessionManager] Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      console.log('[sessionManager] Invalid token');
    } else {
      console.error('[sessionManager] Token verification failed:', error);
    }

    return null;
  }
}

/**
 * Extract and verify user from Next.js request
 *
 * Looks for Bearer token in Authorization header.
 *
 * @param {Request} request - Next.js request object
 * @returns {Object|null} Decoded user payload or null if unauthorized
 *
 * @example
 * // API route
 * export async function GET(request) {
 *   const user = getUserFromRequest(request);
 *   if (!user) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *   // User authenticated, proceed
 * }
 */
export function getUserFromRequest(request) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const payload = verifyToken(token);

    return payload;
  } catch (error) {
    console.error('[sessionManager] Failed to extract user from request:', error);
    return null;
  }
}

/**
 * Refresh a token (generate new token with same payload but new expiry)
 *
 * @param {string} token - Existing valid token
 * @returns {string|null} New token or null if old token invalid
 *
 * @example
 * const newToken = refreshToken(oldToken);
 * if (newToken) {
 *   res.json({ token: newToken });
 * }
 */
export function refreshToken(token) {
  const payload = verifyToken(token);

  if (!payload) {
    return null;
  }

  // Remove JWT standard fields (iat, exp) before regenerating
  const { iat, exp, ...userPayload } = payload;

  try {
    const newToken = jwt.sign(userPayload, JWT_SECRET, {
      expiresIn: TOKEN_EXPIRY,
      algorithm: 'HS256',
    });

    return newToken;
  } catch (error) {
    console.error('[sessionManager] Token refresh failed:', error);
    return null;
  }
}
