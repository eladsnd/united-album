/**
 * Face Service (Service Layer Pattern)
 *
 * Handles business logic for face detection metadata and thumbnails.
 *
 * Responsibilities:
 * - Face thumbnail upload coordination
 * - Face metadata persistence
 * - Photo face data updates
 *
 * REFACTORED with Repository Pattern:
 * - Uses PhotoRepository and FaceRepository instead of storage functions
 * - Clean separation between business logic and data access
 */

import { uploadFaceThumbnail } from '../storage/operations';
import { PhotoRepository } from '../repositories/PhotoRepository.js';
import { FaceRepository } from '../repositories/FaceRepository.js';
import { ValidationError, NotFoundError, InternalServerError } from '../api/errors';

export class FaceService {
  constructor() {
    this.photoRepo = new PhotoRepository();
    this.faceRepo = new FaceRepository();
  }
  /**
   * Update photo with face detection results
   *
   * Workflow:
   * 1. Parse face data from FormData
   * 2. Verify photo belongs to event
   * 3. Upload face thumbnails to storage (if provided)
   * 4. Update face records with thumbnail IDs
   * 5. Update photo metadata with face data
   *
   * @param {FormData} formData - Form data containing face metadata and thumbnails
   * @returns {Promise<{success: boolean, photo: Object, thumbnailsUploaded: number}>}
   * @throws {ValidationError} When photo ID or eventId is invalid
   * @throws {NotFoundError} When photo doesn't exist
   * @throws {InternalServerError} When operations fail
   */
  async updatePhotoFaces(formData) {
    // Step 1: Extract and validate data
    const photoIdStr = formData.get('photoId');
    const photoId = parseInt(photoIdStr);
    const driveId = formData.get('driveId');
    const eventId = formData.get('eventId'); // CRITICAL: Required for multi-tenancy
    const faceIdsStr = formData.get('faceIds') || '';
    const mainFaceId = formData.get('mainFaceId') || 'unknown';
    const faceBoxesStr = formData.get('faceBoxes') || '[]';

    if (isNaN(photoId) || photoId < 0) {
      throw new ValidationError(
        `Invalid photo ID: "${photoIdStr}". Must be a positive integer.`
      );
    }

    if (!eventId) {
      throw new ValidationError('eventId is required for data isolation');
    }

    console.log(`[FaceService] Updating photo ${photoId} in event ${eventId} with face data`);
    console.log(`[FaceService] Main face: ${mainFaceId}, All faces: ${faceIdsStr}`);

    // Step 2: Parse face data
    const faceIdArray = faceIdsStr
      .split(',')
      .map(id => id.trim())
      .filter(id => id);

    let faceBoxes = [];
    try {
      faceBoxes = JSON.parse(faceBoxesStr);
      if (!Array.isArray(faceBoxes)) {
        throw new Error('Face boxes must be an array');
      }
    } catch (e) {
      throw new ValidationError(
        `Invalid face boxes JSON: ${e.message}`
      );
    }

    // Validate face data consistency
    if (faceIdArray.length !== faceBoxes.length) {
      throw new ValidationError(
        `Face data mismatch: ${faceIdArray.length} face IDs but ${faceBoxes.length} face boxes`
      );
    }

    // Step 3: Extract face thumbnails from FormData
    const faceThumbnailFiles = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('faceThumbnail_')) {
        const faceId = key.replace('faceThumbnail_', '');
        faceThumbnailFiles.push({ faceId, file: value });
      }
    }

    console.log(`[FaceService] Found ${faceThumbnailFiles.length} face thumbnails to upload`);

    // Step 3.5: Verify photo belongs to event
    const eventPhotos = await this.photoRepo.findMany({
      where: { eventId }, // CRITICAL: Filter by eventId
    });
    const photo = eventPhotos.find(p => p.id === photoId);

    if (!photo) {
      throw new NotFoundError(`Photo ${photoId} not found in event ${eventId}`);
    }

    console.log(`[FaceService] Verified photo ${photoId} belongs to event ${eventId}`);

    // Step 4: Upload face thumbnails (if any)
    let successfulThumbnails = [];

    if (faceThumbnailFiles.length > 0) {
      try {
        successfulThumbnails = await this._uploadThumbnails(faceThumbnailFiles);
        console.log(`[FaceService] Successfully uploaded ${successfulThumbnails.length} thumbnails`);
      } catch (error) {
        console.error('[FaceService] Thumbnail upload failed:', error.message);
        throw new InternalServerError(
          `Failed to upload thumbnails: ${error.message}`,
          'THUMBNAIL_UPLOAD_FAILED'
        );
      }
    } else {
      console.log(`[FaceService] No new thumbnails to upload (all faces already have thumbnails)`);
    }

    // Step 5: Update face records with thumbnail IDs
    for (const { faceId, thumbnailDriveId } of successfulThumbnails) {
      try {
        const existingFace = await this.faceRepo.findByFaceId(faceId);
        if (existingFace) {
          // Update existing face with thumbnail ID
          await this.faceRepo.saveDescriptor(faceId, existingFace.descriptor, {
            ...existingFace.metadata,
            thumbnailDriveId,
          });
          console.log(`[FaceService] Updated ${faceId} with thumbnail ID: ${thumbnailDriveId}`);
        } else {
          // New face without descriptor - save placeholder
          await this.faceRepo.saveDescriptor(faceId, [], {
            thumbnailDriveId,
          });
          console.log(`[FaceService] Created new face ${faceId} with thumbnail ID: ${thumbnailDriveId}`);
        }
      } catch (error) {
        console.error(`[FaceService] Failed to update face ${faceId}:`, error.message);
        // Continue with other faces even if one fails
      }
    }

    // Step 6: Update photo metadata
    try {
      const updatedPhoto = await this.photoRepo.updateById(photoId, {
        mainFaceId,
        faceIds: faceIdArray,
        faceBoxes,
      });

      if (!updatedPhoto) {
        throw new NotFoundError(`Photo ${photoId} not found`);
      }

      console.log(`[FaceService] Successfully updated photo ${photoId} with ${faceIdArray.length} faces`);

      return {
        success: true,
        photo: updatedPhoto,
        thumbnailsUploaded: successfulThumbnails.length,
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalServerError(
        `Failed to update photo: ${error.message}`,
        'PHOTO_UPDATE_FAILED'
      );
    }
  }

  /**
   * Upload face thumbnails to storage (Cloudinary or Google Drive)
   * Private helper method
   *
   * @private
   * @param {Array} faceThumbnailFiles - Array of {faceId, file} objects
   * @returns {Promise<Array>} Array of {faceId, thumbnailDriveId: url} objects
   */
  async _uploadThumbnails(faceThumbnailFiles) {
    const thumbnailUploads = await Promise.all(
      faceThumbnailFiles.map(async ({ faceId, file: thumbFile }) => {
        try {
          const thumbBuffer = Buffer.from(await thumbFile.arrayBuffer());
          const uploadResult = await uploadFaceThumbnail(thumbBuffer, `${faceId}.jpg`);
          console.log(`[FaceService] Uploaded thumbnail for ${faceId}: ${uploadResult.id} -> ${uploadResult.url}`);
          // Store URL instead of ID for provider-agnostic access
          // - Cloudinary: Direct URL (https://res.cloudinary.com/...)
          // - Google Drive: Proxy URL (/api/image/abc123)
          return { faceId, thumbnailDriveId: uploadResult.url };
        } catch (err) {
          console.error(`[FaceService] Failed to upload thumbnail for ${faceId}:`, err);
          return null;
        }
      })
    );

    // Filter out failed uploads
    return thumbnailUploads.filter(t => t);
  }
}
