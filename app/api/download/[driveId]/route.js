import { NextResponse } from 'next/server';
import { getFileStream } from '../../../../lib/googleDrive';

export async function GET(request, { params }) {
    const { driveId } = await params;

    try {
        const stream = await getFileStream(driveId);

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'image/jpeg',
                'Content-Disposition': `attachment; filename="photo-${driveId}.jpg"`,
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
