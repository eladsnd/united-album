/**
 * Admin Authentication API Route
 *
 * POST /api/admin/auth
 * Authenticates admin users and returns session token
 *
 * SECURITY: Rate limited to 5 attempts per minute to prevent brute-force attacks
 */

import { NextResponse } from 'next/server';
import {
  verifyAdminPassword,
  generateAdminToken,
  getTokenExpiryMs,
} from '@/lib/adminAuth';
import { applyRateLimit } from '@/lib/rateLimit';

/**
 * POST /api/admin/auth
 *
 * Authenticate admin user with password
 *
 * Request body:
 * {
 *   "password": "admin-password"
 * }
 *
 * Response:
 * Success (200):
 * {
 *   "success": true,
 *   "token": "admin-session-token",
 *   "expiresIn": 86400000
 * }
 *
 * Failure (401):
 * {
 *   "success": false,
 *   "error": "Invalid password"
 * }
 */
export async function POST(request) {
  try {
    // CRITICAL SECURITY: Rate limit login attempts to prevent brute-force attacks
    const rateLimitResult = applyRateLimit(request, 'auth');

    if (!rateLimitResult.allowed) {
      console.warn('[Admin Auth] Rate limit exceeded for IP:', request.headers.get('x-forwarded-for') || 'unknown');
      return rateLimitResult.response;
    }

    // Parse request body
    const body = await request.json();
    const { password } = body;

    // Validate password is provided
    if (!password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password is required',
        },
        { status: 400 }
      );
    }

    // Verify password
    const isValid = verifyAdminPassword(password);

    if (!isValid) {
      // Return 401 Unauthorized for invalid password
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid password',
        },
        { status: 401 }
      );
    }

    // Generate admin session token
    const token = generateAdminToken();
    const expiresIn = getTokenExpiryMs();

    // Return success response with token
    return NextResponse.json(
      {
        success: true,
        token,
        expiresIn,
        message: 'Authentication successful',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Admin auth error:', error);

    // Handle specific error cases
    if (error.message?.includes('ADMIN_PASSWORD')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin authentication is not configured',
        },
        { status: 500 }
      );
    }

    // Generic error response
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/auth (optional - for testing)
 *
 * Returns API status
 */
export async function GET() {
  return NextResponse.json(
    {
      success: true,
      message: 'Admin authentication endpoint',
      method: 'POST',
      endpoint: '/api/admin/auth',
    },
    { status: 200 }
  );
}
