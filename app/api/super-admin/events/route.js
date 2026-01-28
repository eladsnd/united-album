/**
 * Super Admin Events API Route
 *
 * Manages event creation, listing, and management.
 * Super admin only - can create events and manage all events.
 *
 * Endpoints:
 * - GET /api/super-admin/events - List all events (active + archived)
 * - POST /api/super-admin/events - Create new event
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { ValidationError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';
import { EventSettingsRepository } from '@/lib/repositories/EventSettingsRepository';

/**
 * GET /api/super-admin/events
 *
 * List all events with stats (super admin only)
 *
 * Query params:
 * - includeArchived: Optional - Include archived events (default: false)
 *
 * Response:
 * {
 *   success: true,
 *   events: [{
 *     id, name, slug, eventType, startTime, endTime,
 *     color, coverImage, isActive, isArchived,
 *     photoCount, adminCount,
 *     createdAt, updatedAt
 *   }, ...]
 * }
 */
async function handleGetEvents(request) {
  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get('includeArchived') === 'true';

  const where = includeArchived ? {} : { isArchived: false };

  const events = await prisma.event.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          photos: true,
          admins: true,
        },
      },
    },
  });

  const eventsWithStats = events.map(event => ({
    id: event.id,
    name: event.name,
    slug: event.slug,
    description: event.description,
    eventType: event.eventType,
    startTime: event.startTime,
    endTime: event.endTime,
    color: event.color,
    coverImage: event.coverImage,
    isActive: event.isActive,
    isArchived: event.isArchived,
    order: event.order,
    photoCount: event._count.photos,
    adminCount: event._count.admins,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  }));

  console.log(`[SuperAdmin] Listed ${eventsWithStats.length} events`);

  return NextResponse.json({
    success: true,
    events: eventsWithStats,
  });
}

/**
 * POST /api/super-admin/events
 *
 * Create a new event (super admin only)
 *
 * Request body:
 * {
 *   name: "Sarah & John's Wedding",
 *   slug: "sarah-john-wedding",      // Optional - auto-generated from name
 *   description: "...",               // Optional
 *   eventType: "wedding",             // Optional - defaults to "wedding"
 *   startTime: "2026-06-15T10:00:00Z",
 *   endTime: "2026-06-15T23:00:00Z",
 *   color: "#3B82F6",                 // Optional - defaults to blue
 *   coverImage: "https://...",        // Optional
 *
 *   // Feature flags (optional - defaults to all false)
 *   features: {
 *     gamification: true,
 *     challenges: true,
 *     faceDetection: false,
 *     photoLikes: true,
 *     bulkUpload: false,
 *     events: false
 *   }
 * }
 *
 * Response:
 * {
 *   success: true,
 *   message: "Event created successfully",
 *   event: { ... },
 *   settings: { ... feature flags ... }
 * }
 */
async function handleCreateEvent(request) {
  const body = await request.json();
  const {
    name,
    slug,
    description,
    eventType = 'wedding',
    startTime,
    endTime,
    color = '#3B82F6',
    coverImage,
    features = {},
  } = body;

  // Validate required fields
  if (!name) {
    throw new ValidationError('Event name is required');
  }

  if (!startTime || !endTime) {
    throw new ValidationError('Start time and end time are required');
  }

  // Auto-generate slug from name if not provided
  const eventSlug = slug || name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  console.log(`[SuperAdmin] Creating event: ${name} (${eventSlug})`);

  try {
    // Create event
    const event = await prisma.event.create({
      data: {
        name,
        slug: eventSlug,
        description: description || null,
        eventType,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        color,
        coverImage: coverImage || null,
        isActive: true,
        isArchived: false,
        order: 0,
      },
    });

    console.log(`[SuperAdmin] Event created: ${event.id}`);

    // Create EventSettings with feature flags
    const settingsRepo = new EventSettingsRepository();
    const settings = await settingsRepo.createDefaultSettings(event.id);

    // Apply custom feature flags if provided
    if (Object.keys(features).length > 0) {
      await settingsRepo.updateSettings(event.id, features);
      console.log(`[SuperAdmin] Feature flags configured for event ${event.id}:`, features);
    }

    return NextResponse.json({
      success: true,
      message: 'Event created successfully',
      event,
      settings: await settingsRepo.getByEventId(event.id),
    });
  } catch (error) {
    // Handle unique constraint violations
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'slug';
      throw new ValidationError(`Event ${field} already exists: ${eventSlug}`);
    }

    throw error;
  }
}

// Apply decorators - super admin only
export const GET = withApi(handleGetEvents, { adminOnly: true });
export const POST = withApi(handleCreateEvent, { adminOnly: true });
