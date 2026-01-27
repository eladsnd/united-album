import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import prisma from '@/lib/prisma';

/**
 * Batch Fetch Liked Photos API
 *
 * GET /api/photos/likes/batch?userId={userId}
 *
 * Returns all photo IDs liked by a user in ONE request.
 * Replaces N individual API calls with 1 batch call.
 *
 * Performance: 100 photos = 100 API calls -> 1 API call (100x faster)
 */
async function handleBatchLikes(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json(
      { error: 'Missing userId parameter' },
      { status: 400 }
    );
  }

  try {
    // Fetch all likes for this user in one query
    const likes = await prisma.photoLike.findMany({
      where: { userId },
      select: { photoId: true },
    });

    // Extract photo IDs
    const likedPhotoIds = likes.map(like => like.photoId);

    return NextResponse.json({
      userId,
      likedPhotoIds,
      count: likedPhotoIds.length,
    });
  } catch (error) {
    console.error('[Batch Likes API] Error:', error);
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
