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

/**
 * GET - List all events
 *
 * Public endpoint - no authentication required
 * Returns basic event information for gallery filtering
 */
async function handleGetEvents(request) {
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
