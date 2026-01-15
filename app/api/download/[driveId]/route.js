import { NextResponse } from 'next/server';
import { getFileStream } from '../../../../lib/googleDrive';
import { getPhotos } from '../../../../lib/photoStorage';

export async function GET(request, { params }) {
    const { driveId } = await params;
    console.log('[Download API] Starting download for driveId:', driveId);

    try {
        // Get photo metadata for better filename
        const photos = getPhotos();
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

        console.log('[Download API] Requesting file stream from Google Drive...');
        const response = await getFileStream(driveId);
        console.log('[Download API] Response received:', response);
        const stream = response.stream;
        console.log('[Download API] Stream extracted, type:', typeof stream, 'has on method:', typeof stream.on);

        // Convert Node stream to buffer
        const chunks = [];
        let totalBytes = 0;

        await new Promise((resolve, reject) => {
            stream.on('data', (chunk) => {
                chunks.push(chunk);
                totalBytes += chunk.length;
                console.log('[Download API] Received chunk, size:', chunk.length, 'total so far:', totalBytes);
            });
            stream.on('end', () => {
                console.log('[Download API] Stream ended, total bytes:', totalBytes);
                resolve();
            });
            stream.on('error', (err) => {
                console.error('[Download API] Stream error:', err);
                reject(err);
            });
        });

        const buffer = Buffer.concat(chunks);
        console.log('[Download API] Buffer created, size:', buffer.length);

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
    } catch (error) {
        console.error('[Download API] Error:', error);
        console.error('[Download API] Error stack:', error.stack);
        return NextResponse.json(
            { error: 'Failed to download photo', details: error.message },
            { status: 500 }
        );
    }
}
