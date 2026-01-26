/**
 * Upload Service (Service Layer Pattern)
 *
 * Handles the business logic for photo uploads.
 * Separates business rules from HTTP routing concerns.
 *
 * Responsibilities:
 * - File validation
 * - Google Drive upload coordination
 * - Photo metadata persistence
 * - Error handling with custom exceptions
 *
 * REFACTORED with Repository Pattern:
 * - Uses PhotoRepository instead of photoStorage functions
 * - Clean separation between business logic and data access
 *
 * Usage:
 * ```javascript
 * const uploadService = new UploadService();
 * const result = await uploadService.processUpload(formData);
 * ```
 */

import { uploadToDrive, deleteFromDrive } from '../googleDrive';
import { PhotoRepository } from '../repositories/PhotoRepository.js';
import { MetadataService } from './MetadataService.js';
import { GamificationService } from './GamificationService.js';
import { ValidationError, InternalServerError } from '../api/errors';

export class UploadService {
  constructor() {
    this.photoRepo = new PhotoRepository();
    this.metadataService = new MetadataService();
    this.gamificationService = new GamificationService();
  }
  /**
   * Validate Google Drive OAuth credentials
   *
   * @returns {boolean} True if credentials are configured
   */
  validateCredentials() {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_REFRESH_TOKEN
    );
  }

  /**
   * Process photo upload with metadata saving
   *
   * Workflow:
   * 1. Extract and validate file from FormData
   * 2. Convert file to buffer
   * 3. Extract EXIF metadata (capture time, device info)
   * 4. Upload file to Google Drive
   * 5. Create photo metadata record
   * 6. Save metadata to database
   *
   * @param {FormData} formData - Form data containing file and metadata
   * @returns {Promise<{success: boolean, photo: Object}>} Upload result
   * @throws {ValidationError} When file is missing or invalid
   * @throws {InternalServerError} When Drive upload or metadata save fails
   *
   * @example
   * ```javascript
   * const uploadService = new UploadService();
   * try {
   *   const result = await uploadService.processUpload(formData);
   *   console.log('Photo uploaded:', result.photo.driveId);
   * } catch (error) {
   *   if (error instanceof ValidationError) {
   *     console.error('Invalid file:', error.message);
   *   }
   * }
   * ```
   */
  async processUpload(formData) {
    // Step 1: Extract and validate file
    const file = formData.get('file');
    const folderId = formData.get('folderId') || process.env.GOOGLE_DRIVE_FOLDER_ID;
    const poseId = formData.get('poseId') || 'unknown_pose';
    const uploaderId = formData.get('uploaderId') || null;

    if (!file) {
      throw new ValidationError('No file uploaded');
    }

    console.log(`[UploadService] Processing upload: ${file.name}, pose: ${poseId}`);

    // Step 2: Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Step 3: Extract EXIF metadata
    const metadata = await this.metadataService.extractMetadata(buffer);
    console.log(`[UploadService] EXIF metadata extracted:`, {
      capturedAt: metadata.capturedAt,
      deviceMake: metadata.deviceMake,
      deviceModel: metadata.deviceModel
    });

    // Step 4: Upload to Google Drive
    let driveData;
    try {
      console.log(`[UploadService] Uploading to Drive folder: ${folderId}`);
      driveData = await uploadToDrive(buffer, file.name, folderId);
      console.log(`[UploadService] Drive upload successful: ${driveData.id}`);
    } catch (error) {
      console.error('[UploadService] Drive upload failed:', error.message);
      throw new InternalServerError(
        `Drive upload failed: ${error.message}`,
        'DRIVE_UPLOAD_FAILED'
      );
    }

    // Step 5: Create photo metadata
    const photo = {
      id: Date.now(),
      name: file.name,
      driveId: driveData.id,
      url: `/api/image/${driveData.id}`, // Proxy URL for Next.js Image optimization
      mainFaceId: 'unknown', // Will be updated by /api/update-faces
      faceIds: [], // Will be updated by /api/update-faces
      faceBoxes: [], // Will be updated by /api/update-faces
      poseId,
      uploaderId,
      timestamp: new Date().toISOString(),
      capturedAt: metadata.capturedAt ? metadata.capturedAt.toISOString() : null,
      deviceMake: metadata.deviceMake,
      deviceModel: metadata.deviceModel,
    };

    console.log('[UploadService] Saving photo metadata');

    // Step 6: Save photo metadata
    try {
      const savedPhoto = await this.photoRepo.save(photo);
      console.log(`[UploadService] Photo saved successfully: ${savedPhoto.id}`);

      // Step 7: Award points if gamify mode is enabled
      const pointsAwarded = await this.gamificationService.awardPointsForPhoto(savedPhoto);

      return {
        success: true,
        photo: savedPhoto,
        pointsAwarded, // null if gamify mode off or no points earned
      };
    } catch (error) {
      console.error('[UploadService] Metadata save failed:', error.message);

      // Cleanup: Delete orphaned Drive file if metadata save fails
      try {
        console.log(`[UploadService] Cleaning up orphaned Drive file: ${driveData.id}`);
        await deleteFromDrive(driveData.id);
        console.log('[UploadService] Orphaned file deleted successfully');
      } catch (cleanupError) {
        console.error('[UploadService] Failed to cleanup orphaned file:', cleanupError.message);
        // Continue with original error - cleanup failure is secondary
      }

      throw new InternalServerError(
        `Failed to save photo metadata: ${error.message}`,
        'METADATA_SAVE_FAILED'
      );
    }
  }
}
