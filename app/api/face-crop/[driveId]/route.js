import { NextResponse } from 'next/server';
import { getPhotoStream } from '../../../../lib/storage/operations';
import { PhotoRepository } from '../../../../lib/repositories/PhotoRepository.js';
import { ValidationError } from '../../../../lib/api/errors';
import sharp from 'sharp';

// GET /api/face-crop/[driveId] - Serve cropped face image (provider-agnostic, event-scoped)
export async function GET(request, { params }) {
    try {
        const { driveId } = await params; // Next.js 15+ requires awaiting params
        const { searchParams } = new URL(request.url);

        const eventId = searchParams.get('eventId');
        let x = parseInt(searchParams.get('x') || '0');
        let y = parseInt(searchParams.get('y') || '0');
        let w = parseInt(searchParams.get('w') || '100');
        let h = parseInt(searchParams.get('h') || '100');

        console.log(`[Face Crop API] fileId: ${driveId}, event: ${eventId}, crop: {x:${x}, y:${y}, w:${w}, h:${h}}`);

        if (!driveId) {
            console.error('[Face Crop API] Missing file ID parameter');
            return NextResponse.json({ error: 'Missing file ID' }, { status: 400 });
        }

        // CRITICAL: Require eventId for multi-tenancy isolation
        if (!eventId) {
            throw new ValidationError('eventId is required for data isolation');
        }

        // CRITICAL: Verify photo belongs to event
        const photoRepo = new PhotoRepository();
        const eventPhotos = await photoRepo.findMany({
            where: { eventId }, // CRITICAL: Filter by eventId
        });

        const photo = eventPhotos.find(p => p.driveId === driveId);

        if (!photo) {
            console.warn(`[Face Crop API] Photo ${driveId} not found in event ${eventId}`);
            return NextResponse.json({ error: 'Photo not found in this event' }, { status: 403 });
        }

        console.log(`[Face Crop API] Verified photo ${driveId} belongs to event ${eventId}`);

        // Get the full image from storage provider
        const { stream: imageStream } = await getPhotoStream(driveId);

        // Convert stream to buffer
        const chunks = [];
        for await (const chunk of imageStream) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        // Get image metadata to validate crop bounds
        const image = sharp(buffer);
        const metadata = await image.metadata();
        const imageWidth = metadata.width;
        const imageHeight = metadata.height;

        console.log(`[Face Crop API] Image size: ${imageWidth}x${imageHeight}, requested crop: {x:${x}, y:${y}, w:${w}, h:${h}}`);

        // CRITICAL: Google Drive may have resized the image from its original size
        // We need to detect if coordinates are out of bounds and scale them proportionally
        let scaleX = 1;
        let scaleY = 1;

        // If crop coordinates exceed image dimensions, assume image was resized
        if (x + w > imageWidth || y + h > imageHeight) {
            // Calculate scale factors based on which dimension is more constrained
            if (x + w > imageWidth) {
                scaleX = imageWidth / (x + w);
            }
            if (y + h > imageHeight) {
                scaleY = imageHeight / (y + h);
            }

            // Use the smaller scale to ensure everything fits
            const scale = Math.min(scaleX, scaleY);
            console.log(`[Face Crop API] Image was resized! Scaling coordinates by ${scale.toFixed(3)}`);

            // Apply scaling
            const scaledX = Math.round(x * scale);
            const scaledY = Math.round(y * scale);
            const scaledW = Math.round(w * scale);
            const scaledH = Math.round(h * scale);

            console.log(`[Face Crop API] Scaled crop: {x:${scaledX}, y:${scaledY}, w:${scaledW}, h:${scaledH}}`);

            // Update coordinates
            x = scaledX;
            y = scaledY;
            w = scaledW;
            h = scaledH;
        }

        // Crop the face region with some padding, ensuring we stay within bounds
        const padding = Math.round(Math.max(w, h) * 0.2); // 20% padding
        const cropX = Math.max(0, Math.min(x - padding, imageWidth - w));
        const cropY = Math.max(0, Math.min(y - padding, imageHeight - h));

        // Calculate crop dimensions, ensuring we don't exceed image bounds
        const maxCropW = imageWidth - cropX;
        const maxCropH = imageHeight - cropY;
        const cropW = Math.min(w + (padding * 2), maxCropW);
        const cropH = Math.min(h + (padding * 2), maxCropH);

        console.log(`[Face Crop API] Final crop: {left:${cropX}, top:${cropY}, width:${cropW}, height:${cropH}}`);

        const croppedImage = await sharp(buffer)
            .extract({
                left: cropX,
                top: cropY,
                width: cropW,
                height: cropH
            })
            .resize(120, 120, {
                fit: 'cover',
                position: 'center'
            }) // Resize to 2x thumbnail size for retina displays (60px * 2)
            .jpeg({ quality: 90 })
            .toBuffer();

        return new NextResponse(croppedImage, {
            headers: {
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        });
    } catch (error) {
        console.warn('[Face Crop API] Error - returning placeholder:', error.message);

        // Return a small placeholder SVG for missing face thumbnails
        const placeholderSvg = `
            <svg width="120" height="120" xmlns="http://www.w3.org/2000/svg">
                <rect width="120" height="120" fill="#f8f1e5"/>
                <circle cx="60" cy="60" r="35" fill="#d4af37" opacity="0.3"/>
                <text x="50%" y="55%" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" fill="#2c3e50">👤</text>
            </svg>
        `;

        return new NextResponse(placeholderSvg, {
            status: 200,
            headers: {
                'Content-Type': 'image/svg+xml',
                'Cache-Control': 'public, max-age=60', // Cache for 1 minute only
            },
        });
    }
}
