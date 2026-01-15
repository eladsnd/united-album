import { verifyAdminToken } from '../../lib/adminAuth.js';
import { UnauthorizedError } from '../errors/app-error.js';

/**
 * Admin authentication guard
 * Verifies admin token from Authorization header
 */
export class AdminGuard {
  /**
   * Check if request has valid admin token
   * @param {Request} request - Next.js request object
   * @returns {Promise<boolean>} True if admin, throws otherwise
   */
  static async canActivate(request) {
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      throw new UnauthorizedError('Authorization header missing');
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedError('Admin token missing');
    }

    const isValid = verifyAdminToken(token);

    if (!isValid) {
      throw new UnauthorizedError('Invalid or expired admin token');
    }

    return true;
  }
}

/**
 * Helper function to use AdminGuard in API routes
 * @param {Request} request - Next.js request object
 * @returns {Promise<void>} Throws if not authorized
 */
export async function requireAdmin(request) {
  await AdminGuard.canActivate(request);
}
