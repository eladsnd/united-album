/**
 * Public Events API Route
 *
 * Provides read-only access to event list for gallery filtering.
 * No authentication required.
 *
 * Pattern: Decorator pattern for cross-cutting concerns
 * Service: EventRepository for data access
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { EventRepository } from '@/lib/repositories/EventRepository';
import { prisma } from '@/lib/prisma';

/**
 * GET - List all events or get event by slug
 *
 * Public endpoint - no authentication required
 * Returns basic event information for gallery filtering
 *
 * Query params:
 * - slug: Optional - Get specific event by slug
 */
async function handleGetEvents(request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  // Get specific event by slug (for EventContext auto-detection)
  if (slug) {
    const event = await prisma.event.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        eventType: true,
        startTime: true,
        endTime: true,
        color: true,
        coverImage: true,
        isActive: true,
      },
    });

    if (!event) {
      return NextResponse.json(
        {
          success: false,
          error: `Event not found: ${slug}`,
        },
        { status: 404 }
      );
    }

    console.log(`[Events] Found event by slug: ${slug} → ${event.name} (${event.id})`);

    return NextResponse.json({
      success: true,
      event,
    });
  }

  // List all events with photo counts
  const eventRepo = new EventRepository();
  const events = await eventRepo.findAllWithPhotoCounts();

  // Return only necessary fields for public consumption
  const publicEvents = events.map(event => ({
    id: event.id,
    name: event.name,
    description: event.description,
    startTime: event.startTime,
    endTime: event.endTime,
    color: event.color,
    photoCount: event.photoCount,
  }));

  return NextResponse.json({
    success: true,
    data: publicEvents,
  });
}

/**
 * GET /api/events
 *
 * List all events with photo counts (public endpoint)
 *
 * Used by gallery for event filtering
 *
 * Response:
 * {
 *   success: true,
 *   data: [{
 *     id, name, description, startTime, endTime, color, photoCount
 *   }, ...]
 * }
 */
export const GET = withApi(handleGetEvents);
