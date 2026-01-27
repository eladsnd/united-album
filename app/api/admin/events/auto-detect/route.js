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
import { withFeature } from '@/lib/api/featureDecorators';
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
  const {
    epsilon = null,          // Auto-detect if null
    minPoints = 3,           // Min photos per event
    method = 'dbscan'        // 'dbscan' or 'gaps'
  } = body;

  const eventService = new EventService();

  // Use smart DBSCAN clustering by default
  const suggestions = await eventService.autoDetectEventsSmart({
    epsilon,
    minPoints,
    method
  });

  return NextResponse.json({
    success: true,
    data: {
      suggestions,
      parameters: {
        epsilon: epsilon || 'auto',
        minPoints,
        method,
        totalEvents: suggestions.length,
        totalPhotos: suggestions.reduce((sum, s) => sum + s.photoCount, 0)
      }
    },
    message: `Detected ${suggestions.length} event(s) using ${method} clustering.`,
  });
}

/**
 * POST /api/admin/events/auto-detect
 *
 * Smart event detection using DBSCAN clustering algorithm (admin only)
 *
 * Uses density-based clustering to find natural event boundaries and
 * intelligently names events based on time-of-day and duration patterns.
 *
 * Request (application/json):
 * {
 *   epsilon: 60,        // Max time gap in minutes (null = auto-detect, default: null)
 *   minPoints: 3,       // Min photos per event cluster (default: 3)
 *   method: "dbscan"    // Clustering method: "dbscan" or "gaps" (default: "dbscan")
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     suggestions: [{
 *       name: "Ceremony",          // Smart event name
 *       eventType: "ceremony",     // Event type classification
 *       confidence: 0.85,          // Name confidence (0-1)
 *       startTime: "2024-06-15T14:00:00Z",
 *       endTime: "2024-06-15T14:45:00Z",
 *       duration: 45,              // Minutes
 *       photoCount: 67,
 *       photoDensity: 89.3,        // Photos per hour
 *       photoIds: [1, 2, 3, ...],
 *       devices: [{ model: "iPhone 13", count: 35 }, ...],
 *       suggestedColor: "#3B82F6"
 *     }, ...],
 *     parameters: {
 *       epsilon: "auto",           // Used epsilon value
 *       minPoints: 3,
 *       method: "dbscan",
 *       totalEvents: 4,
 *       totalPhotos: 215
 *     }
 *   },
 *   message: "Detected 4 event(s) using dbscan clustering."
 * }
 */
export const POST = withApi(withFeature(handleAutoDetect, 'events'), { adminOnly: true, rateLimit: 'admin' });
