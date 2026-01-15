import { NextResponse } from 'next/server';
import { getPhotos, deletePhoto } from '../../../lib/photoStorage';

/**
 * DELETE /api/delete-photo?photoId=123
 * Delete a photo from the album
 *
 * Note: This only removes from photos.json
 * The actual Google Drive file and face thumbnails remain
 * Use scripts/cleanupOrphanedThumbnails.js to clean up orphaned thumbnails later
 */
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const photoId = parseInt(searchParams.get('photoId'));

        if (!photoId) {
            return NextResponse.json({ error: 'photoId is required' }, { status: 400 });
        }

        console.log(`[Delete Photo API] Deleting photo ${photoId}`);

        // Find the photo first
        const photos = getPhotos();
        const photo = photos.find(p => p.id === photoId);

        if (!photo) {
            console.error(`[Delete Photo API] Photo ${photoId} not found`);
            return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
        }

        console.log(`[Delete Photo API] Found photo: ${photo.name}, driveId: ${photo.driveId}`);

        // Delete by driveId
        const success = deletePhoto(photo.driveId);

        if (!success) {
            return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 });
        }

        console.log(`[Delete Photo API] Successfully deleted photo ${photoId}`);
        console.log(`[Delete Photo API] Note: Drive file ${photo.driveId} and thumbnails still exist`);

        return NextResponse.json({
            success: true,
            deletedPhoto: photo,
            message: 'Photo deleted from album. Drive file remains for backup.'
        });

    } catch (error) {
        console.error('[Delete Photo API] Error:', error);
        return NextResponse.json({
            error: 'Failed to delete photo: ' + error.message
        }, { status: 500 });
    }
}
