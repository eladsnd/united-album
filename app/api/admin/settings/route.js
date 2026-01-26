/**
 * Admin Settings API Route
 *
 * Manages global application settings (gamify mode toggle, etc.)
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
import { GamificationService } from '@/lib/services/GamificationService';

/**
 * GET /api/admin/settings
 *
 * Get current application settings
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     id: "app_settings",
 *     gamifyMode: false,
 *     createdAt: "2024-01-...",
 *     updatedAt: "2024-01-..."
 *   }
 * }
 */
async function handleGet(request) {
  const gamificationService = new GamificationService();
  const settings = await gamificationService.getSettings();

  return NextResponse.json({
    success: true,
    data: settings,
  });
}

/**
 * PUT /api/admin/settings
 *
 * Update application settings
 *
 * Request body:
 * {
 *   gamifyMode: true  // Toggle gamify mode
 * }
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     id: "app_settings",
 *     gamifyMode: true,
 *     ...
 *   },
 *   message: "Settings updated successfully."
 * }
 */
async function handlePut(request) {
  const body = await request.json();
  const gamificationService = new GamificationService();

  const updatedSettings = await gamificationService.updateSettings(body);

  return NextResponse.json({
    success: true,
    data: updatedSettings,
    message: 'Settings updated successfully.',
  });
}

// Apply decorators with admin authentication
export const GET = withApi(handleGet, { adminOnly: true });
export const PUT = withApi(handlePut, { adminOnly: true });
