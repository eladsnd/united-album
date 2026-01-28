import { NextResponse } from 'next/server';
import { FaceRepository } from '../../../lib/repositories/FaceRepository.js';
import { PhotoRepository } from '../../../lib/repositories/PhotoRepository.js';
import { ValidationError } from '../../../lib/api/errors';

// GET /api/faces - Retrieve face descriptors for current event
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const eventId = searchParams.get('eventId');

        // CRITICAL: Require eventId for multi-tenancy isolation
        if (!eventId) {
            throw new ValidationError('eventId is required for data isolation');
        }

        const faceRepo = new FaceRepository();
        const photoRepo = new PhotoRepository();

        // Get all photos for this event FIRST
        const eventPhotos = await photoRepo.findMany({
            where: { eventId }, // CRITICAL: Filter by eventId
        });

        // Extract all face IDs that appear in this event's photos
        const eventFaceIds = new Set();
        eventPhotos.forEach(photo => {
            if (photo.mainFaceId && photo.mainFaceId !== 'unknown') {
                eventFaceIds.add(photo.mainFaceId);
            }
            if (photo.faceIds && Array.isArray(photo.faceIds)) {
                photo.faceIds.forEach(faceId => {
                    if (faceId && faceId !== 'unknown') {
                        eventFaceIds.add(faceId);
                    }
                });
            }
        });

        // Get all faces from database
        const allFaces = await faceRepo.findAll();

        // CRITICAL: Filter to only faces that appear in this event
        const eventFaces = allFaces.filter(face => eventFaceIds.has(face.faceId));

        console.log(`[Faces API] Returning ${eventFaces.length} faces for event ${eventId} (filtered from ${allFaces.length} total)`);

        return NextResponse.json(eventFaces);
    } catch (error) {
        console.error('[Faces API] Error fetching faces:', error);

        // Re-throw ValidationError (like missing eventId) without fallback
        if (error instanceof ValidationError) {
            return NextResponse.json(
                { error: error.message },
                { status: 400 }
            );
        }

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

        // SECURITY: Only allow person_N or {eventId}_person_N format (prevent XSS injection)
        // Allowed formats: "person_1", "person_2", "event-abc_person_1", "event-xyz_person_2"
        if (!/^([a-zA-Z0-9-_]+_)?person_\d+$/.test(faceId)) {
            return NextResponse.json(
                { error: 'Invalid faceId format. Expected: person_N or {eventId}_person_N' },
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

        const faceRepo = new FaceRepository();
        const savedFace = await faceRepo.saveDescriptor(faceId, descriptor, sanitizedMetadata);

        return NextResponse.json({
            success: true,
            face: savedFace
        });
    } catch (error) {
        console.error('[Faces API] Error saving face:', error);
        return NextResponse.json({ error: 'Failed to save face' }, { status: 500 });
    }
}
