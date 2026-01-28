/**
 * Authentication Login API Route
 *
 * Handles user authentication with email and password.
 * Returns JWT token on successful login.
 *
 * Endpoints:
 * - POST /api/auth/login - Authenticate user
 *
 * Pattern: Decorator pattern with withApi
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { AuthService } from '@/lib/services/AuthService';
import { ValidationError, UnauthorizedError } from '@/lib/api/errors';

/**
 * POST /api/auth/login
 *
 * Authenticate user with email and password
 *
 * Request body:
 * {
 *   email: "admin@example.com",
 *   password: "securePassword123"
 * }
 *
 * Response (success):
 * {
 *   success: true,
 *   token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   user: {
 *     id: "clx...",
 *     email: "admin@example.com",
 *     role: "SUPER_ADMIN",
 *     name: "Admin User"
 *   }
 * }
 *
 * Response (error):
 * {
 *   success: false,
 *   error: "Invalid credentials"
 * }
 */
async function handleLogin(request) {
  const body = await request.json();
  const { email, password } = body;

  // Validate input
  if (!email || !password) {
    throw new ValidationError('Email and password are required');
  }

  // Authenticate
  const authService = new AuthService();
  try {
    const { token, user } = await authService.login(email, password);

    return NextResponse.json({
      success: true,
      token,
      user,
    });
  } catch (error) {
    // Login failed - invalid credentials
    if (error.message.includes('Invalid credentials')) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Other errors
    throw error;
  }
}

// Apply decorators (no rate limiting for login - handled by fail2ban in production)
export const POST = withApi(handleLogin);
