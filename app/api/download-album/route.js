import { NextResponse } from 'next/server';
import { getPhotos } from '../../../lib/photoStorage';
import { getFileStream } from '../../../lib/googleDrive';
import JSZip from 'jszip';

export async function POST(request) {
    try {
        const { photoIds } = await request.json();

        if (!photoIds || !Array.isArray(photoIds)) {
            return NextResponse.json(
                { error: 'photoIds array is required' },
                { status: 400 }
            );
        }

        const photos = getPhotos();
        const selectedPhotos = photos.filter(p => photoIds.includes(p.id));

        const zip = new JSZip();

        // Download each photo and add to ZIP
        for (const photo of selectedPhotos) {
            try {
                const stream = await getFileStream(photo.driveId);
                const chunks = [];

                for await (const chunk of stream) {
                    chunks.push(chunk);
                }

                const buffer = Buffer.concat(chunks);
                const filename = `${photo.poseId || 'photo'}-${photo.id}.jpg`;
                zip.file(filename, buffer);
            } catch (err) {
                console.error(`Failed to add photo ${photo.id}:`, err);
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
