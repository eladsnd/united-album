import { NextResponse } from 'next/server';
import { FaceRepository } from '../../../lib/repositories/FaceRepository.js';
import { PhotoRepository } from '../../../lib/repositories/PhotoRepository.js';

// GET /api/face-thumbnails - Get face thumbnails (cropped face images)
export async function GET() {
    try {
        const faceRepo = new FaceRepository();
        const photoRepo = new PhotoRepository();

        const faces = await faceRepo.findAll();
        const photos = await photoRepo.findAll();

        // For each face, find a representative photo with bounding box
        const faceThumbnails = faces.map(face => {
            let faceUrl = null;

            // PRIORITY 1: Use stored face thumbnail (high-quality crop from original image)
            if (face.thumbnailDriveId) {
                // Check if it's a full URL (Cloudinary) or just an ID (Google Drive)
                if (face.thumbnailDriveId.startsWith('http')) {
                    faceUrl = face.thumbnailDriveId; // Cloudinary: Direct URL
                } else {
                    faceUrl = `/api/image/${face.thumbnailDriveId}`; // Google Drive: Proxy URL
                }
                console.log(`[Face Thumbnails] Using stored thumbnail for ${face.faceId}: ${faceUrl}`);
            } else {
                // FALLBACK: Find ANY photo containing this face and crop from it
                const photo = photos.find(p => {
                    const faceIds = p.faceIds || [p.mainFaceId || p.faceId];
                    return faceIds.includes(face.faceId);
                });

                if (photo) {
                    // Try to use cropped face if boxes are available
                    if (photo.faceBoxes && photo.faceBoxes.length > 0) {
                        const faceIds = photo.faceIds || [photo.mainFaceId];
                        const faceIndex = faceIds.indexOf(face.faceId);
                        if (faceIndex >= 0 && photo.faceBoxes[faceIndex]) {
                            const box = photo.faceBoxes[faceIndex];
                            faceUrl = `/api/face-crop/${photo.driveId}?x=${box.x}&y=${box.y}&w=${box.width}&h=${box.height}`;
                        }
                    }

                    // Fallback to full photo URL if no crop available
                    if (!faceUrl) {
                        faceUrl = photo.url;
                    }
                }
            }

            // Calculate actual photo count by counting ALL photos where this face appears
            const photoCount = photos.filter(p => {
                const faceIds = p.faceIds || [p.mainFaceId || p.faceId];
                return faceIds.includes(face.faceId);
            }).length;

            return {
                faceId: face.faceId,
                faceUrl: faceUrl,
                photoCount: photoCount,
                lastSeen: face.lastSeen
            };
        });

        // Filter out faces with 0 photos
        const activeFaces = faceThumbnails.filter(face => face.photoCount > 0);

        // Sort by photo count (most photos first)
        activeFaces.sort((a, b) => b.photoCount - a.photoCount);

        return NextResponse.json(activeFaces);
    } catch (error) {
        console.error('[Face Thumbnails API] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch face thumbnails' }, { status: 500 });
    }
}
