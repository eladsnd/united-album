/**
 * Face Repository (Repository Pattern)
 *
 * Extends BaseRepository to provide face-specific data access operations.
 *
 * Design Pattern: Repository Pattern + Template Method Pattern
 * - Inherits all CRUD operations from BaseRepository
 * - Overrides serialize/deserialize for JSON array/object handling
 * - Adds face-specific query and update methods
 *
 * Face Recognition Features:
 * - Multi-descriptor storage (up to 5 samples per person)
 * - Automatic descriptor averaging for better accuracy
 * - Rolling window of samples (oldest dropped when > 5)
 * - Thumbnail management and orphaned face cleanup
 *
 * Benefits:
 * - Eliminates ~80% of faceStorage.js code duplication
 * - Automatic JSON serialization for SQLite compatibility
 * - Consistent error handling via BaseRepository
 * - Clean separation of data access from business logic
 *
 * Usage:
 * ```javascript
 * const faceRepo = new FaceRepository();
 * const face = await faceRepo.saveDescriptor('person_1', descriptor, { thumbnailDriveId: '123' });
 * const avgDescriptor = await faceRepo.getAverageDescriptor('person_1');
 * ```
 */

import { BaseRepository } from './BaseRepository.js';

export class FaceRepository extends BaseRepository {
  /**
   * Get Prisma model name
   * @returns {string} 'face'
   */
  getModel() {
    return 'face';
  }

  /**
   * Serialize face data before saving to database
   * Converts descriptors (array of arrays), descriptor (array), and metadata (object)
   * to JSON strings for SQLite
   *
   * @param {Object} data - Face data
   * @param {string} data.faceId - Face identifier (e.g., "person_1")
   * @param {Array<Array<number>>} data.descriptors - Array of 128D descriptor samples
   * @param {Array<number>} data.descriptor - Average 128D descriptor
   * @param {Object} data.metadata - Additional metadata
   * @param {string} data.thumbnailDriveId - Google Drive file ID for face thumbnail
   * @param {Date} data.lastSeen - Last seen timestamp
   * @param {number} data.photoCount - Number of photos containing this face
   * @param {number} data.sampleCount - Number of descriptor samples
   * @returns {Object} Serialized data with JSON strings
   */
  serialize(data) {
    return {
      ...data,
      // Convert arrays/objects to JSON strings for SQLite
      descriptors: Array.isArray(data.descriptors)
        ? JSON.stringify(data.descriptors)
        : data.descriptors || '[]',
      descriptor: Array.isArray(data.descriptor)
        ? JSON.stringify(data.descriptor)
        : data.descriptor || '[]',
      metadata: typeof data.metadata === 'object' && data.metadata !== null
        ? JSON.stringify(data.metadata)
        : data.metadata || '{}',
    };
  }

  /**
   * Deserialize face record after reading from database
   * Parses JSON strings back to arrays/objects
   *
   * @param {Object} record - Face record from database
   * @returns {Object} Deserialized face with arrays/objects
   */
  deserialize(record) {
    return {
      ...record,
      descriptors: JSON.parse(record.descriptors || '[]'),
      descriptor: JSON.parse(record.descriptor || '[]'),
      metadata: JSON.parse(record.metadata || '{}'),
    };
  }

  /**
   * Calculate average descriptor from array of descriptors
   *
   * Used for multi-descriptor face matching. Averages multiple 128D vectors
   * from different photos of the same person for better recognition accuracy.
   *
   * @private
   * @param {Array<Array<number>>} descriptors - Array of 128D face descriptors
   * @returns {Array<number>|null} Average 128D descriptor or null if empty
   */
  _calculateAverageDescriptor(descriptors) {
    if (!descriptors || descriptors.length === 0) return null;
    if (descriptors.length === 1) return descriptors[0];

    const descriptorLength = descriptors[0].length;
    const avgDescriptor = new Array(descriptorLength).fill(0);

    // Sum all descriptors
    for (const descriptor of descriptors) {
      for (let i = 0; i < descriptorLength; i++) {
        avgDescriptor[i] += descriptor[i];
      }
    }

    // Calculate average
    for (let i = 0; i < descriptorLength; i++) {
      avgDescriptor[i] /= descriptors.length;
    }

    return avgDescriptor;
  }

