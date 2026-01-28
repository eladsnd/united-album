/**
 * Super Admin Setup API Route
 *
 * One-time setup route to create the first super admin user.
 * Should be disabled after first super admin is created for security.
 *
 * Endpoints:
 * - POST /api/super-admin/setup - Create first super admin
 *
 * Security:
 * - Only works if no super admin exists
 * - Requires SETUP_SECRET from environment for additional protection
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { AuthService } from '@/lib/services/AuthService';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { ValidationError, ForbiddenError } from '@/lib/api/errors';

/**
 * POST /api/super-admin/setup
 *
 * Create the first super admin user
 *
 * Request body:
 * {
 *   email: "admin@example.com",
 *   password: "securePassword123",
 *   name: "Super Admin",
 *   setupSecret: "secret-from-env"  // Optional additional protection
 * }
 *
 * Response (success):
 * {
 *   success: true,
 *   message: "Super admin created successfully",
 *   token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   user: {
 *     id: "clx...",
 *     email: "admin@example.com",
 *     role: "SUPER_ADMIN",
 *     name: "Super Admin"
 *   }
 * }
 *
 * Response (error - super admin exists):
 * {
 *   success: false,
 *   error: "Super admin already exists. This setup route is disabled."
 * }
 */
async function handleSetup(request) {
  const body = await request.json();
  const { email, password, name, setupSecret } = body;

  // Validate input
  if (!email || !password) {
    throw new ValidationError('Email and password are required');
  }

  // Optional: Check setup secret for additional protection
  const expectedSetupSecret = process.env.SETUP_SECRET;
  if (expectedSetupSecret && setupSecret !== expectedSetupSecret) {
    console.log('[Setup] Invalid setup secret provided');
    throw new ForbiddenError('Invalid setup secret');
  }

  // Check if super admin already exists
  const userRepo = new UserRepository();
  const existingSuperAdmins = await userRepo.getAllUsers({ role: 'SUPER_ADMIN' });

  if (existingSuperAdmins.length > 0) {
    console.log('[Setup] Setup blocked: Super admin already exists');
    throw new ForbiddenError('Super admin already exists. This setup route is disabled.');
  }

  console.log('[Setup] Creating first super admin...');

  // Create super admin
  const authService = new AuthService();
  try {
    const { token, user } = await authService.createUser(
      email,
      password,
      'SUPER_ADMIN',
      name || 'Super Admin'
    );

    console.log(`[Setup] Super admin created successfully: ${user.email}`);

    return NextResponse.json({
      success: true,
      message: 'Super admin created successfully',
      token,
      user,
    });
  } catch (error) {
    if (error.message.includes('Email already exists')) {
      throw new ValidationError('Email already exists');
    }

    throw error;
  }
}

// Apply decorators (no authentication required for setup)
export const POST = withApi(handleSetup);
