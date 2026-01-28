/**
 * Super Admin Event Management API Route
 *
 * Manage individual events - update, archive, delete.
 * Super admin only.
 *
 * Endpoints:
 * - GET /api/super-admin/events/[eventId] - Get event details with stats
 * - PUT /api/super-admin/events/[eventId] - Update event
 * - DELETE /api/super-admin/events/[eventId] - Archive event (soft delete)
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { ValidationError, NotFoundError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/super-admin/events/[eventId]
 *
 * Get detailed event information with stats
 *
 * Response:
 * {
 *   success: true,
 *   event: {
 *     ... event fields ...,
 *     photoCount, adminCount,
 *     admins: [{ user: { id, email, name, role } }],
 *     settings: { ... feature flags ... }
 *   }
 * }
 */
async function handleGetEvent(request, context) {
  const { eventId } = await context.params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      admins: {
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
      },
      settings: true,
      _count: {
        select: {
          photos: true,
          admins: true,
        },
      },
    },
  });

  if (!event) {
    throw new NotFoundError(`Event not found: ${eventId}`);
  }

  const eventWithStats = {
    ...event,
    photoCount: event._count.photos,
    adminCount: event._count.admins,
  };
  delete eventWithStats._count;

  return NextResponse.json({
    success: true,
    event: eventWithStats,
  });
}

/**
 * PUT /api/super-admin/events/[eventId]
 *
 * Update event details
 *
 * Request body (all fields optional):
 * {
 *   name: "...",
 *   slug: "...",
 *   description: "...",
 *   eventType: "...",
 *   startTime: "...",
 *   endTime: "...",
 *   color: "...",
 *   coverImage: "...",
 *   isActive: true/false,
 *   isArchived: true/false,
 *   order: 0
 * }
 *
 * Response:
 * {
 *   success: true,
 *   message: "Event updated successfully",
 *   event: { ... }
 * }
 */
async function handleUpdateEvent(request, context) {
  const { eventId } = await context.params;
  const updates = await request.json();

  if (!updates || typeof updates !== 'object') {
    throw new ValidationError('Updates must be an object');
  }

  // Check event exists
  const existingEvent = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!existingEvent) {
    throw new NotFoundError(`Event not found: ${eventId}`);
  }

  console.log(`[SuperAdmin] Updating event ${eventId}:`, Object.keys(updates));

  try {
    // Build update data (filter out undefined values)
    const updateData = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.slug !== undefined) updateData.slug = updates.slug;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.eventType !== undefined) updateData.eventType = updates.eventType;
    if (updates.startTime !== undefined) updateData.startTime = new Date(updates.startTime);
    if (updates.endTime !== undefined) updateData.endTime = new Date(updates.endTime);
    if (updates.color !== undefined) updateData.color = updates.color;
    if (updates.coverImage !== undefined) updateData.coverImage = updates.coverImage;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    if (updates.isArchived !== undefined) updateData.isArchived = updates.isArchived;
    if (updates.order !== undefined) updateData.order = updates.order;

    const event = await prisma.event.update({
      where: { id: eventId },
      data: updateData,
    });

    console.log(`[SuperAdmin] Event updated: ${event.name} (${event.id})`);

    return NextResponse.json({
      success: true,
      message: 'Event updated successfully',
      event,
    });
  } catch (error) {
    // Handle unique constraint violations
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'field';
      throw new ValidationError(`${field} already exists`);
    }

    throw error;
  }
}

/**
 * DELETE /api/super-admin/events/[eventId]
 *
 * Archive event (soft delete)
 * Sets isArchived=true, isActive=false
 *
 * Response:
 * {
 *   success: true,
 *   message: "Event archived successfully"
 * }
 */
async function handleArchiveEvent(request, context) {
  const { eventId } = await context.params;

  // Check event exists
  const existingEvent = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!existingEvent) {
    throw new NotFoundError(`Event not found: ${eventId}`);
  }

  console.log(`[SuperAdmin] Archiving event: ${existingEvent.name} (${eventId})`);

  // Soft delete - archive instead of hard delete
  await prisma.event.update({
    where: { id: eventId },
    data: {
      isArchived: true,
      isActive: false,
    },
  });

  return NextResponse.json({
    success: true,
    message: 'Event archived successfully',
  });
}

// Apply decorators - super admin only
export const GET = withApi(handleGetEvent, { adminOnly: true });
export const PUT = withApi(handleUpdateEvent, { adminOnly: true });
export const DELETE = withApi(handleArchiveEvent, { adminOnly: true });
