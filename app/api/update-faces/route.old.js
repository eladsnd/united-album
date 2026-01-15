import { NextResponse } from 'next/server';
import { uploadToDrive, findOrCreateFolder } from '../../../lib/googleDrive';
import { updatePhoto } from '../../../lib/photoStorage';
import { getFaceById, saveFaceDescriptor } from '../../../lib/faceStorage';

/**
 * POST /api/update-faces
 * Update photo with face detection results and upload face thumbnails
 * Called after image is uploaded and faces are detected from the Drive version
 */
export async function POST(request) {
    try {
        const formData = await request.formData();

        const photoId = parseInt(formData.get('photoId'));
        const driveId = formData.get('driveId');
        const faceIdsStr = formData.get('faceIds') || '';
        const mainFaceId = formData.get('mainFaceId') || 'unknown';
        const faceBoxesStr = formData.get('faceBoxes') || '[]';

        console.log(`[Update Faces API] Updating photo ${photoId} with face data`);
        console.log(`[Update Faces API] Main face: ${mainFaceId}, All faces: ${faceIdsStr}`);

        // Parse face IDs and boxes
        const faceIdArray = faceIdsStr.split(',').map(id => id.trim()).filter(id => id);
        let faceBoxes = [];
        try {
            faceBoxes = JSON.parse(faceBoxesStr);
        } catch (e) {
            console.warn('[Update Faces API] Failed to parse face boxes:', e);
        }

        // Extract face thumbnail blobs from FormData
        const faceThumbnailFiles = [];
        for (const [key, value] of formData.entries()) {
            if (key.startsWith('faceThumbnail_')) {
                const faceId = key.replace('faceThumbnail_', '');
                faceThumbnailFiles.push({ faceId, file: value });
            }
        }

        console.log(`[Update Faces API] Found ${faceThumbnailFiles.length} face thumbnails to upload`);

        let successfulThumbnails = [];

        // Only upload thumbnails if there are new faces
        if (faceThumbnailFiles.length > 0) {
            // Upload face thumbnails to Google Drive in 'faces' subfolder
            const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

            // Find or create 'faces' subfolder
            const facesFolderId = await findOrCreateFolder('faces', folderId);

            const thumbnailUploads = await Promise.all(
                faceThumbnailFiles.map(async ({ faceId, file: thumbFile }) => {
                    try {
                        const thumbBuffer = Buffer.from(await thumbFile.arrayBuffer());
                        const thumbData = await uploadToDrive(
                            thumbBuffer,
                            `${faceId}.jpg`,
                            facesFolderId
                        );
                        console.log(`[Update Faces API] Uploaded thumbnail for ${faceId}: ${thumbData.id}`);
                        return { faceId, thumbnailDriveId: thumbData.id };
                    } catch (err) {
                        console.error(`[Update Faces API] Failed to upload thumbnail for ${faceId}:`, err);
                        return null;
                    }
                })
            );

            // Filter out failed uploads
            successfulThumbnails = thumbnailUploads.filter(t => t);
            console.log(`[Update Faces API] Successfully uploaded ${successfulThumbnails.length} thumbnails`);
        } else {
            console.log(`[Update Faces API] No new thumbnails to upload (all faces already have thumbnails)`);
        }

        // Update face storage with thumbnail Drive IDs
        for (const { faceId, thumbnailDriveId } of successfulThumbnails) {
            const existingFace = getFaceById(faceId);
            if (existingFace) {
                // Update existing face with thumbnail ID (preserve existing descriptor)
                saveFaceDescriptor(faceId, existingFace.descriptor, {
                    ...existingFace.metadata,
                    thumbnailDriveId
                });
                console.log(`[Update Faces API] Updated ${faceId} with thumbnail ID: ${thumbnailDriveId}`);
            } else {
                // New face without descriptor yet - save placeholder
                saveFaceDescriptor(faceId, [], {
                    thumbnailDriveId
                });
                console.log(`[Update Faces API] Created new face ${faceId} with thumbnail ID: ${thumbnailDriveId}`);
            }
        }

        // Update photo metadata with face data
        const updatedPhoto = updatePhoto(photoId, {
            mainFaceId,
            faceIds: faceIdArray,
            faceBoxes
        });

        if (!updatedPhoto) {
            console.error(`[Update Faces API] Photo ${photoId} not found`);
            return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
        }

        console.log(`[Update Faces API] Successfully updated photo ${photoId} with ${faceIdArray.length} faces`);

        return NextResponse.json({
            success: true,
            photo: updatedPhoto,
            thumbnailsUploaded: successfulThumbnails.length
        });

    } catch (error) {
        console.error('[Update Faces API] Error:', error);
        return NextResponse.json({
            error: 'Failed to update faces: ' + error.message
        }, { status: 500 });
    }
}
