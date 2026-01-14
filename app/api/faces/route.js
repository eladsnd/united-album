import { NextResponse } from 'next/server';
import { getAllFaces, saveFaceDescriptor } from '../../../lib/faceStorage';

// GET /api/faces - Retrieve all known face descriptors
export async function GET() {
    try {
        const faces = getAllFaces();
        return NextResponse.json(faces);
    } catch (error) {
        console.error('[Faces API] Error fetching faces:', error);
        return NextResponse.json({ error: 'Failed to fetch faces' }, { status: 500 });
    }
}

// POST /api/faces - Save a new face descriptor
export async function POST(request) {
    try {
        const { faceId, descriptor, metadata } = await request.json();

        if (!faceId || !descriptor) {
            return NextResponse.json(
                { error: 'faceId and descriptor are required' },
                { status: 400 }
            );
        }

        const savedFace = saveFaceDescriptor(faceId, descriptor, metadata);

        return NextResponse.json({
            success: true,
            face: savedFace
        });
    } catch (error) {
        console.error('[Faces API] Error saving face:', error);
        return NextResponse.json({ error: 'Failed to save face' }, { status: 500 });
    }
}
