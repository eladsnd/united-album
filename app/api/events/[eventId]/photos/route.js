/**
 * Event-Scoped Photos API
 *
 * GET /api/events/{eventId}/photos - List photos for specific event
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { PhotoRepository } from '@/lib/repositories/PhotoRepository';

/**
 * GET /api/events/{eventId}/photos
 *
 * List all photos for a specific event
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 20)
 */
async function handleGetEventPhotos(request, { params }) {
  const { eventId } = await params;
  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  const photoRepo = new PhotoRepository();

  // Fetch photos filtered by eventId
  const photos = await photoRepo.findMany({
    where: { eventId },
    orderBy: { timestamp: 'desc' },
    skip: offset,
    take: limit + 1, // Fetch one extra to check if there are more
  });

  const hasMore = photos.length > limit;
  const photosToReturn = hasMore ? photos.slice(0, limit) : photos;

  console.log(`[EventPhotos] Fetched ${photosToReturn.length} photos for event ${eventId} (page ${page})`);

  return NextResponse.json({
    success: true,
    photos: photosToReturn,
    pagination: {
      page,
      limit,
      hasMore,
    },
  });
}

export const GET = withApi(handleGetEventPhotos);
