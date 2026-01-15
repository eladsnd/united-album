import path from 'path';
import { BaseRepository } from './base.repository.js';

/**
 * Repository for face metadata storage
 * Extends BaseRepository with face-specific queries
 */
export class FaceRepository extends BaseRepository {
  constructor() {
    super(path.join(process.cwd(), 'data', 'faces.json'), 'faceId');
  }

  /**
   * Find faces with thumbnails
   * @returns {Promise<Array>} Faces that have thumbnail Drive IDs
   */
  async findWithThumbnails() {
    return this.findWhere((face) => face.thumbnailDriveId != null);
  }

  /**
   * Find faces without thumbnails
   * @returns {Promise<Array>} Faces missing thumbnails
   */
  async findWithoutThumbnails() {
    return this.findWhere((face) => !face.thumbnailDriveId);
  }

  /**
   * Find faces by photo count
   * @param {number} minCount - Minimum photo count
   * @returns {Promise<Array>} Faces with >= minCount photos
   */
  async findByPhotoCount(minCount = 1) {
    return this.findWhere((face) => (face.photoCount || 0) >= minCount);
  }

  /**
   * Find recently seen faces
   * @param {number} limit - Maximum number of faces
   * @returns {Promise<Array>} Recently seen faces
   */
  async findRecent(limit = 10) {
    const allFaces = await this.findAll();
    return allFaces
      .filter((face) => face.lastSeen)
      .sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen))
      .slice(0, limit);
  }

  /**
   * Find popular faces (most photos)
   * @param {number} limit - Maximum number of faces
   * @returns {Promise<Array>} Most popular faces
   */
  async findPopular(limit = 10) {
    const allFaces = await this.findAll();
    return allFaces
      .sort((a, b) => (b.photoCount || 0) - (a.photoCount || 0))
      .slice(0, limit);
  }
}