  /**
   * Save or update a face descriptor
   *
   * Stores multiple samples per person (up to 5) for better matching accuracy.
   * Uses upsert pattern: creates new face or appends descriptor to existing face.
   *
   * Rolling window strategy:
   * - Adds new descriptor sample
   * - Keeps max 5 samples (drops oldest if > 5)
   * - Recalculates average descriptor
   * - Increments photo count
   *
   * @param {string} faceId - Face identifier (e.g., "person_1")
   * @param {Array<number>} descriptor - 128D face descriptor vector
   * @param {Object} metadata - Additional metadata (thumbnailDriveId, etc.)
   * @returns {Promise<Object>} Saved face record
   */
  async saveDescriptor(faceId, descriptor, metadata = {}) {
    // Check if face exists
    const existingFace = await this.findUnique({ faceId });

    if (existingFace) {
      // Update existing face - append new descriptor
      const existingDescriptors = existingFace.descriptors;

      // Add new descriptor (max 5 samples, rolling window)
      const updatedDescriptors = [...existingDescriptors, descriptor];
      if (updatedDescriptors.length > 5) {
        updatedDescriptors.shift(); // Remove oldest sample
      }

      // Calculate new average
      const avgDescriptor = this._calculateAverageDescriptor(updatedDescriptors);

      const updatedFace = await this.update(
        { faceId },
        {
          descriptors: updatedDescriptors,
          descriptor: avgDescriptor,
          metadata,
          thumbnailDriveId: metadata.thumbnailDriveId || existingFace.thumbnailDriveId,
          lastSeen: new Date(),
          photoCount: existingFace.photoCount + 1,
          sampleCount: updatedDescriptors.length,
        }
      );

      console.log(`[FaceRepository] Updated face: ${faceId} (${updatedDescriptors.length} samples)`);
      return updatedFace;
    } else {
      // New face
      const newFace = await this.create({
        faceId,
        descriptors: [descriptor],
        descriptor: descriptor,
        metadata,
        thumbnailDriveId: metadata.thumbnailDriveId || null,
        lastSeen: new Date(),
        photoCount: 1,
        sampleCount: 1,
      });

      console.log(`[FaceRepository] Added new face: ${faceId} (1 sample)`);
      return newFace;
    }
  }

  /**
   * Get average descriptor for a face
   *
   * Returns the pre-calculated average descriptor stored in the database.
   * This is used for face matching against new photos.
   *
   * @param {string} faceId - Face identifier
   * @returns {Promise<Array<number>|null>} 128D descriptor array or null
   */
  async getAverageDescriptor(faceId) {
    const face = await this.findUnique({ faceId });

    if (!face) return null;

    // Return average descriptor
    if (face.descriptor && face.descriptor.length > 0) {
      return face.descriptor;
    }

    // Fallback: calculate from descriptors if avg not available
    if (face.descriptors && face.descriptors.length > 0) {
      return this._calculateAverageDescriptor(face.descriptors);
    }

    return null;
  }

  /**
   * Get all faces ordered by photo count (most photos first)
   *
   * @returns {Promise<Array>} All face records
   */
  async findAll() {
    return await this.findMany({
      orderBy: { photoCount: 'desc' },
    });
  }

  /**
   * Get a specific face by faceId
   *
   * @param {string} faceId - Face identifier
   * @returns {Promise<Object|null>} Face or null if not found
   */
  async findByFaceId(faceId) {
    return await this.findUnique({ faceId });
  }

  /**
   * Delete face by faceId
   *
   * Used when a face is orphaned (no longer appears in any photos).
   *
   * @param {string} faceId - Face identifier
   * @returns {Promise<Object>} Deleted face record
   */
  async deleteByFaceId(faceId) {
    const deletedFace = await this.delete({ faceId });
    console.log(`[FaceRepository] Deleted face: ${faceId}`);
    return deletedFace;
  }

  /**
   * Update face photo count
   *
   * Increments or decrements the count of photos containing this face.
   * Used when photos are added or deleted.
   *
   * @param {string} faceId - Face identifier
   * @param {number} delta - Amount to change (+1 or -1)
   * @returns {Promise<Object>} Updated face record
   */
  async updatePhotoCount(faceId, delta) {
    const updatedFace = await this.update(
      { faceId },
      {
        photoCount: {
          increment: delta,
        },
      }
    );

    console.log(`[FaceRepository] Updated photo count for ${faceId}: ${updatedFace.photoCount}`);
    return updatedFace;
  }

  /**
   * Get faces with thumbnails
   *
   * Returns only faces that have thumbnail images.
   * Useful for displaying face filters in the gallery.
   *
   * @returns {Promise<Array>} Faces with thumbnails
   */
  async findWithThumbnails() {
    return await this.findMany({
      where: {
        thumbnailDriveId: {
          not: null,
        },
      },
      orderBy: { photoCount: 'desc' },
    });
  }

  /**
   * Get orphaned faces (photoCount = 0)
   *
   * Returns face IDs that no longer appear in any photos.
   * These can be safely deleted to clean up the database.
   *
   * @returns {Promise<Array<string>>} Array of orphaned face IDs
   */
  async findOrphaned() {
    const faces = await this.findMany({
      where: { photoCount: 0 },
    });

    return faces.map(face => face.faceId);
  }

  /**
   * Delete orphaned faces (photoCount = 0)
   *
   * Removes all faces with photoCount = 0.
   *
   * @returns {Promise<number>} Number of faces deleted
   */
  async deleteOrphaned() {
    const result = await this.deleteMany({ photoCount: 0 });
    console.log(`[FaceRepository] Deleted ${result.count} orphaned faces`);
    return result.count;
  }
}
