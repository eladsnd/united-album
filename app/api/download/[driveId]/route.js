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
                ? photo.poseId.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
                : 'photo';
            filename = `${poseSlug}-${timestamp}.jpg`;
        } else {
            // Fallback to timestamp-based filename
            filename = `photo-${Date.now()}.jpg`;
        }

        const stream = await getFileStream(driveId);

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'image/jpeg',
                'Content-Disposition': `attachment; filename="${filename}"`,
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
