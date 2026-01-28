import { NextResponse } from 'next/server';
import { getFileStream } from '../../../../lib/storage/googleDrive';
import { PhotoRepository } from '../../../../lib/repositories/PhotoRepository.js';
import { applyRateLimit } from '../../../../lib/middleware/rateLimit';
import { downloadDriveFile } from '../../../../lib/utils/streamUtils';
import { getProviderName } from '../../../../lib/storage/operations';

export async function GET(request, { params }) {
    // Rate limit downloads to prevent API quota exhaustion
    const rateLimitResult = applyRateLimit(request, 'download');

    if (!rateLimitResult.allowed) {
        return rateLimitResult.response;
    }

    const { driveId } = await params;
    console.log('[Download API] Starting download for driveId:', driveId);

    try {
        // Get photo metadata for better filename
        const photoRepo = new PhotoRepository();
        const photos = await photoRepo.findAll();
        console.log('[Download API] Total photos in storage:', photos.length);

        const photo = photos.find(p => p.driveId === driveId);
        console.log('[Download API] Found photo metadata:', photo ? 'YES' : 'NO', photo);

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
            console.log('[Download API] Requesting file from Google Drive...');

            // Use centralized stream utility (DRY principle)
            const buffer = await downloadDriveFile(getFileStream, driveId);

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
        return NextResponse.json(
            { error: 'Failed to download photo', details: error.message },
            { status: 500 }
        );
    }
}
