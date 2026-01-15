import { NextResponse } from 'next/server';
import { getFileStream } from '../../../../lib/googleDrive';
import sharp from 'sharp';

// GET /api/face-crop/[driveId] - Serve cropped face image
export async function GET(request, { params }) {
    try {
        const { driveId } = await params; // Next.js 15+ requires awaiting params
        const { searchParams } = new URL(request.url);

        const x = parseInt(searchParams.get('x') || '0');
        const y = parseInt(searchParams.get('y') || '0');
        const w = parseInt(searchParams.get('w') || '100');
        const h = parseInt(searchParams.get('h') || '100');

        console.log(`[Face Crop API] driveId: ${driveId}, crop: {x:${x}, y:${y}, w:${w}, h:${h}}`);

        if (!driveId) {
            console.error('[Face Crop API] Missing driveId parameter');
            return NextResponse.json({ error: 'Missing driveId' }, { status: 400 });
        }

        // Get the full image from Google Drive
        const { stream: imageStream } = await getFileStream(driveId);

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

        console.log(`[Face Crop API] Image size: ${imageWidth}x${imageHeight}`);

        // Crop the face region with some padding, ensuring we stay within bounds
        const padding = Math.round(Math.max(w, h) * 0.2); // 20% padding
        const cropX = Math.max(0, Math.min(x - padding, imageWidth - 1));
        const cropY = Math.max(0, Math.min(y - padding, imageHeight - 1));

        // Calculate crop dimensions, ensuring we don't exceed image bounds
        const maxCropW = imageWidth - cropX;
        const maxCropH = imageHeight - cropY;
        const cropW = Math.min(w + (padding * 2), maxCropW);
        const cropH = Math.min(h + (padding * 2), maxCropH);

        console.log(`[Face Crop API] Crop: {left:${cropX}, top:${cropY}, width:${cropW}, height:${cropH}}`);

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
        console.error('[Face Crop API] Error:', error);
        return NextResponse.json({ error: 'Failed to crop face' }, { status: 500 });
    }
}
