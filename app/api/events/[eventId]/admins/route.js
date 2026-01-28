/**
 * Event Admins Management API Route
 *
 * Manage admin assignments for a specific event.
 * Super admin only.
 *
 * Endpoints:
 * - GET /api/events/[eventId]/admins - List event admins
 * - POST /api/events/[eventId]/admins - Assign user as event admin
 * - DELETE /api/events/[eventId]/admins - Remove admin from event
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { ValidationError, NotFoundError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';
import { UserRepository } from '@/lib/repositories/UserRepository';

/**
 * GET /api/events/[eventId]/admins
 *
 * List all admins for this event
 *
 * Response:
 * {
 *   success: true,
 *   admins: [{
 *     id: "ea-id",
 *     userId: "user-id",
 *     user: {
 *       id, email, name, role
 *     },
 *     role: "admin",
 *     createdAt: "..."
 *   }, ...]
 * }
 */
async function handleGetAdmins(request, context) {
  const { eventId } = await context.params;

  // Verify event exists
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true },
  });

  if (!event) {
    throw new NotFoundError(`Event not found: ${eventId}`);
  }

  const eventAdmins = await prisma.eventAdmin.findMany({
    where: { eventId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`[EventAdmins] Listed ${eventAdmins.length} admins for event ${event.name}`);

  return NextResponse.json({
    success: true,
    admins: eventAdmins,
  });
}

/**
 * POST /api/events/[eventId]/admins
 *
 * Assign a user as admin of this event
 *
 * Request body:
 * {
 *   userId: "user-id-to-assign",
 *   role: "admin"  // Optional - defaults to "admin"
 * }
 *
 * Response:
 * {
 *   success: true,
 *   message: "User assigned as event admin",
 *   eventAdmin: { ... }
 * }
 */
async function handleAssignAdmin(request, context) {
  const { eventId } = await context.params;
  const { userId, role = 'admin' } = await request.json();

  if (!userId) {
    throw new ValidationError('userId is required');
  }

  // Verify event exists
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true },
  });

  if (!event) {
    throw new NotFoundError(`Event not found: ${eventId}`);
  }

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user) {
    throw new NotFoundError(`User not found: ${userId}`);
  }

  // Only EVENT_ADMIN or SUPER_ADMIN can be assigned as event admins
  if (user.role !== 'EVENT_ADMIN' && user.role !== 'SUPER_ADMIN') {
    throw new ValidationError(
      `User role must be EVENT_ADMIN or SUPER_ADMIN. Current role: ${user.role}`
    );
  }

  console.log(`[EventAdmins] Assigning ${user.email} to event ${event.name}`);

  try {
    const userRepo = new UserRepository();
    const eventAdmin = await userRepo.assignToEvent(userId, eventId);

    console.log(`[EventAdmins] User ${user.email} assigned to event ${event.name}`);

    return NextResponse.json({
      success: true,
      message: 'User assigned as event admin',
      eventAdmin: {
        ...eventAdmin,
        user,
        event,
      },
    });
  } catch (error) {
    // Handle duplicate assignment
    if (error.code === 'P2002') {
      throw new ValidationError('User is already admin of this event');
    }

    throw error;
  }
}

/**
 * DELETE /api/events/[eventId]/admins
 *
 * Remove admin from event
 *
 * Request body:
 * {
 *   userId: "user-id-to-remove"
 * }
 *
 * Response:
 * {
 *   success: true,
 *   message: "User removed from event"
 * }
 */
async function handleRemoveAdmin(request, context) {
  const { eventId } = await context.params;
  const { userId } = await request.json();

  if (!userId) {
    throw new ValidationError('userId is required');
  }

  // Verify event exists
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true },
  });

  if (!event) {
    throw new NotFoundError(`Event not found: ${eventId}`);
  }

  // Verify user is assigned
  const eventAdmin = await prisma.eventAdmin.findUnique({
    where: {
      userId_eventId: {
        userId,
        eventId,
      },
    },
    include: {
      user: {
        select: { email: true, name: true },
      },
    },
  });

  if (!eventAdmin) {
    throw new NotFoundError('User is not admin of this event');
  }

  console.log(`[EventAdmins] Removing ${eventAdmin.user.email} from event ${event.name}`);

  await prisma.eventAdmin.delete({
    where: {
      userId_eventId: {
        userId,
        eventId,
      },
    },
  });

  console.log(`[EventAdmins] User removed from event ${event.name}`);

  return NextResponse.json({
    success: true,
    message: 'User removed from event',
  });
}

// Apply decorators - super admin only
export const GET = withApi(handleGetAdmins, { adminOnly: true });
export const POST = withApi(handleAssignAdmin, { adminOnly: true });
export const DELETE = withApi(handleRemoveAdmin, { adminOnly: true });
