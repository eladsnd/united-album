/**
 * Get Event by Slug API Route
 *
 * Public endpoint to fetch event details by slug.
 * Used by guest pages and admin panels.
 *
 * Endpoints:
 * - GET /api/events/by-slug/{slug} - Get event by slug
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { NotFoundError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';
import { EventSettingsRepository } from '@/lib/repositories/EventSettingsRepository';

/**
 * GET /api/events/by-slug/{slug}
 *
 * Get event details and features by slug
 *
 * Response:
 * {
 *   success: true,
 *   event: {
 *     id, name, slug, description, eventType,
 *     startTime, endTime, color, coverImage,
 *     isActive, isArchived
 *   },
 *   features: {
 *     gamification, challenges, faceDetection,
 *     photoLikes, bulkUpload, events
 *   }
 * }
 */
async function handleGetEventBySlug(request, { params }) {
  const { slug } = await params;

  console.log(`[GetEventBySlug] Looking up event: ${slug}`);

  // Find event by slug
  const event = await prisma.event.findUnique({
    where: { slug },
  });

  if (!event) {
    console.log(`[GetEventBySlug] Event not found: ${slug}`);
    throw new NotFoundError(`Event not found: ${slug}`);
  }

  // Check if event is active
  if (!event.isActive || event.isArchived) {
    console.log(`[GetEventBySlug] Event is inactive or archived: ${slug}`);
    throw new NotFoundError('Event is not available');
  }

  console.log(`[GetEventBySlug] Event found: ${event.id} (${event.name})`);

  // Get event feature flags
  const settingsRepo = new EventSettingsRepository();
  const settings = await settingsRepo.getByEventId(event.id);

  const features = {
    gamification: settings.gamification || false,
    challenges: settings.challenges || false,
    faceDetection: settings.faceDetection || false,
    photoLikes: settings.photoLikes || false,
    bulkUpload: settings.bulkUpload || false,
    events: settings.events || false,
  };

  return NextResponse.json({
    success: true,
    event: {
      id: event.id,
      name: event.name,
      slug: event.slug,
      description: event.description,
      eventType: event.eventType,
      startTime: event.startTime,
      endTime: event.endTime,
      color: event.color,
      coverImage: event.coverImage,
      isActive: event.isActive,
      isArchived: event.isArchived,
    },
    features,
  });
}

export const GET = withApi(handleGetEventBySlug);
