import { NextResponse } from 'next/server';
import { getAllFaces } from '../../../lib/faceStorage';
import { getPhotos } from '../../../lib/photoStorage';

// GET /api/face-thumbnails - Get face thumbnails (cropped face images)
export async function GET() {
    try {
        const faces = getAllFaces();
        const photos = getPhotos();

        // For each face, find a representative photo with bounding box
        const faceThumbnails = faces.map(face => {
            // Find a photo where this face is the main face
            const photo = photos.find(p => p.mainFaceId === face.faceId);

            let faceUrl = null;
            if (photo) {
                // Try to use cropped face if boxes are available
                if (photo.faceBoxes && photo.faceBoxes.length > 0) {
                    const faceIndex = photo.faceIds.indexOf(face.faceId);
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
