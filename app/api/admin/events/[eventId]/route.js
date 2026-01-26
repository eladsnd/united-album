/**
 * Individual Event API Route
 *
 * Provides GET, PUT, DELETE operations for a specific event.
 *
 * Pattern: Decorator pattern for cross-cutting concerns
 * Service: EventService handles business logic
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { EventService } from '@/lib/services/EventService';
import { EventRepository } from '@/lib/repositories/EventRepository';
import { PhotoRepository } from '@/lib/repositories/PhotoRepository';

/**
 * GET - Get single event with photos
 *
 * Returns event details with assigned photos
 */
async function handleGetEvent(request, { params }) {
  const { eventId } = params;

  const eventRepo = new EventRepository();
  const photoRepo = new PhotoRepository();

  const event = await eventRepo.findById(eventId);
  const photos = await photoRepo.findByEventId(eventId);

  return NextResponse.json({
    success: true,
    data: {
      ...event,
      photoCount: photos.length,
      photos,
    },
  });
}

/**
 * PUT - Update event
 *
 * Requires admin authentication
 */
async function handleUpdateEvent(request, { params }) {
  const { eventId } = params;
  const body = await request.json();

  const eventService = new EventService();
  const updatedEvent = await eventService.updateEvent(eventId, body);

  return NextResponse.json({
    success: true,
    data: updatedEvent,
    message: 'Event updated successfully.',
  });
}

/**
 * DELETE - Delete event
 *
 * Requires admin authentication
 * Photos assigned to this event will be unassigned (eventId set to null)
 */
async function handleDeleteEvent(request, { params }) {
  const { eventId } = params;

  const eventService = new EventService();
  const result = await eventService.deleteEvent(eventId);

  return NextResponse.json({
    success: true,
    message: 'Event deleted successfully.',
    data: result,
  });
}

/**
 * GET /api/admin/events/[eventId]
 *
 * Get single event with photos
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     id, name, description, startTime, endTime, color, order,
 *     photoCount, photos: [...]
 *   }
 * }
 */
export const GET = withApi(handleGetEvent);

/**
 * PUT /api/admin/events/[eventId]
 *
 * Update event (admin only)
 *
 * Request (application/json):
 * {
 *   name: "Updated Ceremony",
 *   description: "Updated description",
 *   startTime: "2024-06-15T14:00:00Z",
 *   endTime: "2024-06-15T16:00:00Z",
 *   color: "#EF4444",
 *   order: 1
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: { id, name, ... },
 *   message: "Event updated successfully."
 * }
 */
export const PUT = withApi(handleUpdateEvent, { adminOnly: true, rateLimit: 'admin' });

/**
 * DELETE /api/admin/events/[eventId]
 *
 * Delete event (admin only)
 *
 * Photos assigned to this event will have eventId set to null
 *
 * Response:
 * {
 *   success: true,
 *   message: "Event deleted successfully.",
 *   data: { id, name }
 * }
 */
export const DELETE = withApi(handleDeleteEvent, { adminOnly: true, rateLimit: 'admin' });
