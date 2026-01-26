/**
 * Event Auto-Detection API Route
 *
 * Analyzes photo timeline and suggests event boundaries based on time gaps.
 *
 * Pattern: Decorator pattern for cross-cutting concerns
 * Service: EventService handles business logic
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { EventService } from '@/lib/services/EventService';

/**
 * POST - Auto-detect event boundaries
 *
 * Analyzes photo timeline and suggests event splits based on time gaps.
 * Returns suggested events without creating them in the database.
 *
 * Requires admin authentication
 */
async function handleAutoDetect(request) {
  const body = await request.json();
  const { minGapHours = 2 } = body;

  const eventService = new EventService();
  const suggestions = await eventService.autoDetectEventGaps(minGapHours);

  return NextResponse.json({
    success: true,
    data: {
      suggestions,
      parameters: {
        minGapHours,
        totalEvents: suggestions.length,
        totalPhotos: suggestions.reduce((sum, s) => sum + s.photoCount, 0)
      }
    },
    message: `Detected ${suggestions.length} potential event(s) with ${minGapHours}h gap threshold.`,
  });
}

/**
 * POST /api/admin/events/auto-detect
 *
 * Auto-detect event boundaries from photo timeline (admin only)
 *
 * Request (application/json):
 * {
 *   minGapHours: 2  // Minimum gap in hours to consider as event boundary (default: 2)
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     suggestions: [{
 *       name: "Event 1",
 *       startTime: "2024-06-15T14:00:00Z",
 *       endTime: "2024-06-15T16:30:00Z",
 *       photoCount: 45,
 *       photoIds: [1, 2, 3, ...],
 *       devices: [{ model: "iPhone 13", count: 20 }, ...],
 *       suggestedColor: "#3B82F6"
 *     }, ...],
 *     parameters: {
 *       minGapHours: 2,
 *       totalEvents: 3,
 *       totalPhotos: 120
 *     }
 *   },
 *   message: "Detected 3 potential event(s) with 2h gap threshold."
 * }
 */
export const POST = withApi(handleAutoDetect, { adminOnly: true, rateLimit: 'admin' });
