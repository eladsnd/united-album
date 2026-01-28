/**
 * Event-Scoped Feature Flags API Route
 *
 * Manages feature flags for a specific event.
 * Each event has independent feature flag configuration.
 *
 * Endpoints:
 * - GET /api/events/[eventId]/features - Get all feature flags for event
 * - GET /api/events/[eventId]/features?feature=X - Get specific flag
 * - PUT /api/events/[eventId]/features - Update feature flags (admin only)
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { FeatureFlagService } from '@/lib/services/FeatureFlagService';
import { ValidationError } from '@/lib/api/errors';

/**
 * GET /api/events/[eventId]/features
 *
 * Get feature flags for a specific event
 *
 * Query params:
 * - feature: Optional - Get specific flag value
 *
 * Response (all flags):
 * {
 *   success: true,
 *   flags: {
 *     gamification: true,
 *     events: false,
 *     faceDetection: true,
 *     photoLikes: false,
 *     bulkUpload: false,
 *     challenges: true
 *   }
 * }
 *
 * Response (specific flag):
 * {
 *   success: true,
 *   feature: "gamification",
 *   enabled: true
 * }
 */
async function handleGetFeatures(request, context) {
  const { eventId } = await context.params;
  const { searchParams } = new URL(request.url);
  const feature = searchParams.get('feature');

  if (!eventId) {
    throw new ValidationError('Event ID is required');
  }

  const flagService = new FeatureFlagService(eventId);

  if (feature) {
    // Get specific flag
    const enabled = await flagService.isEnabledSafe(feature, false);
    return NextResponse.json({
      success: true,
      feature,
      enabled,
    });
  }

  // Get all flags
  const flags = await flagService.getAllSafe();
  return NextResponse.json({
    success: true,
    flags,
  });
}

/**
 * PUT /api/events/[eventId]/features
 *
 * Update feature flags for event (admin only)
 *
 * Request body:
 * {
 *   gamification: true,
 *   challenges: false,
 *   ...
 * }
 *
 * Response:
 * {
 *   success: true,
 *   flags: { ... updated flags ... }
 * }
 */
async function handleUpdateFeatures(request, context) {
  const { eventId } = await context.params;
  const updates = await request.json();

  if (!eventId) {
    throw new ValidationError('Event ID is required');
  }

  if (!updates || typeof updates !== 'object') {
    throw new ValidationError('Updates must be an object');
  }

  const flagService = new FeatureFlagService(eventId);
  const updatedFlags = await flagService.updateFlags(updates);

  return NextResponse.json({
    success: true,
    flags: updatedFlags,
  });
}

// Apply decorators
export const GET = withApi(handleGetFeatures);
export const PUT = withApi(handleUpdateFeatures, { adminOnly: true });
