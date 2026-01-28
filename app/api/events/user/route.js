/**
 * User Events API Route
 *
 * Get events for the authenticated user.
 * - Super admin: All events
 * - Event admin: Only assigned events
 * - Guest: Empty list
 *
 * Endpoints:
 * - GET /api/events/user - Get events for authenticated user
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { getUserFromRequest } from '@/lib/auth/sessionManager';
import { getUserEvents, isSuperAdmin, isEventAdmin } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';
import { UnauthorizedError } from '@/lib/api/errors';

/**
 * GET /api/events/user
 *
 * Get events accessible by the authenticated user
 *
 * Authentication required via Bearer token
 *
 * Response (super admin):
 * {
 *   success: true,
 *   events: [...all active events...],
 *   role: "SUPER_ADMIN"
 * }
 *
 * Response (event admin):
 * {
 *   success: true,
 *   events: [...assigned events...],
 *   role: "EVENT_ADMIN"
 * }
 *
 * Response (guest):
 * {
 *   success: true,
 *   events: [],
 *   role: "GUEST"
 * }
 */
async function handleGetUserEvents(request) {
  // Get authenticated user from JWT
  const user = getUserFromRequest(request);

  if (!user) {
    throw new UnauthorizedError('Authentication required');
  }

  console.log(`[UserEvents] Getting events for user: ${user.email} (${user.role})`);

  // Get user's accessible events based on role
  const events = await getUserEvents(user, prisma);

  console.log(`[UserEvents] User ${user.email} has access to ${events.length} events`);

  return NextResponse.json({
    success: true,
    events,
    role: user.role,
  });
}

// No adminOnly decorator - any authenticated user can call this
// But guests will get empty array
export const GET = withApi(handleGetUserEvents);
