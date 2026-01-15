import path from 'path';
import { BaseRepository } from './base.repository.js';

/**
 * Repository for photo metadata storage
 * Extends BaseRepository with photo-specific queries
 */
export class PhotoRepository extends BaseRepository {
  constructor() {
    super(path.join(process.cwd(), 'data', 'photos.json'), 'id');
  }

  /**
   * Find photos by Google Drive ID
   * @param {string} driveId - Google Drive file ID
   * @returns {Promise<Object|null>} Photo or null
   */
  async findByDriveId(driveId) {
    return this.findOne((photo) => photo.driveId === driveId);
  }

  /**
   * Find photos containing a specific face
   * @param {string} faceId - Face ID to search for
   * @returns {Promise<Array>} Photos containing the face
   */
  async findByFaceId(faceId) {
    return this.findWhere(
      (photo) =>
        photo.mainFaceId === faceId || photo.faceIds?.includes(faceId)
    );
  }

  /**
   * Find photos by pose challenge ID
   * @param {string} poseId - Pose challenge ID
   * @returns {Promise<Array>} Photos for the pose
   */
  async findByPoseId(poseId) {
    return this.findWhere((photo) => photo.poseId === poseId);
  }

  /**
   * Find photos by uploader ID
   * @param {string} uploaderId - Uploader session ID
   * @returns {Promise<Array>} Photos uploaded by user
   */
  async findByUploaderId(uploaderId) {
    return this.findWhere((photo) => photo.uploaderId === uploaderId);
  }

  /**
   * Find recent photos
   * @param {number} limit - Maximum number of photos
   * @returns {Promise<Array>} Recent photos
   */
  async findRecent(limit = 10) {
    const allPhotos = await this.findAll();
    return allPhotos
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Save photo with deduplication by driveId
   * @param {Object} photo - Photo to save
   * @returns {Promise<Object>} Saved photo
   */
  async save(photo) {
    // Check for existing photo with same driveId
    const existing = await this.findByDriveId(photo.driveId);

    if (existing) {
      // Update existing photo
      return this.update(existing.id, photo);
    }

    // Save new photo
    return super.save(photo);
  }
}
