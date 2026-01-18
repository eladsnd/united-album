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
 * Usage:
 * ```javascript
 * const uploadService = new UploadService();
 * const result = await uploadService.processUpload(formData);
 * ```
 */

import { uploadToDrive } from '../googleDrive';
import { savePhoto } from '../photoStorage';
import { ValidationError, InternalServerError } from '../api/errors';

export class UploadService {
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
   * 2. Upload file to Google Drive
   * 3. Create photo metadata record
   * 4. Save metadata to database
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

    // Step 3: Upload to Google Drive
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

    // Step 4: Create photo metadata
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
    };

    console.log('[UploadService] Saving photo metadata');

    // Step 5: Save photo metadata
    try {
      const savedPhoto = await savePhoto(photo);
      console.log(`[UploadService] Photo saved successfully: ${savedPhoto.id}`);

      return {
        success: true,
        photo: savedPhoto,
      };
    } catch (error) {
      console.error('[UploadService] Metadata save failed:', error.message);
      // TODO: Consider cleanup - delete Drive file if metadata save fails
      throw new InternalServerError(
        `Failed to save photo metadata: ${error.message}`,
        'METADATA_SAVE_FAILED'
      );
    }
  }
}
