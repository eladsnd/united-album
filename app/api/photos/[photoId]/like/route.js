/**
 * Photo Like Toggle API
 *
 * POST /api/photos/[photoId]/like - Toggle like status for a photo
 *
 * Request body:
 * {
 *   userId: string // Browser fingerprint or session ID
 * }
 *
 * Response:
 * {
 *   liked: boolean,
 *   likeCount: number
 * }
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { withFeature } from '@/lib/api/featureDecorators';
import prisma from '@/lib/prisma';

async function handlePost(request, { params }) {
    try {
        const { photoId } = await params;
        const body = await request.json();
        const { userId } = body;

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        const photoIdInt = parseInt(photoId);
        if (isNaN(photoIdInt)) {
            return NextResponse.json(
                { error: 'Invalid photo ID' },
                { status: 400 }
            );
        }

        // Check if like already exists
        const existingLike = await prisma.photoLike.findUnique({
            where: {
                photoId_userId: {
                    photoId: photoIdInt,
                    userId: userId
                }
            }
        });

        let liked;
        let likeCount;

        if (existingLike) {
            // Unlike: Delete the like and decrement count
            await prisma.$transaction([
                prisma.photoLike.delete({
                    where: { id: existingLike.id }
                }),
                prisma.photo.update({
                    where: { id: photoIdInt },
                    data: { likeCount: { decrement: 1 } }
                })
            ]);
            liked = false;
        } else {
            // Like: Create the like and increment count
            await prisma.$transaction([
                prisma.photoLike.create({
                    data: {
                        photoId: photoIdInt,
                        userId: userId
                    }
                }),
                prisma.photo.update({
                    where: { id: photoIdInt },
                    data: { likeCount: { increment: 1 } }
                })
            ]);
            liked = true;
        }

        // Get updated like count
        const photo = await prisma.photo.findUnique({
            where: { id: photoIdInt },
            select: { likeCount: true }
        });

        likeCount = photo?.likeCount || 0;

        return NextResponse.json({ liked, likeCount });

    } catch (error) {
        console.error('[Photo Like API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to toggle like' },
            { status: 500 }
        );
    }
}

async function handleGet(request, { params }) {
    try {
        const { photoId } = await params;
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        const photoIdInt = parseInt(photoId);
        if (isNaN(photoIdInt)) {
            return NextResponse.json(
                { error: 'Invalid photo ID' },
                { status: 400 }
            );
        }

        const like = await prisma.photoLike.findUnique({
            where: {
                photoId_userId: {
                    photoId: photoIdInt,
                    userId: userId
                }
            }
        });

        const photo = await prisma.photo.findUnique({
            where: { id: photoIdInt },
            select: { likeCount: true }
        });

        return NextResponse.json({
            liked: !!like,
            likeCount: photo?.likeCount || 0
        });

    } catch (error) {
        console.error('[Photo Like API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to get like status' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/photos/[photoId]/like - Toggle like (feature gated)
 * GET /api/photos/[photoId]/like?userId=xxx - Check if user has liked photo (feature gated)
 */
export const POST = withApi(withFeature(handlePost, 'photoLikes'));
export const GET = withApi(withFeature(handleGet, 'photoLikes'));
