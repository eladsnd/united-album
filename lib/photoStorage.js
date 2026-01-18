/**
 * Photo Storage Layer - Prisma Version
 *
 * Replaced JSON file storage with Prisma ORM for PostgreSQL/SQLite database.
 *
 * Benefits over JSON files:
 * - No race conditions (database handles concurrency)
 * - ACID transactions (atomic operations)
 * - Persistent storage on serverless platforms
 * - Better performance with indexes
 * - No file locking needed (database handles it)
 *
 * Migration notes:
 * - All functions now async (return Promises)
 * - Arrays/objects stored as JSON strings for SQLite compatibility
 * - driveId is unique constraint (prevents duplicates)
 * - Auto-incrementing IDs managed by database
 */

import prisma from './prisma.js';

/**
 * Save a new photo to the database
 *
 * Uses upsert to handle duplicates (by driveId).
 * If photo with same driveId exists, it updates instead of creating.
 *
 * @param {Object} photo - Photo object with driveId, name, url, etc.
 * @returns {Promise<Object>} The saved photo record
 */
export async function savePhoto(photo) {
  try {
    // Convert arrays/objects to JSON strings for SQLite compatibility
    const photoData = {
      name: photo.name || 'unknown.jpg',
      driveId: photo.driveId,
      url: photo.url || `/api/image/${photo.driveId}`,
      mainFaceId: photo.mainFaceId || 'unknown',
      faceIds: Array.isArray(photo.faceIds)
        ? JSON.stringify(photo.faceIds)
        : photo.faceIds || '[]',
      faceBoxes: Array.isArray(photo.faceBoxes)
        ? JSON.stringify(photo.faceBoxes)
        : photo.faceBoxes || '[]',
      poseId: photo.poseId || 'unknown_pose',
      uploaderId: photo.uploaderId || null,
      timestamp: photo.timestamp ? new Date(photo.timestamp) : new Date(),
    };

    // Upsert: insert if new, update if exists (by driveId)
    const savedPhoto = await prisma.photo.upsert({
      where: { driveId: photoData.driveId },
      update: photoData,
      create: photoData,
    });

    console.log(`[Photo Storage] Saved photo ${savedPhoto.driveId} (ID: ${savedPhoto.id})`);
    return savedPhoto;
  } catch (error) {
    console.error('[Photo Storage] Failed to save photo:', error);
    throw error;
  }
}

/**
 * Get all photos from the database
 *
 * Returns photos ordered by timestamp (most recent first).
 * Automatically parses JSON string fields back to arrays.
 *
 * @returns {Promise<Array>} Array of photo objects
 */
export async function getPhotos() {
  try {
    const photos = await prisma.photo.findMany({
      orderBy: { timestamp: 'desc' },
    });

    // Parse JSON strings back to arrays for compatibility
    return photos.map(photo => ({
      ...photo,
      faceIds: JSON.parse(photo.faceIds || '[]'),
      faceBoxes: JSON.parse(photo.faceBoxes || '[]'),
    }));
  } catch (error) {
    console.error('[Photo Storage] Failed to get photos:', error);
    throw error;
  }
}

/**
 * Get a single photo by driveId
 *
 * @param {string} driveId - Google Drive file ID
 * @returns {Promise<Object|null>} Photo object or null if not found
 */
export async function getPhotoByDriveId(driveId) {
  try {
    const photo = await prisma.photo.findUnique({
      where: { driveId },
    });

    if (!photo) {
      return null;
    }

    // Parse JSON strings back to arrays
    return {
      ...photo,
      faceIds: JSON.parse(photo.faceIds || '[]'),
      faceBoxes: JSON.parse(photo.faceBoxes || '[]'),
    };
  } catch (error) {
    console.error('[Photo Storage] Failed to get photo by driveId:', error);
    throw error;
  }
}

/**
 * Update an existing photo by database ID
 *
 * Merges provided updates with existing photo data.
 * Converts arrays to JSON strings automatically.
 *
 * @param {number} photoId - Database photo ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object|null>} Updated photo or null if not found
 */
export async function updatePhoto(photoId, updates) {
  try {
    // Convert arrays to JSON strings if present
    const processedUpdates = { ...updates };

    if (Array.isArray(updates.faceIds)) {
      processedUpdates.faceIds = JSON.stringify(updates.faceIds);
    }

    if (Array.isArray(updates.faceBoxes)) {
      processedUpdates.faceBoxes = JSON.stringify(updates.faceBoxes);
    }

    const updatedPhoto = await prisma.photo.update({
      where: { id: photoId },
      data: processedUpdates,
    });

    console.log(`[Photo Storage] Updated photo ${photoId}:`, Object.keys(updates));

    // Parse JSON strings back to arrays
    return {
      ...updatedPhoto,
      faceIds: JSON.parse(updatedPhoto.faceIds || '[]'),
      faceBoxes: JSON.parse(updatedPhoto.faceBoxes || '[]'),
    };
  } catch (error) {
    if (error.code === 'P2025') {
      // Prisma error: Record not found
      console.error(`[Photo Storage] Photo ${photoId} not found`);
      return null;
    }
    console.error('[Photo Storage] Failed to update photo:', error);
    throw error;
  }
}

