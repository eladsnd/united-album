import { Injectable } from '@nestjs/common';

/**
 * FaceService handles face recognition and storage
 * Manages face descriptors, matching, and metadata
 */
@Injectable()
export class FaceService {
  constructor(faceRepository, photoRepository) {
    this.faceRepository = faceRepository;
    this.photoRepository = photoRepository;
  }

  /**
   * Update faces from photo upload
   * @param {Array<string>} faceIds - Array of face IDs detected
   * @param {string} mainFaceId - Primary face ID
   * @param {string} photoDriveId - Google Drive ID of photo
   * @param {Object} thumbnailDriveIds - Map of faceId to thumbnail Drive ID
   * @returns {Promise<void>}
   */
  async updateFacesFromPhoto(faceIds, mainFaceId, photoDriveId, thumbnailDriveIds = {}) {
    for (const faceId of faceIds) {
      const existingFace = await this.faceRepository.findById(faceId);

      if (existingFace) {
        // Update existing face
        await this.faceRepository.update(faceId, {
          photoCount: (existingFace.photoCount || 0) + 1,
          lastSeen: new Date().toISOString(),
          // Only update thumbnail if new one provided and face doesn't have one
          thumbnailDriveId: existingFace.thumbnailDriveId || thumbnailDriveIds[faceId],
        });
      } else {
        // Create new face entry
        await this.faceRepository.save({
          faceId,
          photoCount: 1,
          firstSeen: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          thumbnailDriveId: thumbnailDriveIds[faceId] || null,
        });
      }
    }
  }

  /**
   * Cleanup orphaned faces (faces no longer in any photo)
   * @param {Array<string>} faceIdsToCheck - Face IDs from deleted photo
   * @returns {Promise<Array<string>>} Array of orphaned face IDs
   */
  async cleanupOrphanedFaces(faceIdsToCheck) {
    const orphanedFaces = [];
    const allPhotos = await this.photoRepository.findAll();

    for (const faceId of faceIdsToCheck) {
      // Count how many photos still contain this face
      const photosWithFace = allPhotos.filter(
        (photo) =>
          photo.mainFaceId === faceId || photo.faceIds?.includes(faceId)
      );

      if (photosWithFace.length === 0) {
        // Face is orphaned - delete it
        await this.faceRepository.delete(faceId);
        orphanedFaces.push(faceId);
      } else {
        // Update photo count
        await this.faceRepository.update(faceId, {
          photoCount: photosWithFace.length,
        });
      }
    }

    return orphanedFaces;
  }

  /**
   * Get all faces with metadata
   * @returns {Promise<Array>} Array of face objects
   */
  async getAllFaces() {
    return this.faceRepository.findAll();
  }

  /**
   * Get face by ID
   * @param {string} faceId - Face ID to retrieve
   * @returns {Promise<Object|null>} Face object or null
   */
  async getFace(faceId) {
    return this.faceRepository.findById(faceId);
  }

  /**
   * Get face thumbnails for gallery display
   * @returns {Promise<Array>} Array of face thumbnails with metadata
   */
  async getFaceThumbnails() {
    const allFaces = await this.faceRepository.findAll();
    const allPhotos = await this.photoRepository.findAll();

    return allFaces.map((face) => {
      // Find a photo containing this face to get crop coordinates
      const photoWithFace = allPhotos.find(
        (photo) =>
          photo.mainFaceId === face.faceId ||
          photo.faceIds?.includes(face.faceId)
      );

      let faceUrl = null;
      if (photoWithFace) {
        const faceIndex = photoWithFace.faceIds?.indexOf(face.faceId);
        const box = photoWithFace.faceBoxes?.[faceIndex];

        if (box && photoWithFace.driveId) {
          // Generate crop URL
          faceUrl = `/api/face-crop/${photoWithFace.driveId}?x=${Math.round(
            box.x
          )}&y=${Math.round(box.y)}&w=${Math.round(box.width)}&h=${Math.round(
            box.height
          )}`;
        }
      }

      return {
        faceId: face.faceId,
        photoCount: face.photoCount || 0,
        thumbnailDriveId: face.thumbnailDriveId,
        faceUrl,
      };
    });
  }

  /**
   * Merge duplicate faces (manual admin operation)
   * @param {string} sourceFaceId - Face ID to merge from
   * @param {string} targetFaceId - Face ID to merge into
   * @returns {Promise<Object>} Merge result
   */
  async mergeFaces(sourceFaceId, targetFaceId) {
    const sourceFace = await this.faceRepository.findById(sourceFaceId);
    const targetFace = await this.faceRepository.findById(targetFaceId);

    if (!sourceFace || !targetFace) {
      throw new Error('Source or target face not found');
    }

    // Update all photos containing sourceFaceId
    const allPhotos = await this.photoRepository.findAll();
    const photosToUpdate = allPhotos.filter(
      (photo) =>
        photo.mainFaceId === sourceFaceId ||
        photo.faceIds?.includes(sourceFaceId)
    );

    for (const photo of photosToUpdate) {
      // Replace sourceFaceId with targetFaceId
      const updatedFaceIds = photo.faceIds.map((id) =>
        id === sourceFaceId ? targetFaceId : id
      );
      const updatedMainFaceId =
        photo.mainFaceId === sourceFaceId ? targetFaceId : photo.mainFaceId;

      await this.photoRepository.update(photo.id, {
        faceIds: updatedFaceIds,
        mainFaceId: updatedMainFaceId,
      });
    }

    // Merge metadata
    await this.faceRepository.update(targetFaceId, {
      photoCount: targetFace.photoCount + sourceFace.photoCount,
      // Keep earliest firstSeen
      firstSeen:
        new Date(sourceFace.firstSeen) < new Date(targetFace.firstSeen)
          ? sourceFace.firstSeen
          : targetFace.firstSeen,
      // Keep latest lastSeen
      lastSeen:
        new Date(sourceFace.lastSeen) > new Date(targetFace.lastSeen)
          ? sourceFace.lastSeen
          : targetFace.lastSeen,
    });

    // Delete source face
    await this.faceRepository.delete(sourceFaceId);

    return {
      success: true,
      mergedFrom: sourceFaceId,
      mergedInto: targetFaceId,
      photosUpdated: photosToUpdate.length,
    };
  }
}
