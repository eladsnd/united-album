import { Injectable } from '@nestjs/common';
import { AppError } from '../errors/app-error.js';

/**
 * PhotoService handles all photo-related business logic
 * Follows NestJS service pattern with dependency injection
 */
@Injectable()
export class PhotoService {
  constructor(driveService, photoRepository, faceService, compressionService) {
    this.driveService = driveService;
    this.photoRepository = photoRepository;
    this.faceService = faceService;
    this.compressionService = compressionService;
  }

  /**
   * Upload a photo with face detection
   * @param {Object} uploadDto - Upload data transfer object
   * @param {Buffer} uploadDto.file - Image file buffer to upload
   * @param {string} uploadDto.fileName - Original file name
   * @param {string} uploadDto.folderId - Google Drive folder ID
   * @param {string} uploadDto.poseId - Associated pose challenge ID
   * @param {string} uploadDto.uploaderId - User session ID
   * @returns {Promise<Object>} Uploaded photo metadata
   */
  async uploadPhoto(uploadDto) {
    const { file, fileName, folderId, poseId, uploaderId } = uploadDto;

    // 1. Compress image to meet 5MB limit
    const { buffer: compressedBuffer, metadata: compressionMetadata } =
      await this.compressionService.compressImage(file, 'image/jpeg');

    console.log(
      `[PhotoService] Compressed ${fileName}: ` +
      `${Math.round(compressionMetadata.originalSize / 1024)}KB → ${Math.round(compressionMetadata.finalSize / 1024)}KB ` +
      `(${compressionMetadata.compressionRatio.toFixed(2)}x)`
    );

    // 2. Upload compressed image to Google Drive
    const driveFile = await this.driveService.uploadFile(
      compressedBuffer,
      fileName,
      folderId
    );

    // 3. Create photo metadata
    // Note: Face detection happens AFTER upload in the new flow
    // The client uploads the image first, then downloads it back, detects faces,
    // and calls /api/update-faces with the face data and thumbnails
    const photoMetadata = {
      id: Date.now(), // Generate ID
      name: fileName,
      driveId: driveFile.id,
      url: `/api/image/${driveFile.id}`, // Local proxy URL
      mainFaceId: 'unknown', // Will be updated by /api/update-faces
      faceIds: [], // Will be updated by /api/update-faces
      faceBoxes: [], // Will be updated by /api/update-faces
      poseId: poseId || 'unknown',
      uploaderId: uploaderId || null,
      timestamp: new Date().toISOString(),
    };

    // 4. Save photo metadata
    const savedPhoto = await this.photoRepository.save(photoMetadata);

    return savedPhoto;
  }

  /**
   * Update photo with face detection results
   * @param {number} photoId - Photo ID to update
   * @param {Object} faceData - Face detection results
   * @returns {Promise<Object>} Updated photo
   */
  async updatePhotoFaces(photoId, faceData) {
    const { faceIds, mainFaceId, faceBoxes, faceThumbnails } = faceData;

    // 1. Find existing photo
    const photo = await this.photoRepository.findById(photoId);
    if (!photo) {
      throw new AppError('Photo not found', 404, 'PHOTO_NOT_FOUND');
    }

    // 2. Upload face thumbnails to Drive if provided
    let thumbnailDriveIds = {};
    if (faceThumbnails && faceThumbnails.length > 0) {
      const facesFolderId = await this.driveService.findOrCreateFolder(
        'faces',
        process.env.GOOGLE_DRIVE_FOLDER_ID
      );

      for (const { faceId, thumbnail } of faceThumbnails) {
        const thumbnailFile = await this.driveService.uploadFile(
          thumbnail,
          `${faceId}.jpg`,
          facesFolderId
        );
        thumbnailDriveIds[faceId] = thumbnailFile.id;
      }
    }

    // 3. Update face storage
    await this.faceService.updateFacesFromPhoto(
      faceIds,
      mainFaceId,
      photo.driveId,
      thumbnailDriveIds
    );

    // 4. Update photo metadata
    const updatedPhoto = await this.photoRepository.update(photoId, {
      faceIds,
      mainFaceId,
      faceBoxes,
    });

    return updatedPhoto;
  }

  /**
   * Delete a photo and cleanup orphaned faces
   * @param {number} photoId - Photo ID to delete
   * @param {string} requesterId - User requesting deletion
   * @param {boolean} isAdmin - Whether requester is admin
   * @returns {Promise<Object>} Deletion result with orphaned faces
   */
  async deletePhoto(photoId, requesterId, isAdmin = false) {
    // 1. Find photo
    const photo = await this.photoRepository.findById(photoId);
    if (!photo) {
      throw new AppError('Photo not found', 404, 'PHOTO_NOT_FOUND');
    }

    // 2. Check permissions (unless admin)
    if (!isAdmin && photo.uploaderId !== requesterId) {
      throw new AppError(
        'You can only delete your own photos',
        403,
        'FORBIDDEN'
      );
    }

    // 3. Delete from Google Drive
    await this.driveService.deleteFile(photo.driveId);

    // 4. Delete photo metadata
    await this.photoRepository.delete(photoId);

    // 5. Cleanup orphaned faces
    const orphanedFaces = await this.faceService.cleanupOrphanedFaces(
      photo.faceIds
    );

    // 6. Delete orphaned face thumbnails from Drive
    if (orphanedFaces.length > 0) {
      for (const faceId of orphanedFaces) {
        const face = await this.faceService.getFace(faceId);
        if (face?.thumbnailDriveId) {
          await this.driveService.deleteFile(face.thumbnailDriveId);
        }
      }
    }

    return {
      success: true,
      deletedPhotoId: photoId,
      orphanedFaces,
    };
  }

  /**
   * Get all photos, optionally filtered
   * @param {Object} filters - Optional filters
   * @param {string} filters.faceId - Filter by face ID
   * @param {string} filters.poseId - Filter by pose ID
   * @returns {Promise<Array>} Array of photos
   */
  async getPhotos(filters = {}) {
    const allPhotos = await this.photoRepository.findAll();

    // Apply filters
    let filteredPhotos = allPhotos;

    if (filters.faceId) {
      filteredPhotos = filteredPhotos.filter(
        (photo) =>
          photo.mainFaceId === filters.faceId ||
          photo.faceIds?.includes(filters.faceId)
      );
    }

    if (filters.poseId) {
      filteredPhotos = filteredPhotos.filter(
        (photo) => photo.poseId === filters.poseId
      );
    }

    return filteredPhotos;
  }

  /**
   * Get a single photo by ID
   * @param {number} photoId - Photo ID
   * @returns {Promise<Object>} Photo object
   */
  async getPhotoById(photoId) {
    const photo = await this.photoRepository.findById(photoId);
    if (!photo) {
      throw new AppError('Photo not found', 404, 'PHOTO_NOT_FOUND');
    }
    return photo;
  }

  /**
   * Get photo stream from Google Drive
   * @param {string} driveId - Google Drive file ID
   * @returns {Promise<ReadableStream>} File stream
   */
  async getPhotoStream(driveId) {
    return this.driveService.getFileStream(driveId);
  }
}
