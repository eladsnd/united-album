/**
 * Event Management API Route
 *
 * Provides CRUD operations for events with admin authentication.
 *
 * Pattern: Decorator pattern for cross-cutting concerns
 * Service: EventService handles business logic
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { withFeature } from '@/lib/api/featureDecorators';
import { EventService } from '@/lib/services/EventService';

/**
 * GET - List all events with photo counts
 *
 * Returns events ordered by start time with enriched metadata
 */
async function handleGetEvents(request) {
  const eventService = new EventService();
  const events = await eventService.getEventTimeline();

  return NextResponse.json({
    success: true,
    data: events,
  });
}

/**
 * POST - Create new event
 *
 * Requires admin authentication
 */
async function handleCreateEvent(request) {
  const body = await request.json();
  const { name, description, startTime, endTime, color, order } = body;

  const eventService = new EventService();
  const newEvent = await eventService.createEvent({
    name,
    description,
    startTime,
    endTime,
    color,
    order,
  });

  return NextResponse.json({
    success: true,
    data: newEvent,
    message: 'Event created successfully.',
  }, { status: 201 });
}

/**
 * GET /api/admin/events
 *
 * List all events with photo counts and device breakdown
 *
 * Response:
 * {
 *   success: true,
 *   data: [{
 *     id, name, description, startTime, endTime, color, order,
 *     photoCount, devices: [{ model, count }]
 *   }, ...]
 * }
 */
export const GET = withApi(withFeature(handleGetEvents, 'events'));

/**
 * POST /api/admin/events
 *
 * Create new event (admin only)
 *
 * Request (application/json):
 * {
 *   name: "Ceremony",
 *   description: "Wedding ceremony",
 *   startTime: "2024-06-15T14:00:00Z",
 *   endTime: "2024-06-15T15:30:00Z",
 *   color: "#3B82F6",
 *   order: 0
 * }
 *
 * Response (201):
 * {
 *   success: true,
 *   data: { id, name, description, startTime, endTime, color, order },
 *   message: "Event created successfully."
 * }
 */
export const POST = withApi(withFeature(handleCreateEvent, 'events'), { adminOnly: true, rateLimit: 'admin' });
