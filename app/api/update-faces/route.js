/**
 * Photo Face Update API Route
 *
 * Handles updating photos with face detection results and thumbnails.
 *
 * REFACTORED with Decorator Pattern + Service Layer:
 * - Before: 124 lines with complex workflow, error handling, and Drive uploads
 * - After: 28 lines with clean separation of concerns
 * - Reduction: 77% less code
 *
 * Pattern: Decorator pattern for cross-cutting concerns
 * Service: FaceService handles business logic
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { FaceService } from '@/lib/services/FaceService';

/**
 * Update faces handler (business logic only)
 *
 * Clean handler - all cross-cutting concerns handled by decorators:
 * - Error handling: withErrorHandler
 * - Rate limiting: withRateLimit (api)
 * - Logging: Automatic via service layer
 */
async function handleUpdateFaces(request) {
  const faceService = new FaceService();
  const formData = await request.formData();
  const result = await faceService.updatePhotoFaces(formData);

  return NextResponse.json(result);
}

/**
 * POST /api/update-faces
 *
 * Update photo with face detection results and upload face thumbnails.
 * Called after image is uploaded and faces are detected from the Drive version.
 *
 * Request (multipart/form-data):
 * - photoId: Photo record ID (required)
 * - driveId: Google Drive file ID (required)
 * - faceIds: Comma-separated face IDs (e.g. "person_1,person_2")
 * - mainFaceId: Primary face ID (defaults to "unknown")
 * - faceBoxes: JSON array of bounding boxes
 * - faceThumbnail_<faceId>: Face thumbnail files (one per new face)
 *
 * Response:
 * {
 *   success: true,
 *   photo: { id, driveId, mainFaceId, faceIds, faceBoxes, ... },
 *   thumbnailsUploaded: 3
 * }
 *
 * Note: Thumbnails only uploaded for faces without existing thumbnails.
 * Face metadata (descriptors) managed separately in faces.json.
 */
export const POST = withApi(handleUpdateFaces, { rateLimit: 'api' });