/**
 * Delete a photo by driveId
 *
 * Returns true if photo was deleted, false if not found.
 *
 * @param {string} driveId - Google Drive file ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
export async function deletePhoto(driveId) {
  try {
    await prisma.photo.delete({
      where: { driveId },
    });

    console.log(`[Photo Storage] Deleted photo with driveId: ${driveId}`);
    return true;
  } catch (error) {
    if (error.code === 'P2025') {
      // Prisma error: Record not found
      console.log(`[Photo Storage] Photo with driveId ${driveId} not found`);
      return false;
    }
    console.error('[Photo Storage] Failed to delete photo:', error);
    throw error;
  }
}

/**
 * Get photos filtered by mainFaceId
 *
 * @param {string} faceId - Face ID to filter by (e.g., "person_1")
 * @returns {Promise<Array>} Array of photos with this mainFaceId
 */
export async function getPhotosByMainFace(faceId) {
  try {
    const photos = await prisma.photo.findMany({
      where: { mainFaceId: faceId },
      orderBy: { timestamp: 'desc' },
    });

    return photos.map(photo => ({
      ...photo,
      faceIds: JSON.parse(photo.faceIds || '[]'),
      faceBoxes: JSON.parse(photo.faceBoxes || '[]'),
    }));
  } catch (error) {
    console.error('[Photo Storage] Failed to get photos by main face:', error);
    throw error;
  }
}

/**
 * Get photos filtered by poseId
 *
 * @param {string} poseId - Pose/challenge ID to filter by
 * @returns {Promise<Array>} Array of photos with this poseId
 */
export async function getPhotosByPose(poseId) {
  try {
    const photos = await prisma.photo.findMany({
      where: { poseId },
      orderBy: { timestamp: 'desc' },
    });

    return photos.map(photo => ({
      ...photo,
      faceIds: JSON.parse(photo.faceIds || '[]'),
      faceBoxes: JSON.parse(photo.faceBoxes || '[]'),
    }));
  } catch (error) {
    console.error('[Photo Storage] Failed to get photos by pose:', error);
    throw error;
  }
}

/**
 * Get photos filtered by uploaderId
 *
 * @param {string} uploaderId - Uploader session ID
 * @returns {Promise<Array>} Array of photos uploaded by this user
 */
export async function getPhotosByUploader(uploaderId) {
  try {
    const photos = await prisma.photo.findMany({
      where: { uploaderId },
      orderBy: { timestamp: 'desc' },
    });

    return photos.map(photo => ({
      ...photo,
      faceIds: JSON.parse(photo.faceIds || '[]'),
      faceBoxes: JSON.parse(photo.faceBoxes || '[]'),
    }));
  } catch (error) {
    console.error('[Photo Storage] Failed to get photos by uploader:', error);
    throw error;
  }
}

/**
 * Get photos containing a specific faceId (in faceIds array)
 *
 * Note: SQLite stores faceIds as JSON string, so we need to use LIKE query.
 * For PostgreSQL, this could be optimized with JSONB contains operator.
 *
 * @param {string} faceId - Face ID to search for
 * @returns {Promise<Array>} Array of photos containing this face
 */
export async function getPhotosContainingFace(faceId) {
  try {
    // Get all photos and filter in-memory (works for SQLite and PostgreSQL)
    const photos = await prisma.photo.findMany({
      orderBy: { timestamp: 'desc' },
    });

    const filtered = photos.filter(photo => {
      const faceIds = JSON.parse(photo.faceIds || '[]');
      return faceIds.includes(faceId);
    });

    return filtered.map(photo => ({
      ...photo,
      faceIds: JSON.parse(photo.faceIds || '[]'),
      faceBoxes: JSON.parse(photo.faceBoxes || '[]'),
    }));
  } catch (error) {
    console.error('[Photo Storage] Failed to get photos containing face:', error);
    throw error;
  }
}

/**
 * Count total photos in database
 *
 * @returns {Promise<number>} Total photo count
 */
export async function getPhotoCount() {
  try {
    return await prisma.photo.count();
  } catch (error) {
    console.error('[Photo Storage] Failed to count photos:', error);
    throw error;
  }
}
