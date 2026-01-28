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
import { AuthService } from '@/lib/services/AuthService';

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
 *   // Event admin user (required for new events)
 *   admin: {
 *     email: "admin@example.com",
 *     password: "password123",       // Min 8 characters
 *     name: "John Smith"             // Optional
 *   },
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
    admin,
    features = {},
  } = body;

  // Validate required fields
  if (!name) {
    throw new ValidationError('Event name is required');
  }

  if (!startTime || !endTime) {
    throw new ValidationError('Start time and end time are required');
  }

  if (!admin || !admin.email || !admin.password) {
    throw new ValidationError('Admin user email and password are required');
  }

  // Auto-generate slug from name if not provided
  const eventSlug = slug || name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Validate slug is not empty
  if (!eventSlug || eventSlug.length === 0) {
    throw new ValidationError('Event name must contain at least one alphanumeric character');
  }

  // Validate slug length
  if (eventSlug.length < 3) {
    throw new ValidationError('Event slug must be at least 3 characters long');
  }

  if (eventSlug.length > 100) {
    throw new ValidationError('Event slug must be less than 100 characters');
  }

  // Validate admin password length
  if (!admin.password || admin.password.length < 8) {
    throw new ValidationError('Admin password must be at least 8 characters');
  }

  // Validate event times
  if (new Date(endTime) <= new Date(startTime)) {
    throw new ValidationError('End time must be after start time');
  }

  console.log(`[SuperAdmin] Creating event: ${name} (${eventSlug})`);

  try {
    // Use transaction to ensure atomicity - all operations succeed or all fail
    const result = await prisma.$transaction(async (tx) => {
      // Check if slug already exists (prevent race condition)
      const existingEvent = await tx.event.findUnique({
        where: { slug: eventSlug },
      });

      if (existingEvent) {
        throw new ValidationError(`Event slug already exists: ${eventSlug}`);
      }

      // Check if admin email already exists
      const existingUser = await tx.user.findUnique({
        where: { email: admin.email },
      });

      if (existingUser) {
        throw new ValidationError(`Admin email already exists: ${admin.email}`);
      }

      // Create event
      const event = await tx.event.create({
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

      console.log(`[SuperAdmin] Event created in transaction: ${event.id}`);

      // Create EventSettings with feature flags
      const eventSettings = await tx.eventSettings.create({
        data: {
          eventId: event.id,
          gamification: features.gamification ?? false,
          events: features.events ?? false,
          faceDetection: features.faceDetection ?? false,
          photoLikes: features.photoLikes ?? false,
          bulkUpload: features.bulkUpload ?? false,
          challenges: features.challenges ?? false,
        },
      });

      console.log(`[SuperAdmin] EventSettings created for event ${event.id}`);

      // Create admin user with password hashing
      const { hashPassword } = await import('@/lib/auth/passwordHash');
      const passwordHash = await hashPassword(admin.password);

      const user = await tx.user.create({
        data: {
          email: admin.email,
          passwordHash,
          role: 'EVENT_ADMIN',
          name: admin.name || null,
        },
      });

      console.log(`[SuperAdmin] Admin user created in transaction: ${user.id} (${user.email})`);

      // Assign admin to event
      const eventAdmin = await tx.eventAdmin.create({
        data: {
          userId: user.id,
          eventId: event.id,
          role: 'admin',
        },
      });

      console.log(`[SuperAdmin] Admin ${user.id} assigned to event ${event.id}`);

      // Return all created data
      return {
        event,
        settings: eventSettings,
        admin: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        eventAdmin,
      };
    });

    console.log(`[SuperAdmin] Transaction completed successfully for event: ${result.event.slug}`);

    return NextResponse.json({
      success: true,
      message: 'Event and admin user created successfully',
      event: result.event,
      admin: result.admin,
      settings: result.settings,
    });
  } catch (error) {
    console.error(`[SuperAdmin] Event creation failed:`, error);

    // Handle Prisma unique constraint violations
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'field';
      if (field === 'slug') {
        throw new ValidationError(`Event slug already exists: ${eventSlug}`);
      } else if (field === 'email') {
        throw new ValidationError(`Admin email already exists: ${admin.email}`);
      }
      throw new ValidationError(`Duplicate ${field}`);
    }

    // Re-throw ValidationErrors as-is
    if (error instanceof ValidationError) {
      throw error;
    }

    // Wrap other errors
    throw new Error(`Failed to create event: ${error.message}`);
  }
}

// Apply decorators - super admin only
export const GET = withApi(handleGetEvents, { adminOnly: true });
export const POST = withApi(handleCreateEvent, { adminOnly: true });
