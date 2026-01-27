/**
 * Admin Settings API Route
 *
 * Manages global application settings including all feature flags.
 *
 * Endpoints:
 * - GET /api/admin/settings - Get current settings (admin only)
 * - PUT /api/admin/settings - Update settings (admin only)
 *
 * Uses Decorator Pattern:
 * - withApi: Automatic error handling and logging
 * - adminOnly: true - Requires admin authentication
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { FeatureFlagService } from '@/lib/services/FeatureFlagService';

/**
 * GET /api/admin/settings
 *
 * Get current application settings
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     gamification: false,
 *     events: false,
 *     faceDetection: false,
 *     photoLikes: false,
 *     bulkUpload: false
 *   }
 * }
 */
async function handleGet(request) {
  const featureFlags = new FeatureFlagService();
  const flags = await featureFlags.getAllFlags();

  return NextResponse.json({
    success: true,
    data: flags,
  });
}

/**
 * PUT /api/admin/settings
 *
 * Update application settings
 *
 * Request body:
 * {
 *   gamification: true,
 *   events: false,
 *   ...
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     gamification: true,
 *     events: false,
 *     faceDetection: false,
 *     photoLikes: false,
 *     bulkUpload: false
 *   },
 *   message: "Feature flags updated successfully."
 * }
 */
async function handlePut(request) {
  const body = await request.json();
  const featureFlags = new FeatureFlagService();

  const updated = await featureFlags.updateFlags(body);

  return NextResponse.json({
    success: true,
    data: updated,
    message: 'Feature flags updated successfully.',
  });
}

// Apply decorators with admin authentication
export const GET = withApi(handleGet, { adminOnly: true });
export const PUT = withApi(handlePut, { adminOnly: true });
