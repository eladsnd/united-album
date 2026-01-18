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
import fs from 'fs';
import path from 'path';
import { ValidationError, NotFoundError, ConflictError, InternalServerError } from '../api/errors';

const CHALLENGES_IMAGE_DIR = path.join(process.cwd(), 'public', 'challenges');
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

    // Save image file
    const imagePath = await this._saveImageFile(image, id);

    // Create new pose in database
    try {
      const newPose = await this.challengeRepo.create({
        id,
        title: title.trim(),
        instruction: instruction.trim(),
        image: imagePath,
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
      const newImagePath = await this._saveImageFile(image, id);
      updateData.image = newImagePath;
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
   *
   * Note: Image file is NOT deleted to prevent breaking existing references
   *
   * @param {string} id - Pose ID
   * @returns {Promise<{id: string, note: string}>} Deletion result
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

      console.log(`[ChallengeService] Deleted pose: ${id}`);
      console.log(`[ChallengeService] Image file preserved at: ${deletedPose.image}`);

      return {
        id: deletedPose.id,
        note: 'Image file preserved to prevent breaking existing references.',
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
   * Save uploaded image file
   * Private helper method
   *
   * @private
   * @param {File} file - Image file from FormData
   * @param {string} poseId - Pose ID for filename
   * @returns {Promise<string>} Public URL path to saved image
   * @throws {ValidationError} When file type or size is invalid
   * @throws {InternalServerError} When file save fails
   */
  async _saveImageFile(file, poseId) {
    try {
      // Validate file type
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        throw new ValidationError('Invalid file type. Only PNG and JPEG images are allowed.');
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        throw new ValidationError('File size exceeds 5MB limit.');
      }

      // Ensure challenges directory exists
      if (!fs.existsSync(CHALLENGES_IMAGE_DIR)) {
        fs.mkdirSync(CHALLENGES_IMAGE_DIR, { recursive: true });
      }

      // Determine file extension
      const ext = file.type === 'image/png' ? 'png' : 'jpg';
      const filename = `${poseId}.${ext}`;
      const filepath = path.join(CHALLENGES_IMAGE_DIR, filename);

      // Security: Validate that resolved path stays within challenges directory
      const resolvedPath = path.resolve(filepath);
      const basePath = path.resolve(CHALLENGES_IMAGE_DIR);

      if (!resolvedPath.startsWith(basePath + path.sep) && resolvedPath !== basePath) {
        throw new ValidationError(
          `Security: Path traversal detected. Pose ID "${poseId}" attempted to write outside challenges directory.`
        );
      }

      // Convert file to buffer and save
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(filepath, buffer);

      // Return public URL path
      return `/challenges/${filename}`;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      console.error('[ChallengeService] Error saving image file:', error);
      throw new InternalServerError(
        'Failed to save image file',
        'FILE_SAVE_FAILED'
      );
    }
  }
}
