import { NextResponse } from 'next/server';
import { getPhotos, deletePhoto } from '../../../lib/photoStorage';
import { deleteFromDrive } from '../../../lib/googleDrive';
import { isAdminAuthenticated } from '../../../lib/adminAuth';
import { deleteFace, getFaceById } from '../../../lib/faceStorage';

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
        const photos = await getPhotos();
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
        const success = await deletePhoto(photo.driveId);

        if (!success) {
            return NextResponse.json({ error: 'Failed to delete photo metadata' }, { status: 500 });
        }

        console.log(`[Delete Photo API] Successfully deleted photo ${photoId} from both Drive and album`);

        // Clean up orphaned face thumbnails
        // Check if any faces from this photo no longer appear in ANY other photo
        const facesInDeletedPhoto = photo.faceIds || [photo.mainFaceId || photo.faceId].filter(Boolean);
        const remainingPhotos = await getPhotos(); // Get updated list after deletion
        const orphanedFaces = [];

        for (const faceId of facesInDeletedPhoto) {
            if (!faceId || faceId === 'unknown') continue;

            // Count how many photos still contain this face
            const photosWithThisFace = remainingPhotos.filter(p => {
                const photoFaces = p.faceIds || [p.mainFaceId || p.faceId].filter(Boolean);
                return photoFaces.includes(faceId);
            });

            if (photosWithThisFace.length === 0) {
                // This face is orphaned - no photos contain it anymore
                console.log(`[Delete Photo API] Face ${faceId} is orphaned (no photos remaining)`);

                const faceData = await getFaceById(faceId);
                if (faceData && faceData.thumbnailDriveId) {
                    try {
                        // Delete thumbnail from Google Drive
                        await deleteFromDrive(faceData.thumbnailDriveId);
                        console.log(`[Delete Photo API] Deleted orphaned thumbnail from Drive: ${faceData.thumbnailDriveId}`);
                    } catch (thumbError) {
                        console.error(`[Delete Photo API] Failed to delete thumbnail from Drive:`, thumbError);
                    }
                }

                // Delete face from faces.json
                await deleteFace(faceId);
                orphanedFaces.push(faceId);
            }
        }

        const message = orphanedFaces.length > 0
            ? `Photo permanently deleted. ${orphanedFaces.length} orphaned face thumbnail(s) also removed.`
            : 'Photo permanently deleted from Drive and album.';

        return NextResponse.json({
            success: true,
            deletedPhoto: photo,
            orphanedFaces,
            message
        });

    } catch (error) {
        console.error('[Delete Photo API] Error:', error);
        return NextResponse.json({
            error: 'Failed to delete photo: ' + error.message
        }, { status: 500 });
    }
}
