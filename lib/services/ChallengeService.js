/**
 * Challenge Service (Service Layer Pattern)
 *
 * Handles business logic for pose challenge CRUD operations.
 *
 * Responsibilities:
 * - Pose challenge CRUD operations
 * - Image file persistence
 * - Validation and slug generation
 * - Database integration
 *
 * REFACTORED with Repository Pattern:
 * - Uses ChallengeRepository instead of direct Prisma calls
 * - Clean separation between business logic and data access
 */

import { ChallengeRepository } from '../repositories/ChallengeRepository.js';
import { uploadChallengeImage, extractFileId, detectProvider } from '../storage/operations';
import { ValidationError, NotFoundError, ConflictError, InternalServerError } from '../api/errors';

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export class ChallengeService {
  constructor() {
    this.challengeRepo = new ChallengeRepository();
  }
  /**
   * Get all pose challenges
   *
   * @returns {Promise<Array>} Array of pose challenges
   */
  async getAllPoses() {
    try {
      const challenges = await this.challengeRepo.findAll();
      return challenges;
    } catch (error) {
      console.error('[ChallengeService] Error reading challenges:', error);
      throw new InternalServerError(
        'Failed to read challenges data',
        'DATABASE_READ_FAILED'
      );
    }
  }

  /**
   * Create new pose challenge
   *
   * @param {Object} data - Pose data
   * @param {string} data.title - Pose title
   * @param {string} data.instruction - Pose instruction
   * @param {File} data.image - Image file
   * @param {string|null} data.folderId - Optional Google Drive folder ID
   * @returns {Promise<Object>} Created pose challenge
   * @throws {ValidationError} When input is invalid
   * @throws {ConflictError} When pose ID already exists
   * @throws {InternalServerError} When creation fails
   */
  async createPose({ title, instruction, image, folderId = null }) {
    // Validate required fields
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      throw new ValidationError('Title is required and must be a non-empty string.');
    }

    if (!instruction || typeof instruction !== 'string' || instruction.trim().length === 0) {
      throw new ValidationError('Instruction is required and must be a non-empty string.');
    }

    if (!image || !(image instanceof File)) {
      throw new ValidationError('Image file is required.');
    }

    // Generate unique ID from title
    const id = this._slugify(title);

    // Check if ID already exists
    const exists = await this.challengeRepo.exists(id);

    if (exists) {
      throw new ConflictError(
        `Pose with ID "${id}" already exists. Please use a different title.`
      );
    }

    // Save image file to storage (returns URL)
    const imageUrl = await this._saveImageFile(image, id, folderId);

    // Create new pose in database
    try {
      const newPose = await this.challengeRepo.create({
        id,
        title: title.trim(),
        instruction: instruction.trim(),
        image: imageUrl,
        folderId: folderId || null,
      });

      console.log(`[ChallengeService] Created new pose: ${id}`);

      return newPose;
    } catch (error) {
      console.error('[ChallengeService] Error creating pose:', error);
      throw new InternalServerError(
        'Failed to create pose',
        'DATABASE_CREATE_FAILED'
      );
    }
  }

  /**
   * Update existing pose challenge
   *
   * @param {string} id - Pose ID
   * @param {Object} updates - Fields to update
   * @param {string} updates.title - Pose title (optional)
   * @param {string} updates.instruction - Pose instruction (optional)
   * @param {File} updates.image - Image file (optional)
   * @param {string|null} updates.folderId - Google Drive folder ID (optional)
   * @returns {Promise<Object>} Updated pose challenge
   * @throws {ValidationError} When ID is invalid
   * @throws {NotFoundError} When pose doesn't exist
   * @throws {InternalServerError} When update fails
   */
  async updatePose(id, { title, instruction, image, folderId }) {
    // Validate ID
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      throw new ValidationError('Pose ID is required.');
    }

    // Find existing pose
    const existingPose = await this.challengeRepo.findById(id);

    if (!existingPose) {
      throw new NotFoundError(`Pose with ID "${id}" not found.`);
    }

    // Build update object with only provided fields
    const updateData = {};

    if (title && typeof title === 'string' && title.trim().length > 0) {
      updateData.title = title.trim();
    }

    if (instruction && typeof instruction === 'string' && instruction.trim().length > 0) {
      updateData.instruction = instruction.trim();
    }

    if (folderId !== undefined) {
      updateData.folderId = folderId;
    }

    // Handle image update if provided
    if (image && image instanceof File) {
      const newImageUrl = await this._saveImageFile(image, id, folderId);
      updateData.image = newImageUrl;
    }

    // Update in database
    try {
      const updatedPose = await this.challengeRepo.update({ id }, updateData);

      console.log(`[ChallengeService] Updated pose: ${id}`);

      return updatedPose;
    } catch (error) {
      console.error('[ChallengeService] Error updating pose:', error);
      throw new InternalServerError(
        'Failed to update pose',
        'DATABASE_UPDATE_FAILED'
      );
    }
  }

  /**
   * Delete pose challenge
   * Also attempts to delete the image file from Google Drive
   *
   * @param {string} id - Pose ID
   * @returns {Promise<{id: string, imageDeleted: boolean, note: string}>} Deletion result
   * @throws {ValidationError} When ID is invalid
   * @throws {NotFoundError} When pose doesn't exist
   * @throws {InternalServerError} When deletion fails
   */
  async deletePose(id) {
    // Validate ID
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      throw new ValidationError('Pose ID is required as a query parameter.');
    }

    // Delete from database
    try {
      const deletedPose = await this.challengeRepo.deleteById(id);
      let imageDeleted = false;
      let note = '';

      console.log(`[ChallengeService] Deleted pose from database: ${id}`);

      // Try to delete image from storage (provider-agnostic)
      const provider = detectProvider(deletedPose.image);
      const fileId = extractFileId(deletedPose.image);

      if (fileId) {
        try {
          const { deletePhoto } = await import('../storage/operations');
          await deletePhoto(fileId);
          imageDeleted = true;
          note = `Pose and image deleted successfully from ${provider}.`;
          console.log(`[ChallengeService] Deleted image from ${provider}: ${fileId}`);
        } catch (deleteError) {
          // Don't fail the whole operation if storage deletion fails
          console.warn(`[ChallengeService] Failed to delete image (${fileId}):`, deleteError.message);
          note = `Pose deleted from database. Image may still exist in ${provider} (delete failed or file not found).`;
        }
      } else {
        note = 'Pose deleted from database. Image path invalid or not recognized.';
        console.log(`[ChallengeService] No valid file ID found in image path: ${deletedPose.image}`);
      }

      return {
        id: deletedPose.id,
        imageDeleted,
        note,
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      console.error('[ChallengeService] Error deleting pose:', error);
      throw new InternalServerError(
        'Failed to delete pose',
        'DATABASE_DELETE_FAILED'
      );
    }
  }

  /**
   * Generate a URL-safe slug from a title
   * Supports Unicode characters (Hebrew, Arabic, Chinese, etc.)
   * Private helper method
   *
   * @private
   * @param {string} title - Title to slugify
   * @returns {string} URL-safe slug (guaranteed non-empty)
   */
  _slugify(title) {
    // Normalize unicode and remove diacritics
    const normalized = title
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Remove combining diacritical marks

    // Keep Unicode letters, numbers, spaces, and hyphens
    const slug = normalized
      .replace(/[^\p{L}\p{N}\s-]/gu, '') // Unicode-aware: keep letters/numbers
      .replace(/[\s_-]+/g, '-') // Replace whitespace with single hyphen
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

    // Fallback: if slug is empty, use timestamp
    if (!slug || slug.length === 0) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 7);
      console.warn(`[ChallengeService] Title "${title}" produced empty slug, using fallback: pose-${timestamp}-${random}`);
      return `pose-${timestamp}-${random}`;
    }

    return slug;
  }

  /**
   * Save uploaded image file to Google Drive
   * Private helper method
   *
   * @private
   * @param {File} file - Image file from FormData
   * @param {string} poseId - Pose ID for filename
   * @param {string|null} folderId - Optional parent folder ID
   * @returns {Promise<string>} Google Drive file ID
   * @throws {ValidationError} When file type or size is invalid
   * @throws {InternalServerError} When file upload fails
   */
  async _saveImageFile(file, poseId, folderId = null) {
    try {
      // Validate file type
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        throw new ValidationError('Invalid file type. Only PNG and JPEG images are allowed.');
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        throw new ValidationError('File size exceeds 5MB limit.');
      }

      // Determine file extension and create filename
      const ext = file.type === 'image/png' ? 'png' : 'jpg';
      const filename = `${poseId}.${ext}`;

      // Convert file to buffer
      const buffer = Buffer.from(await file.arrayBuffer());

      // Upload to storage (Cloudinary or Google Drive)
      // Pass poseId as publicId for meaningful Cloudinary filenames
      console.log(`[ChallengeService] Uploading pose image "${filename}"...`);
      const uploadResult = await uploadChallengeImage(buffer, filename, poseId);

      console.log(`[ChallengeService] Uploaded pose image: ${uploadResult.id} -> ${uploadResult.url}`);

      // Return URL (Cloudinary direct URL or Drive proxy URL)
      // This ensures images load correctly regardless of provider
      return uploadResult.url;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      console.error('[ChallengeService] Error uploading image:', error);
      throw new InternalServerError(
        'Failed to upload image. Please check your storage configuration.',
        'FILE_UPLOAD_FAILED'
      );
    }
  }
}
