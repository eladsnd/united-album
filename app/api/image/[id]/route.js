import { getFileStream } from '../../../../lib/googleDrive';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
    const { id } = await params;

    try {
        const { stream, contentType } = await getFileStream(id);

        return new Response(stream, {
            headers: {
                'Content-Type': contentType || 'image/jpeg',
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (error) {
        console.error('[Image Proxy] Error:', error.message);
        return new NextResponse('Image not found or access denied', { status: 404 });
    }
}
