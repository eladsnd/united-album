import { NextResponse } from 'next/server';
import { PhotoRepository } from '../../../lib/repositories/PhotoRepository.js';
import { getPhotoStream } from '../../../lib/storage/operations';
import JSZip from 'jszip';
import { applyRateLimit } from '../../../lib/middleware/rateLimit';
import { downloadDriveFile } from '../../../lib/utils/streamUtils';
import { ValidationError } from '../../../lib/api/errors';

export async function POST(request) {
    try {
        // Rate limit album downloads (stricter: 3 per hour)
        const rateLimitResult = applyRateLimit(request, 'downloadAlbum');

        if (!rateLimitResult.allowed) {
            return rateLimitResult.response;
        }

        const { photoIds, eventId } = await request.json();

        // CRITICAL: Require eventId for multi-tenancy isolation
        if (!eventId) {
            throw new ValidationError('eventId is required for data isolation');
        }

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

        const photoRepo = new PhotoRepository();

        // CRITICAL: Get only photos for this event
        const eventPhotos = await photoRepo.findMany({
            where: { eventId }, // CRITICAL: Filter by eventId to prevent data leaks
        });

        // CRITICAL: Filter to only requested photos that belong to this event
        const selectedPhotos = eventPhotos.filter(p => photoIds.includes(p.id));

        // Verify all requested photos were found (security check)
        if (selectedPhotos.length !== photoIds.length) {
            console.warn(`[Download Album] User requested ${photoIds.length} photos but only ${selectedPhotos.length} belong to event ${eventId}`);
            return NextResponse.json(
                { error: 'Some requested photos do not belong to this event' },
                { status: 403 }
            );
        }

        console.log(`[Download Album] Creating ZIP with ${selectedPhotos.length} photos for event ${eventId}`);

        const zip = new JSZip();

        // Download each photo and add to ZIP
        for (const photo of selectedPhotos) {
            try {
                // Use centralized stream utility (provider-agnostic)
                const buffer = await downloadDriveFile(getPhotoStream, photo.driveId);

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

        // Re-throw ValidationError (like missing eventId) without fallback
        if (error instanceof ValidationError) {
            return NextResponse.json(
                { error: error.message },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to create album ZIP' },
            { status: 500 }
        );
    }
}
