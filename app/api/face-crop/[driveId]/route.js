import { NextResponse } from 'next/server';
import { getFileStream } from '../../../../lib/googleDrive';
import sharp from 'sharp';

// GET /api/face-crop/[driveId] - Serve cropped face image
export async function GET(request, { params }) {
    try {
        const { driveId } = params;
        const { searchParams } = new URL(request.url);

        const x = parseInt(searchParams.get('x') || '0');
        const y = parseInt(searchParams.get('y') || '0');
        const w = parseInt(searchParams.get('w') || '100');
        const h = parseInt(searchParams.get('h') || '100');

        // Get the full image from Google Drive
        const { stream: imageStream } = await getFileStream(driveId);

        // Convert stream to buffer
        const chunks = [];
        for await (const chunk of imageStream) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        // Crop the face region with some padding
        const padding = Math.round(Math.max(w, h) * 0.2); // 20% padding
        const cropX = Math.max(0, x - padding);
        const cropY = Math.max(0, y - padding);
        const cropW = w + (padding * 2);
        const cropH = h + (padding * 2);

        const croppedImage = await sharp(buffer)
            .extract({
                left: cropX,
                top: cropY,
                width: cropW,
                height: cropH
            })
            .resize(200, 200, { fit: 'cover' }) // Resize to thumbnail size
            .jpeg({ quality: 85 })
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
