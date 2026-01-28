/**
 * Check Event Access API Route
 *
 * Verifies if the authenticated user has access to an event.
 * Used by event admin panels to check permissions.
 *
 * Endpoints:
 * - GET /api/events/{eventId}/check-access - Check if user can access event
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { getUserFromRequest } from '@/lib/auth/sessionManager';
import { canAccessEvent } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/events/{eventId}/check-access
 *
 * Check if user has access to event admin panel
 *
 * Response:
 * {
 *   success: true,
 *   hasAccess: true,
 *   role: "EVENT_ADMIN" | "SUPER_ADMIN"
 * }
 */
async function handleCheckAccess(request, { params }) {
  const { eventId } = await params;

  // Get user from JWT token
  const user = getUserFromRequest(request);

  if (!user) {
    return NextResponse.json(
      { success: false, hasAccess: false, error: 'Not authenticated' },
      { status: 401 }
    );
  }

  // Check if user can access this event
  const hasAccess = await canAccessEvent(user, eventId, prisma);

  if (!hasAccess) {
    console.log(`[CheckAccess] User ${user.userId} denied access to event ${eventId}`);
    return NextResponse.json(
      { success: false, hasAccess: false, error: 'Access denied' },
      { status: 403 }
    );
  }

  console.log(`[CheckAccess] User ${user.userId} (${user.role}) granted access to event ${eventId}`);

  return NextResponse.json({
    success: true,
    hasAccess: true,
    role: user.role,
  });
}

export const GET = withApi(handleCheckAccess);
