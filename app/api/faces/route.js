import { NextResponse } from 'next/server';
import { getAllFaces, saveFaceDescriptor } from '../../../lib/faceStorage';

// GET /api/faces - Retrieve all known face descriptors
export async function GET() {
    try {
        const faces = await getAllFaces();
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

        // 1. Validate faceId format (prevent XSS)
        if (!faceId || typeof faceId !== 'string') {
            return NextResponse.json(
                { error: 'Invalid faceId. Must be a string.' },
                { status: 400 }
            );
        }

        // SECURITY: Only allow person_N format (prevent XSS injection)
        if (!/^person_\d+$/.test(faceId)) {
            return NextResponse.json(
                { error: 'Invalid faceId format. Expected: person_N (e.g., person_1, person_2)' },
                { status: 400 }
            );
        }

        // 2. Validate descriptor is array of exactly 128 numbers
        if (!Array.isArray(descriptor)) {
            return NextResponse.json(
                { error: 'Descriptor must be an array' },
                { status: 400 }
            );
        }

        if (descriptor.length !== 128) {
            return NextResponse.json(
                { error: `Descriptor must have exactly 128 dimensions (got ${descriptor.length})` },
                { status: 400 }
            );
        }

        // Validate all descriptor values are finite numbers
        const validDescriptor = descriptor.every(
            val => typeof val === 'number' && isFinite(val) && !isNaN(val)
        );

        if (!validDescriptor) {
            return NextResponse.json(
                { error: 'Descriptor must contain only finite numbers' },
                { status: 400 }
            );
        }

        // 3. Sanitize metadata (prevent data corruption and XSS)
        const sanitizedMetadata = metadata ? {
            // Only allow safe numeric photoCount
            photoCount: typeof metadata.photoCount === 'number' && isFinite(metadata.photoCount)
                ? Math.max(0, Math.floor(metadata.photoCount))
                : 0,
            // Safe ISO timestamp
            timestamp: metadata.timestamp || new Date().toISOString(),
            // DO NOT allow arbitrary metadata fields that could contain scripts/HTML
        } : {
            photoCount: 0,
            timestamp: new Date().toISOString()
        };

        const savedFace = await saveFaceDescriptor(faceId, descriptor, sanitizedMetadata);

        return NextResponse.json({
            success: true,
            face: savedFace
        });
    } catch (error) {
        console.error('[Faces API] Error saving face:', error);
        return NextResponse.json({ error: 'Failed to save face' }, { status: 500 });
    }
}
