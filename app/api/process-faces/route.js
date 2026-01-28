/**
 * Background Face Processing API
 *
 * Processes face detection for photos that don't have face data yet.
 * Can be triggered manually or automatically after bulk uploads.
 *
 * This runs face detection on photos where mainFaceId === 'unknown'
 */

import { NextResponse } from 'next/server';
import { ValidationError } from '@/lib/api/errors';
import prisma from '@/lib/prisma';

export async function POST(request) {
  try {
    const { photoIds, eventId } = await request.json();

    // CRITICAL: Require eventId for multi-tenancy isolation
    if (!eventId) {
      throw new ValidationError('eventId is required for data isolation');
    }

    // Find photos needing face processing (event-scoped)
    let photosToProcess;
    if (photoIds && photoIds.length > 0) {
      // Process specific photos (CRITICAL: filter by eventId)
      photosToProcess = await prisma.photo.findMany({
        where: {
          id: { in: photoIds },
          mainFaceId: 'unknown',
          eventId: eventId // CRITICAL: Filter by eventId to prevent processing other events' photos
        }
      });
    } else {
      // Process all photos without face data for this event
      photosToProcess = await prisma.photo.findMany({
        where: {
          mainFaceId: 'unknown',
          eventId: eventId // CRITICAL: Filter by eventId to prevent data leaks
        },
        take: 50 // Process max 50 at a time to avoid timeout
      });
    }

    console.log(`[ProcessFaces] Found ${photosToProcess.length} photos to process for event ${eventId}`);

    // Return the list of photos that need processing
    // Client will handle the actual face detection
    return NextResponse.json({
      success: true,
      photosToProcess: photosToProcess.map(p => ({
        id: p.id,
        driveId: p.driveId,
        url: p.url
      })),
      count: photosToProcess.length
    });

  } catch (error) {
    console.error('[ProcessFaces] Error:', error);

    // Re-throw ValidationError (like missing eventId) without fallback
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET - Check how many photos need face processing for event
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    // CRITICAL: Require eventId for multi-tenancy isolation
    if (!eventId) {
      throw new ValidationError('eventId is required for data isolation');
    }

    // CRITICAL: Count only photos for this event
    const count = await prisma.photo.count({
      where: {
        mainFaceId: 'unknown',
        eventId: eventId // CRITICAL: Filter by eventId to prevent data leaks
      }
    });

    console.log(`[ProcessFaces] Found ${count} photos needing processing for event ${eventId}`);

    return NextResponse.json({
      success: true,
      pendingCount: count
    });
  } catch (error) {
    console.error('[ProcessFaces] Error checking count:', error);

    // Re-throw ValidationError (like missing eventId) without fallback
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
