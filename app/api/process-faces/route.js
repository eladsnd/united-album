/**
 * Background Face Processing API
 *
 * Processes face detection for photos that don't have face data yet.
 * Can be triggered manually or automatically after bulk uploads.
 *
 * This runs face detection on photos where mainFaceId === 'unknown'
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request) {
  try {
    const { photoIds } = await request.json();

    // Find photos needing face processing
    let photosToProcess;
    if (photoIds && photoIds.length > 0) {
      // Process specific photos
      photosToProcess = await prisma.photo.findMany({
        where: {
          id: { in: photoIds },
          mainFaceId: 'unknown'
        }
      });
    } else {
      // Process all photos without face data
      photosToProcess = await prisma.photo.findMany({
        where: { mainFaceId: 'unknown' },
        take: 50 // Process max 50 at a time to avoid timeout
      });
    }

    console.log(`[ProcessFaces] Found ${photosToProcess.length} photos to process`);

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
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET - Check how many photos need face processing
 */
export async function GET() {
  try {
    const count = await prisma.photo.count({
      where: { mainFaceId: 'unknown' }
    });

    return NextResponse.json({
      success: true,
      pendingCount: count
    });
  } catch (error) {
    console.error('[ProcessFaces] Error checking count:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
