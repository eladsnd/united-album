/**
 * Photo Delete API Route
 *
 * Handles photo deletion with permission checks and orphaned face cleanup.
 *
 * REFACTORED with Decorator Pattern + Service Layer:
 * - Before: 122 lines with complex permission logic, Drive deletion, orphan cleanup
 * - After: 39 lines with clean separation of concerns
 * - Reduction: 68% less code
 *
 * Pattern: Decorator pattern for cross-cutting concerns
 * Service: PhotoService handles business logic
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { PhotoService } from '@/lib/services/PhotoService';
import { isAdminAuthenticated } from '@/lib/adminAuth';

/**
 * Delete photo handler (business logic only)
 *
 * Clean handler - all cross-cutting concerns handled by decorators:
 * - Error handling: withErrorHandler
 * - Logging: Automatic via service layer
 */
async function handleDeletePhoto(request) {
  const { searchParams } = new URL(request.url);
  const photoId = parseInt(searchParams.get('photoId'));
  const uploaderId = searchParams.get('uploaderId');
  const isAdmin = isAdminAuthenticated(request);

  const photoService = new PhotoService();
  const result = await photoService.deletePhoto(photoId, uploaderId, isAdmin);

  return NextResponse.json(result);
}

/**
 * DELETE /api/delete-photo?photoId=123&uploaderId=xxx
 *
 * Delete a photo from the album AND Google Drive.
 *
 * Security: Only the uploader can delete their own photos, OR admin can delete any photo.
 *
 * Query Parameters:
 * - photoId: Photo record ID (required)
 * - uploaderId: Client session ID (required for non-admin users)
 *
 * Headers:
 * - Authorization: Bearer <admin-token> (for admin access)
 *
 * Response:
 * {
 *   success: true,
 *   deletedPhoto: { id, driveId, name, ... },
 *   orphanedFaces: ["person_3", "person_7"],
 *   message: "Photo permanently deleted. 2 orphaned face thumbnail(s) also removed."
 * }
 *
 * Note: Automatically cleans up orphaned faces when they no longer appear in any photos.
 */
export const DELETE = withApi(handleDeletePhoto);
