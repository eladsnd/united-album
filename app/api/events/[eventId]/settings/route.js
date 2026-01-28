/**
 * Event-Scoped Settings API
 *
 * GET /api/events/{eventId}/settings - Get event-specific feature flags
 * PUT /api/events/{eventId}/settings - Update event-specific feature flags
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { EventSettingsRepository } from '@/lib/repositories/EventSettingsRepository';

/**
 * GET /api/events/{eventId}/settings
 *
 * Get feature flags for a specific event
 */
async function handleGetEventSettings(request, { params }) {
  const { eventId } = await params;

  const settingsRepo = new EventSettingsRepository();
  const settings = await settingsRepo.getByEventId(eventId);

  console.log(`[EventSettings] Retrieved settings for event ${eventId}`);

  return NextResponse.json({
    success: true,
    data: settings,
  });
}

/**
 * PUT /api/events/{eventId}/settings
 *
 * Update feature flags for a specific event (admin only)
 */
async function handleUpdateEventSettings(request, { params }) {
  const { eventId } = await params;
  const body = await request.json();

  const settingsRepo = new EventSettingsRepository();
  const settings = await settingsRepo.updateSettings(eventId, body);

  console.log(`[EventSettings] Updated settings for event ${eventId}:`, body);

  return NextResponse.json({
    success: true,
    data: settings,
  });
}

export const GET = withApi(handleGetEventSettings);
export const PUT = withApi(handleUpdateEventSettings);
