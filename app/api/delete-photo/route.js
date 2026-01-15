import { NextResponse } from 'next/server';
import { loadPhotos } from '../../../lib/photoStorage';
import fs from 'fs';
import path from 'path';

const PHOTOS_FILE = path.join(process.cwd(), 'data', 'photos.json');

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

        // Load photos
        const photos = loadPhotos();
        const photoIndex = photos.findIndex(p => p.id === photoId);

        if (photoIndex === -1) {
            console.error(`[Delete Photo API] Photo ${photoId} not found`);
            return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
        }

        const deletedPhoto = photos[photoIndex];
        console.log(`[Delete Photo API] Found photo: ${deletedPhoto.name}`);

        // Remove from array
        photos.splice(photoIndex, 1);

        // Save updated photos
        fs.writeFileSync(PHOTOS_FILE, JSON.stringify(photos, null, 2));

        console.log(`[Delete Photo API] Successfully deleted photo ${photoId}`);
        console.log(`[Delete Photo API] Note: Drive file ${deletedPhoto.driveId} and thumbnails still exist`);

        return NextResponse.json({
            success: true,
            deletedPhoto,
            message: 'Photo deleted from album. Drive file remains for backup.'
        });

    } catch (error) {
        console.error('[Delete Photo API] Error:', error);
        return NextResponse.json({
            error: 'Failed to delete photo: ' + error.message
        }, { status: 500 });
    }
}
