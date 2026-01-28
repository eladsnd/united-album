import { NextResponse } from 'next/server';
import { getPhotoStream, getProviderName } from '../../../../lib/storage/operations';
import { PhotoRepository } from '../../../../lib/repositories/PhotoRepository.js';
import { applyRateLimit } from '../../../../lib/middleware/rateLimit';
import { downloadDriveFile } from '../../../../lib/utils/streamUtils';
import { ValidationError } from '../../../../lib/api/errors';

export async function GET(request, { params }) {
    // Rate limit downloads to prevent API quota exhaustion
    const rateLimitResult = applyRateLimit(request, 'download');

    if (!rateLimitResult.allowed) {
        return rateLimitResult.response;
    }

    const { driveId } = await params;
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    console.log('[Download API] Starting download for driveId:', driveId, 'event:', eventId);

    try {
        // CRITICAL: Require eventId for multi-tenancy isolation
        if (!eventId) {
            throw new ValidationError('eventId is required for data isolation');
        }

        // Get photo metadata for better filename
        const photoRepo = new PhotoRepository();

        // CRITICAL: Get only photos for this event
        const eventPhotos = await photoRepo.findMany({
            where: { eventId }, // CRITICAL: Filter by eventId to prevent data leaks
        });

        console.log('[Download API] Total photos in event', eventId, ':', eventPhotos.length);

        const photo = eventPhotos.find(p => p.driveId === driveId);
        console.log('[Download API] Found photo in event:', photo ? 'YES' : 'NO');

        // CRITICAL: Security check - verify photo belongs to this event
        if (!photo) {
            console.warn(`[Download API] Attempted to download photo ${driveId} not in event ${eventId}`);
            return NextResponse.json(
                { error: 'Photo not found in this event' },
                { status: 403 }
            );
        }

        // Generate clean filename
        let filename = 'photo.jpg';
        if (photo) {
            const timestamp = new Date(photo.timestamp).getTime();
            const poseSlug = photo.poseId
                ? photo.poseId
                    .replace(/[^a-zA-Z0-9]/g, '-')  // Replace special chars with dash
                    .replace(/-+/g, '-')             // Collapse multiple dashes
                    .replace(/^-|-$/g, '')           // Remove leading/trailing dashes
                    .toLowerCase()
                : 'photo';
            filename = `${poseSlug}-${timestamp}.jpg`;
        } else {
            // Fallback to timestamp-based filename
            filename = `photo-${Date.now()}.jpg`;
        }
        console.log('[Download API] Generated filename:', filename);

        // Check storage provider
        const provider = getProviderName();
        console.log('[Download API] Storage provider:', provider);

        if (provider === 'cloudinary') {
            // Cloudinary: Redirect to original URL with download parameter
            // Cloudinary serves original quality by default (no optimization params)
            const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

            // Check if driveId is already a full URL or a public_id
            let downloadUrl;
            if (driveId.startsWith('http')) {
                // Already a full URL - add download flag
                downloadUrl = `${driveId}?fl_attachment:${filename}`;
            } else {
                // Public ID - construct URL with download flag
                downloadUrl = `https://res.cloudinary.com/${cloudName}/image/upload/fl_attachment:${filename}/${driveId}`;
            }

            console.log('[Download API] Redirecting to Cloudinary:', downloadUrl);
            return NextResponse.redirect(downloadUrl);
        } else {
            // Google Drive: Proxy download through our API
            console.log('[Download API] Requesting file from storage...');

            // Use centralized stream utility (provider-agnostic)
            const buffer = await downloadDriveFile(getPhotoStream, driveId);

            console.log('[Download API] File downloaded, size:', buffer.length);

            console.log('[Download API] Sending response with headers:', {
                'Content-Type': 'image/jpeg',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': buffer.length.toString(),
            });

            return new NextResponse(buffer, {
                headers: {
                    'Content-Type': 'image/jpeg',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                    'Content-Length': buffer.length.toString(),
                },
            });
        }
    } catch (error) {
        console.error('[Download API] Error:', error);
        console.error('[Download API] Error stack:', error.stack);

        // Re-throw ValidationError (like missing eventId) without fallback
        if (error instanceof ValidationError) {
            return NextResponse.json(
                { error: error.message },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to download photo', details: error.message },
            { status: 500 }
        );
    }
}
