/**
 * Photo Service (Service Layer Pattern)
 *
 * Handles business logic for photo operations.
 *
 * Responsibilities:
 * - Photo deletion coordination
 * - Permission validation
 * - Orphaned face cleanup
 * - Google Drive integration
 *
 * REFACTORED with Repository Pattern:
 * - Uses PhotoRepository instead of photoStorage functions
 * - Uses FaceRepository instead of faceStorage functions
 * - Clean separation between business logic and data access
 */

import { PhotoRepository } from '../repositories/PhotoRepository.js';
import { FaceRepository } from '../repositories/FaceRepository.js';
import { deletePhoto } from '../storage/operations';
import { ValidationError, NotFoundError, UnauthorizedError, InternalServerError } from '../api/errors';

export class PhotoService {
  constructor() {
    this.photoRepo = new PhotoRepository();
    this.faceRepo = new FaceRepository();
  }
  /**
   * Delete a photo with permission check and orphaned face cleanup
   *
   * Workflow:
   * 1. Validate photoId
   * 2. Find photo in database
   * 3. Check permissions (admin OR photo owner)
   * 4. Delete from Google Drive
   * 5. Delete from database
   * 6. Clean up orphaned faces and their thumbnails
   *
   * @param {number} photoId - Photo record ID
   * @param {string|null} uploaderId - Client session ID (null for admin)
   * @param {boolean} isAdmin - Whether request is from admin
   * @returns {Promise<{success: boolean, deletedPhoto: Object, orphanedFaces: string[], message: string}>}
   * @throws {ValidationError} When photoId is invalid
   * @throws {NotFoundError} When photo doesn't exist
   * @throws {UnauthorizedError} When user lacks permission
   * @throws {InternalServerError} When deletion fails
   */
  async deletePhoto(photoId, uploaderId, isAdmin) {
    // Step 1: Validate photoId
    if (!photoId || isNaN(photoId)) {
      throw new ValidationError('photoId is required and must be a number');
    }

    console.log(`[PhotoService] Delete request for photo ${photoId} by ${isAdmin ? 'ADMIN' : `uploader ${uploaderId}`}`);

    // Step 2: Find the photo
    const photos = await this.photoRepo.findAll();
    const photo = photos.find(p => p.id === photoId);

    if (!photo) {
      console.error(`[PhotoService] Photo ${photoId} not found`);
      throw new NotFoundError(`Photo ${photoId} not found`);
    }

    // Step 3: Check permissions
    const canDelete = isAdmin || (uploaderId && photo.uploaderId === uploaderId);

    if (!canDelete) {
      console.error(`[PhotoService] Permission denied. Photo uploader: ${photo.uploaderId}, Requester: ${uploaderId}, IsAdmin: ${isAdmin}`);
      throw new UnauthorizedError('You can only delete photos you uploaded');
    }

    console.log(`[PhotoService] Permission verified. Deleting photo: ${photo.name}, driveId: ${photo.driveId}`);

    // Step 4: Delete from Google Drive
    try {
      await deletePhoto(photo.driveId);
      console.log(`[PhotoService] Deleted from Google Drive: ${photo.driveId}`);
    } catch (driveError) {
      console.error(`[PhotoService] Failed to delete from Drive:`, driveError);
      throw new InternalServerError(
        `Failed to delete from Google Drive: ${driveError.message}`,
        'DRIVE_DELETE_FAILED'
      );
    }

    // Step 5: Delete from database
    try {
      await this.photoRepo.deleteByDriveId(photo.driveId);
    } catch (error) {
      throw new InternalServerError(
        'Failed to delete photo metadata',
        'METADATA_DELETE_FAILED'
      );
    }

    console.log(`[PhotoService] Successfully deleted photo ${photoId} from both Drive and database`);

    // Step 6: Clean up orphaned faces
    const orphanedFaces = await this._cleanupOrphanedFaces(photo);

    const message = orphanedFaces.length > 0
      ? `Photo permanently deleted. ${orphanedFaces.length} orphaned face thumbnail(s) also removed.`
      : 'Photo permanently deleted from Drive and album.';

    return {
      success: true,
      deletedPhoto: photo,
      orphanedFaces,
      message,
    };
  }

  /**
   * Clean up faces that no longer appear in any photos
   * Private helper method
   *
   * @private
   * @param {Object} deletedPhoto - The photo that was deleted
   * @returns {Promise<string[]>} Array of orphaned face IDs
   */
  async _cleanupOrphanedFaces(deletedPhoto) {
    const facesInDeletedPhoto = deletedPhoto.faceIds || [deletedPhoto.mainFaceId || deletedPhoto.faceId].filter(Boolean);
    const remainingPhotos = await this.photoRepo.findAll(); // Get updated list after deletion
    const orphanedFaces = [];

    for (const faceId of facesInDeletedPhoto) {
      if (!faceId || faceId === 'unknown') continue;

      // Count how many photos still contain this face
      const photosWithThisFace = remainingPhotos.filter(p => {
        const photoFaces = p.faceIds || [p.mainFaceId || p.faceId].filter(Boolean);
        return photoFaces.includes(faceId);
      });

      if (photosWithThisFace.length === 0) {
        // This face is orphaned - no photos contain it anymore
        console.log(`[PhotoService] Face ${faceId} is orphaned (no photos remaining)`);

        const faceData = await this.faceRepo.findByFaceId(faceId);
        if (faceData && faceData.thumbnailDriveId) {
          try {
            // Delete thumbnail from Google Drive
            await deletePhoto(faceData.thumbnailDriveId);
            console.log(`[PhotoService] Deleted orphaned thumbnail from Drive: ${faceData.thumbnailDriveId}`);
          } catch (thumbError) {
            console.error(`[PhotoService] Failed to delete thumbnail from Drive:`, thumbError);
            // Continue cleanup even if thumbnail deletion fails
          }
        }

        // Delete face from database (if it exists)
        try {
          await this.faceRepo.deleteByFaceId(faceId);
          orphanedFaces.push(faceId);
        } catch (deleteError) {
          // Face record might not exist (e.g., bulk uploaded photos with mainFaceId='unknown')
          // This is not an error - just log and continue
          if (deleteError.statusCode === 404) {
            console.log(`[PhotoService] Face ${faceId} record not found in database (already deleted or never created)`);
          } else {
            console.error(`[PhotoService] Failed to delete face ${faceId}:`, deleteError);
          }
        }
      }
    }

    if (orphanedFaces.length > 0) {
      console.log(`[PhotoService] Cleaned up ${orphanedFaces.length} orphaned faces: ${orphanedFaces.join(', ')}`);
    }

    return orphanedFaces;
  }
}
