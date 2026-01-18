/**
 * Face Storage Layer - Prisma Version
 *
 * Replaced JSON file storage with Prisma ORM for PostgreSQL/SQLite database.
 *
 * Face recognition data includes:
 * - Multiple descriptor samples (up to 5) for better matching accuracy
 * - Average descriptor calculated from samples
 * - Thumbnail Drive ID for face image
 * - Photo count and last seen timestamp
 *
 * Migration notes:
 * - All functions now async (return Promises)
 * - Arrays/objects stored as JSON strings for SQLite compatibility
 * - Automatic descriptor averaging for multi-sample recognition
 * - Upsert pattern for adding new descriptor samples
 */

import prisma from './prisma.js';

/**
 * Calculate average descriptor from array of descriptors
 *
 * Used for multi-descriptor face matching. Averages multiple 128D vectors
 * from different photos of the same person for better recognition accuracy.
 *
 * @param {Array<Array<number>>} descriptors - Array of 128D face descriptors
 * @returns {Array<number>|null} Average 128D descriptor or null if empty
 */
function calculateAverageDescriptor(descriptors) {
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
 * @param {string} faceId - Face identifier (e.g., "person_1")
 * @param {Array<number>} descriptor - 128D face descriptor vector
 * @param {Object} metadata - Additional metadata (thumbnailDriveId, etc.)
 * @returns {Promise<Object>} Saved face record
 */
export async function saveFaceDescriptor(faceId, descriptor, metadata = {}) {
  try {
    // Check if face exists
    const existingFace = await prisma.face.findUnique({
      where: { faceId },
    });

    if (existingFace) {
      // Update existing face - append new descriptor
      const existingDescriptors = JSON.parse(existingFace.descriptors || '[]');

      // Add new descriptor (max 5 samples, rolling window)
      const updatedDescriptors = [...existingDescriptors, descriptor];
      if (updatedDescriptors.length > 5) {
        updatedDescriptors.shift(); // Remove oldest sample
      }

      // Calculate new average
      const avgDescriptor = calculateAverageDescriptor(updatedDescriptors);

      const updatedFace = await prisma.face.update({
        where: { faceId },
        data: {
          descriptors: JSON.stringify(updatedDescriptors),
          descriptor: JSON.stringify(avgDescriptor),
          metadata: JSON.stringify(metadata),
          thumbnailDriveId: metadata.thumbnailDriveId || existingFace.thumbnailDriveId,
          lastSeen: new Date(),
          photoCount: existingFace.photoCount + 1,
          sampleCount: updatedDescriptors.length,
        },
      });

      console.log(`[Face Storage] Updated face: ${faceId} (${updatedDescriptors.length} samples)`);
      return updatedFace;
    } else {
      // New face
      const newFace = await prisma.face.create({
        data: {
          faceId,
          descriptors: JSON.stringify([descriptor]),
          descriptor: JSON.stringify(descriptor),
          metadata: JSON.stringify(metadata),
          thumbnailDriveId: metadata.thumbnailDriveId || null,
          lastSeen: new Date(),
          photoCount: 1,
          sampleCount: 1,
        },
      });

      console.log(`[Face Storage] Added new face: ${faceId} (1 sample)`);
      return newFace;
    }
  } catch (error) {
    console.error('[Face Storage] Failed to save face descriptor:', error);
    throw error;
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
export async function getAverageDescriptor(faceId) {
  try {
    const face = await prisma.face.findUnique({
      where: { faceId },
      select: { descriptor: true, descriptors: true },
    });

    if (!face) return null;

    // Return average descriptor
    const avgDescriptor = JSON.parse(face.descriptor || '[]');
    if (avgDescriptor.length > 0) {
      return avgDescriptor;
    }

    // Fallback: calculate from descriptors if avg not available
    const descriptors = JSON.parse(face.descriptors || '[]');
    if (descriptors.length > 0) {
      return calculateAverageDescriptor(descriptors);
    }

    return null;
  } catch (error) {
    console.error('[Face Storage] Failed to get average descriptor:', error);
    throw error;
  }
}

/**
 * Get all known faces
 *
 * Returns all face records ordered by photo count (most photos first).
 * Automatically parses JSON string fields back to arrays/objects.
 *
 * @returns {Promise<Array>} Array of face objects
 */
export async function getAllFaces() {
  try {
    const faces = await prisma.face.findMany({
      orderBy: { photoCount: 'desc' },
    });

    // Parse JSON strings back to arrays/objects
    return faces.map(face => ({
      ...face,
      descriptors: JSON.parse(face.descriptors || '[]'),
      descriptor: JSON.parse(face.descriptor || '[]'),
      metadata: JSON.parse(face.metadata || '{}'),
    }));
  } catch (error) {
    console.error('[Face Storage] Failed to get all faces:', error);
    throw error;
  }
}

/**
 * Get a specific face by ID
 *
 * @param {string} faceId - Face identifier
 * @returns {Promise<Object|null>} Face object or null if not found
 */
export async function getFaceById(faceId) {
  try {
    const face = await prisma.face.findUnique({
      where: { faceId },
    });

    if (!face) {
      return null;
    }

    // Parse JSON strings back to arrays/objects
    return {
      ...face,
      descriptors: JSON.parse(face.descriptors || '[]'),
      descriptor: JSON.parse(face.descriptor || '[]'),
      metadata: JSON.parse(face.metadata || '{}'),
    };
  } catch (error) {
    console.error('[Face Storage] Failed to get face by ID:', error);
    throw error;
  }
}

/**
 * Delete a face
 *
 * Used when a face is orphaned (no longer appears in any photos).
 *
 * @param {string} faceId - Face identifier
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
export async function deleteFace(faceId) {
  try {
    await prisma.face.delete({
      where: { faceId },
    });

    console.log(`[Face Storage] Deleted face: ${faceId}`);
    return true;
  } catch (error) {
    if (error.code === 'P2025') {
      // Prisma error: Record not found
      console.log(`[Face Storage] Face ${faceId} not found`);
      return false;
    }
    console.error('[Face Storage] Failed to delete face:', error);
    throw error;
  }
}

/**
 * Update face photo count
 *
 * Increments or decrements the count of photos containing this face.
 * Used when photos are added or deleted.
 *
 * @param {string} faceId - Face identifier
 * @param {number} delta - Amount to change (+1 or -1)
 * @returns {Promise<Object|null>} Updated face or null if not found
 */
export async function updateFacePhotoCount(faceId, delta) {
  try {
    const updatedFace = await prisma.face.update({
      where: { faceId },
      data: {
        photoCount: {
          increment: delta,
        },
      },
    });

    console.log(`[Face Storage] Updated photo count for ${faceId}: ${updatedFace.photoCount}`);
    return updatedFace;
  } catch (error) {
    if (error.code === 'P2025') {
      // Prisma error: Record not found
      console.error(`[Face Storage] Face ${faceId} not found`);
      return null;
    }
    console.error('[Face Storage] Failed to update face photo count:', error);
    throw error;
  }
}

/**
 * Get faces with thumbnails
 *
 * Returns only faces that have thumbnail images.
 * Useful for displaying face filters in the gallery.
 *
 * @returns {Promise<Array>} Array of faces with thumbnails
 */
export async function getFacesWithThumbnails() {
  try {
    const faces = await prisma.face.findMany({
      where: {
        thumbnailDriveId: {
          not: null,
        },
      },
      orderBy: { photoCount: 'desc' },
    });

    return faces.map(face => ({
      ...face,
      descriptors: JSON.parse(face.descriptors || '[]'),
      descriptor: JSON.parse(face.descriptor || '[]'),
      metadata: JSON.parse(face.metadata || '{}'),
    }));
  } catch (error) {
    console.error('[Face Storage] Failed to get faces with thumbnails:', error);
    throw error;
  }
}

/**
 * Get orphaned faces (photoCount = 0)
 *
 * Returns faces that no longer appear in any photos.
 * These can be safely deleted to clean up the database.
 *
 * @returns {Promise<Array>} Array of orphaned face IDs
 */
export async function getOrphanedFaces() {
  try {
    const faces = await prisma.face.findMany({
      where: { photoCount: 0 },
      select: { faceId: true },
    });

    return faces.map(face => face.faceId);
  } catch (error) {
    console.error('[Face Storage] Failed to get orphaned faces:', error);
    throw error;
  }
}

/**
 * Delete orphaned faces
 *
 * Removes all faces with photoCount = 0.
 * Returns count of faces deleted.
 *
 * @returns {Promise<number>} Number of faces deleted
 */
export async function deleteOrphanedFaces() {
  try {
    const result = await prisma.face.deleteMany({
      where: { photoCount: 0 },
    });

    console.log(`[Face Storage] Deleted ${result.count} orphaned faces`);
    return result.count;
  } catch (error) {
    console.error('[Face Storage] Failed to delete orphaned faces:', error);
    throw error;
  }
}
