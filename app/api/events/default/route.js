/**
 * Default Event API Route
 *
 * Returns the default/main event for the application.
 * Used as fallback when no specific event is selected.
 *
 * Endpoints:
 * - GET /api/events/default - Get default event
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/events/default
 *
 * Get the default event (usually "Main Event" created during migration)
 *
 * Response (success):
 * {
 *   success: true,
 *   event: {
 *     id: "default-event",
 *     name: "Main Event",
 *     slug: "main-event",
 *     eventType: "wedding",
 *     startTime: "...",
 *     endTime: "...",
 *     color: "#3B82F6",
 *     isActive: true
 *   }
 * }
 *
 * Response (no default):
 * {
 *   success: false,
 *   error: "No default event found"
 * }
 */
async function handleGetDefaultEvent(request) {
  // Try to find event with ID "default-event" (created by migration)
  let defaultEvent = await prisma.event.findUnique({
    where: { id: 'default-event' },
    select: {
      id: true,
      name: true,
      slug: true,
      eventType: true,
      startTime: true,
      endTime: true,
      color: true,
      isActive: true,
      coverImage: true,
    },
  });

  // Fallback: Find first active event
  if (!defaultEvent) {
    console.log('[DefaultEvent] No default-event found, using first active event');
    defaultEvent = await prisma.event.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        eventType: true,
        startTime: true,
        endTime: true,
        color: true,
        isActive: true,
        coverImage: true,
      },
    });
  }

  if (!defaultEvent) {
    console.warn('[DefaultEvent] No events found in database');
    return NextResponse.json(
      {
        success: false,
        error: 'No default event found',
      },
      { status: 404 }
    );
  }

  console.log(`[DefaultEvent] Returning default event: ${defaultEvent.name} (${defaultEvent.id})`);

  return NextResponse.json({
    success: true,
    event: defaultEvent,
  });
}

// No authentication required - default event is public
export const GET = withApi(handleGetDefaultEvent);
