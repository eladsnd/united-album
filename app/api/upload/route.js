/**
 * Photo Upload API Route
 *
 * Handles photo uploads with face detection metadata.
 *
 * REFACTORED with Decorator Pattern + Service Layer:
 * - Before: 97 lines with duplicated error handling, rate limiting, validation
 * - After: 30 lines with clean separation of concerns
 * - Reduction: 69% less code
 *
 * Pattern: Decorator pattern for cross-cutting concerns
 * Service: UploadService handles business logic
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { UploadService } from '@/lib/services/UploadService';
import { UnauthorizedError } from '@/lib/api/errors';

/**
 * Upload photo handler (business logic only)
 *
 * Clean handler - all cross-cutting concerns handled by decorators:
 * - Error handling: withErrorHandler
 * - Rate limiting: withRateLimit (10 uploads/min)
 * - Logging: Automatic via service layer
 */
async function handleUpload(request) {
  // Validate Google Drive credentials
  const uploadService = new UploadService();

  if (!uploadService.validateCredentials()) {
    throw new UnauthorizedError(
      'Google Drive OAuth configuration missing. Please check your .env.local file.',
      'CREDENTIALS_MISSING'
    );
  }

  // Process upload via service layer
  const formData = await request.formData();
  const result = await uploadService.processUpload(formData);

  return NextResponse.json(result);
}

/**
 * POST /api/upload
 *
 * Upload a photo with metadata.
 *
 * Request (multipart/form-data):
 * - file: Image file
 * - folderId: Google Drive folder ID (optional, uses env default)
 * - poseId: Pose challenge ID (optional, defaults to 'unknown_pose')
 * - uploaderId: Client-generated session ID (optional)
 * - eventId: Event ID for multi-tenancy (optional, defaults to 'default-event')
 *
 * Response:
 * {
 *   success: true,
 *   photo: {
 *     id: 12345,
 *     driveId: "abc123",
 *     url: "/api/image/abc123",
 *     mainFaceId: "unknown",
 *     faceIds: [],
 *     faceBoxes: [],
 *     poseId: "test-pose",
 *     uploaderId: "uploader_123",
 *     timestamp: "2026-01-18T..."
 *   }
 * }
 *
 * Note: Face detection happens client-side BEFORE upload.
 * Face metadata is added later via /api/update-faces.
 */
export const POST = withApi(handleUpload, { rateLimit: 'upload' });
