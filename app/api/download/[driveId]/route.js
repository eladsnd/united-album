import { NextResponse } from 'next/server';
import { getFileStream } from '../../../../lib/googleDrive';
import { getPhotos } from '../../../../lib/photoStorage';

export async function GET(request, { params }) {
    const { driveId } = await params;

    try {
        // Get photo metadata for better filename
        const photos = getPhotos();
        const photo = photos.find(p => p.driveId === driveId);

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

        const stream = await getFileStream(driveId);

        // Convert Node stream to buffer
        const chunks = [];

        await new Promise((resolve, reject) => {
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('end', () => resolve());
            stream.on('error', (err) => reject(err));
        });

        const buffer = Buffer.concat(chunks);

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'image/jpeg',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': buffer.length.toString(),
            },
        });
    } catch (error) {
        console.error('[Download API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to download photo' },
            { status: 500 }
        );
    }
}
