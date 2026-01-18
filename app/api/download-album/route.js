import { NextResponse } from 'next/server';
import { getPhotos } from '../../../lib/photoStorage';
import { getFileStream } from '../../../lib/googleDrive';
import JSZip from 'jszip';
import { applyRateLimit } from '../../../lib/rateLimit';
import { downloadDriveFile } from '../../../lib/streamUtils';

export async function POST(request) {
    try {
        // Rate limit album downloads (stricter: 3 per hour)
        const rateLimitResult = applyRateLimit(request, 'downloadAlbum');

        if (!rateLimitResult.allowed) {
            return rateLimitResult.response;
        }

        const { photoIds } = await request.json();

        // Validate photoIds is array
        if (!photoIds || !Array.isArray(photoIds)) {
            return NextResponse.json(
                { error: 'photoIds array is required' },
                { status: 400 }
            );
        }

        // CRITICAL: Limit number of photos to prevent memory exhaustion
        const MAX_PHOTOS_PER_ZIP = 50;
        if (photoIds.length > MAX_PHOTOS_PER_ZIP) {
            return NextResponse.json(
                {
                    error: `Maximum ${MAX_PHOTOS_PER_ZIP} photos per download. Please select fewer photos.`,
                    maxPhotos: MAX_PHOTOS_PER_ZIP,
                    requestedPhotos: photoIds.length
                },
                { status: 400 }
            );
        }

        const photos = getPhotos();
        const selectedPhotos = photos.filter(p => photoIds.includes(p.id));

        const zip = new JSZip();

        // Download each photo and add to ZIP
        for (const photo of selectedPhotos) {
            try {
                // Use centralized stream utility (DRY principle)
                const buffer = await downloadDriveFile(getFileStream, photo.driveId);

                const filename = `${photo.poseId || 'photo'}-${photo.id}.jpg`;
                zip.file(filename, buffer);
                console.log(`[Download Album] Added photo ${photo.id} to ZIP (${buffer.length} bytes)`);
            } catch (err) {
                console.error(`[Download Album] Failed to add photo ${photo.id}:`, err);
            }
        }

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

        return new NextResponse(zipBuffer, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="united-album-${Date.now()}.zip"`,
            },
        });
    } catch (error) {
        console.error('[Download Album API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to create album ZIP' },
            { status: 500 }
        );
    }
}
