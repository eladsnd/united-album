/**
 * Photo Assignment API Route
 *
 * Bulk assign/unassign photos to/from events.
 *
 * Pattern: Decorator pattern for cross-cutting concerns
 * Service: EventService handles business logic
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { withFeature } from '@/lib/api/featureDecorators';
import { EventService } from '@/lib/services/EventService';

/**
 * POST - Assign photos to event
 *
 * Bulk assigns multiple photos to the specified event.
 * Use eventId='unassign' or null to remove event assignment.
 *
 * Requires admin authentication
 */
async function handleAssignPhotos(request, { params }) {
  const { eventId } = params;
  const body = await request.json();
  const { photoIds } = body;

  const eventService = new EventService();

  // Special handling for unassign
  const targetEventId = eventId === 'unassign' ? null : eventId;

  const result = await eventService.assignPhotosToEvent(targetEventId, photoIds);

  return NextResponse.json({
    success: true,
    data: {
      eventId: targetEventId,
      assignedCount: result.count,
    },
    message: targetEventId
      ? `Assigned ${result.count} photo(s) to event.`
      : `Unassigned ${result.count} photo(s) from events.`,
  });
}

/**
 * POST /api/admin/events/[eventId]/assign
 *
 * Assign photos to event (admin only)
 *
 * Use eventId='unassign' to remove event assignments
 *
 * Request (application/json):
 * {
 *   photoIds: [1, 2, 3, ...]  // Array of photo database IDs
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     eventId: "evt_123",
 *     assignedCount: 15
 *   },
 *   message: "Assigned 15 photo(s) to event."
 * }
 */
export const POST = withApi(withFeature(handleAssignPhotos, 'events'), { adminOnly: true, rateLimit: 'admin' });
