import { NextResponse } from 'next/server';
import { getPhotos, deletePhoto } from '../../../lib/photoStorage';
import { deleteFromDrive } from '../../../lib/googleDrive';
import { isAdminAuthenticated } from '../../../lib/adminAuth';

/**
 * DELETE /api/delete-photo?photoId=123&uploaderId=xxx
 * Delete a photo from the album AND Google Drive
 *
 * Security: Only the uploader can delete their own photos, OR admin can delete any photo
 */
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const photoId = parseInt(searchParams.get('photoId'));
        const uploaderId = searchParams.get('uploaderId');

        if (!photoId) {
            return NextResponse.json({ error: 'photoId is required' }, { status: 400 });
        }

        // Check if user is admin
        const isAdmin = isAdminAuthenticated(request);

        console.log(`[Delete Photo API] Delete request for photo ${photoId} by ${isAdmin ? 'ADMIN' : `uploader ${uploaderId}`}`);

        // Find the photo first
        const photos = getPhotos();
        const photo = photos.find(p => p.id === photoId);

        if (!photo) {
            console.error(`[Delete Photo API] Photo ${photoId} not found`);
            return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
        }

        // Permission check: Admin can delete any photo, regular user can only delete their own
        const canDelete = isAdmin || (uploaderId && photo.uploaderId === uploaderId);

        if (!canDelete) {
            console.error(`[Delete Photo API] Permission denied. Photo uploader: ${photo.uploaderId}, Requester: ${uploaderId}, IsAdmin: ${isAdmin}`);
            return NextResponse.json({
                error: 'You can only delete photos you uploaded'
            }, { status: 403 });
        }

        console.log(`[Delete Photo API] Uploader verified. Deleting photo: ${photo.name}, driveId: ${photo.driveId}`);

        // Delete from Google Drive first
        try {
            await deleteFromDrive(photo.driveId);
            console.log(`[Delete Photo API] Deleted from Google Drive: ${photo.driveId}`);
        } catch (driveError) {
            console.error(`[Delete Photo API] Failed to delete from Drive:`, driveError);
            return NextResponse.json({
                error: 'Failed to delete from Google Drive: ' + driveError.message
            }, { status: 500 });
        }

        // Delete from photos.json
        const success = deletePhoto(photo.driveId);

        if (!success) {
            return NextResponse.json({ error: 'Failed to delete photo metadata' }, { status: 500 });
        }

        console.log(`[Delete Photo API] Successfully deleted photo ${photoId} from both Drive and album`);

        return NextResponse.json({
            success: true,
            deletedPhoto: photo,
            message: 'Photo permanently deleted from Drive and album.'
        });

    } catch (error) {
        console.error('[Delete Photo API] Error:', error);
        return NextResponse.json({
            error: 'Failed to delete photo: ' + error.message
        }, { status: 500 });
    }
}
