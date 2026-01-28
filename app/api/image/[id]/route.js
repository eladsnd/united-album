import { getFileStream } from '../../../../lib/storage/googleDrive';
import { NextResponse } from 'next/server';

/**
 * GET /api/image/[id]
 * Proxy endpoint for Google Drive images with fallback placeholder
 */
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
        console.warn(`[Image Proxy] File not found in Drive (${id}):`, error.message);

        // Return a placeholder SVG instead of 404
        const placeholderSvg = `
            <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
                <rect width="400" height="400" fill="#f8f1e5"/>
                <text x="50%" y="45%" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" fill="#d4af37">📷</text>
                <text x="50%" y="60%" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#2c3e50">Image Not Found</text>
                <text x="50%" y="70%" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#999">File may have been deleted</text>
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
