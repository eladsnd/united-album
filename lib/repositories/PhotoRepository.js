/**
 * Photo Repository (Repository Pattern)
 *
 * Extends BaseRepository to provide photo-specific data access operations.
 *
 * Design Pattern: Repository Pattern + Template Method Pattern
 * - Inherits all CRUD operations from BaseRepository
 * - Overrides serialize/deserialize for JSON array handling
 * - Adds photo-specific query methods
 *
 * Benefits:
 * - Eliminates ~80% of photoStorage.js code duplication
 * - Automatic JSON serialization for SQLite compatibility
 * - Consistent error handling via BaseRepository
 * - Clean separation of data access from business logic
 *
 * Usage:
 * ```javascript
 * const photoRepo = new PhotoRepository();
 * const photo = await photoRepo.create({ driveId: '123', name: 'photo.jpg', ... });
 * const photos = await photoRepo.findByMainFaceId('person_1');
 * ```
 */

import { BaseRepository } from './BaseRepository.js';

export class PhotoRepository extends BaseRepository {
  /**
   * Get Prisma model name
   * @returns {string} 'photo'
   */
  getModel() {
    return 'photo';
  }

  /**
   * Serialize photo data before saving to database
   * Converts faceIds and faceBoxes arrays to JSON strings for SQLite
   *
   * @param {Object} data - Photo data
   * @param {string} data.driveId - Google Drive file ID (unique)
   * @param {string} data.name - Photo filename
   * @param {string} data.url - Photo URL
   * @param {string} data.mainFaceId - Primary person ID (e.g., "person_1")
   * @param {Array<string>} data.faceIds - All detected face IDs
   * @param {Array<Object>} data.faceBoxes - Bounding boxes for faces
   * @param {string} data.poseId - Pose challenge ID
   * @param {string} data.uploaderId - Uploader session ID
   * @param {Date|string} data.timestamp - Upload timestamp
   * @returns {Object} Serialized data with JSON strings
   */
  serialize(data) {
    const serialized = {
      ...data,
      // Convert arrays to JSON strings for SQLite
      faceIds: Array.isArray(data.faceIds)
        ? JSON.stringify(data.faceIds)
        : data.faceIds || '[]',
      faceBoxes: Array.isArray(data.faceBoxes)
        ? JSON.stringify(data.faceBoxes)
        : data.faceBoxes || '[]',
      // Ensure timestamp is Date object
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
    };

    return serialized;
  }

  /**
   * Deserialize photo record after reading from database
   * Parses JSON strings back to arrays
   *
   * @param {Object} record - Photo record from database
   * @returns {Object} Deserialized photo with arrays
   */
  deserialize(record) {
    return {
      ...record,
      faceIds: JSON.parse(record.faceIds || '[]'),
      faceBoxes: JSON.parse(record.faceBoxes || '[]'),
    };
  }

  /**
   * Save a new photo (upsert by driveId)
   *
   * Uses upsert to handle duplicates. If photo with same driveId exists,
   * it updates instead of creating.
   *
   * @param {Object} photo - Photo data
   * @returns {Promise<Object>} Saved photo record
   */
  async save(photo) {
    // Set default values
    const photoData = {
      name: photo.name || 'unknown.jpg',
      driveId: photo.driveId,
      url: photo.url || `/api/image/${photo.driveId}`,
      mainFaceId: photo.mainFaceId || 'unknown',
      faceIds: photo.faceIds || [],
      faceBoxes: photo.faceBoxes || [],
      poseId: photo.poseId || 'unknown_pose',
      uploaderId: photo.uploaderId || null,
      timestamp: photo.timestamp || new Date(),
    };

    const savedPhoto = await this.upsert(
      { driveId: photoData.driveId },
      photoData,
      photoData
    );

    console.log(`[PhotoRepository] Saved photo ${savedPhoto.driveId} (ID: ${savedPhoto.id})`);
    return savedPhoto;
  }

  /**
   * Get photo by driveId
   *
   * @param {string} driveId - Google Drive file ID
   * @returns {Promise<Object|null>} Photo or null if not found
   */
  async findByDriveId(driveId) {
    return await this.findUnique({ driveId });
  }

  /**
   * Get photos ordered by timestamp (most recent first)
   *
   * @returns {Promise<Array>} All photos
   */
  async findAll() {
    return await this.findMany({
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Get photos filtered by mainFaceId
   *
   * @param {string} faceId - Face ID to filter by (e.g., "person_1")
   * @returns {Promise<Array>} Photos with this mainFaceId
   */
  async findByMainFaceId(faceId) {
    return await this.findMany({
      where: { mainFaceId: faceId },
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Get photos filtered by poseId
   *
   * @param {string} poseId - Pose/challenge ID to filter by
   * @returns {Promise<Array>} Photos with this poseId
   */
  async findByPoseId(poseId) {
    return await this.findMany({
      where: { poseId },
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Get photos filtered by uploaderId
   *
   * @param {string} uploaderId - Uploader session ID
   * @returns {Promise<Array>} Photos uploaded by this user
   */
  async findByUploaderId(uploaderId) {
    return await this.findMany({
      where: { uploaderId },
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Get photos containing a specific faceId (in faceIds array)
   *
   * Note: Since faceIds is stored as JSON string in SQLite, we fetch all
   * photos and filter in-memory. For PostgreSQL with JSONB, this could be
   * optimized with `contains` operator.
   *
   * @param {string} faceId - Face ID to search for
   * @returns {Promise<Array>} Photos containing this face
   */
  async findContainingFace(faceId) {
    const allPhotos = await this.findMany({
      orderBy: { timestamp: 'desc' },
    });

    return allPhotos.filter(photo => photo.faceIds.includes(faceId));
  }

  /**
   * Update photo by database ID
   *
   * @param {number} photoId - Database photo ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated photo
   */
  async updateById(photoId, updates) {
    const updatedPhoto = await this.update({ id: photoId }, updates);
    console.log(`[PhotoRepository] Updated photo ${photoId}:`, Object.keys(updates));
    return updatedPhoto;
  }

  /**
   * Delete photo by driveId
   *
   * @param {string} driveId - Google Drive file ID
   * @returns {Promise<Object>} Deleted photo record
   */
  async deleteByDriveId(driveId) {
    const deletedPhoto = await this.delete({ driveId });
    console.log(`[PhotoRepository] Deleted photo with driveId: ${driveId}`);
    return deletedPhoto;
  }

  /**
   * Count total photos
   *
   * @returns {Promise<number>} Total photo count
   */
  async countAll() {
    return await this.count();
  }
}
