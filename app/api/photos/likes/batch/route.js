import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { ValidationError } from '@/lib/api/errors';
import prisma from '@/lib/prisma';

/**
 * Batch Fetch Liked Photos API (Event-Scoped)
 *
 * GET /api/photos/likes/batch?userId={userId}&eventId={eventId}
 *
 * Returns all photo IDs liked by a user IN CURRENT EVENT in ONE request.
 * Replaces N individual API calls with 1 batch call.
 *
 * Performance: 100 photos = 100 API calls -> 1 API call (100x faster)
 */
async function handleBatchLikes(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const eventId = searchParams.get('eventId');

  if (!userId) {
    return NextResponse.json(
      { error: 'Missing userId parameter' },
      { status: 400 }
    );
  }

  // CRITICAL: Require eventId for multi-tenancy isolation
  if (!eventId) {
    throw new ValidationError('eventId is required for data isolation');
  }

  try {
    // CRITICAL: Get photos for this event FIRST
    const eventPhotos = await prisma.photo.findMany({
      where: { eventId }, // CRITICAL: Filter by eventId to prevent data leaks
      select: { id: true },
    });

    const eventPhotoIds = eventPhotos.map(p => p.id);

    // Fetch all likes for this user in one query
    const likes = await prisma.photoLike.findMany({
      where: {
        userId,
        photoId: { in: eventPhotoIds } // CRITICAL: Only return likes for photos in this event
      },
      select: { photoId: true },
    });

    // Extract photo IDs
    const likedPhotoIds = likes.map(like => like.photoId);

    console.log(`[Batch Likes API] User ${userId} liked ${likedPhotoIds.length} photos in event ${eventId}`);

    return NextResponse.json({
      userId,
      eventId,
      likedPhotoIds,
      count: likedPhotoIds.length,
    });
  } catch (error) {
    console.error('[Batch Likes API] Error:', error);

    // Re-throw ValidationError (like missing eventId) without fallback
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch liked photos' },
      { status: 500 }
    );
  }
}

export const GET = withApi(handleBatchLikes, {
  rateLimit: 'api',
  adminOnly: false,
});
