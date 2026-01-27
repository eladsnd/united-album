/**
 * High-Level Storage Operations
 *
 * Simple, provider-agnostic functions for all storage needs.
 * Your code calls these, the library handles the provider.
 *
 * Usage:
 *   import { uploadPhoto, deletePhoto, getPhotoUrl } from '@/lib/storage/operations';
 *   const { id, url } = await uploadPhoto(buffer, 'photo.jpg');
 *   await deletePhoto(id);
 *   const url = getPhotoUrl(id, { size: 'thumbnail' });
 */

import { getStorageAdapter } from './index';
import { getOptimizedUrl, getPlaceholderUrl, getFaceThumbnailUrl, storageConfig } from '../config/storage';

// =============================================================================
// PHOTO OPERATIONS
// =============================================================================

/**
 * Upload a photo
 * @param {Buffer} fileBuffer - Photo file buffer
 * @param {string} fileName - File name
 * @param {Object} options - Upload options
 * @returns {Promise<{id: string, url: string}>}
 */
export async function uploadPhoto(fileBuffer, fileName, options = {}) {
  const { folder = 'united-album/photos', mimeType = 'image/jpeg', publicId = null } = options;

  const storage = getStorageAdapter();
  const result = await storage.upload(fileBuffer, fileName, {
    folder,
    mimeType,
    publicId,
  });

  console.log(`[Storage] Photo uploaded: ${result.id} via ${storage.getName()}`);
  return result;
}

/**
 * Upload a pose challenge image
 * @param {Buffer} fileBuffer - Image file buffer
 * @param {string} fileName - File name
 * @param {string} publicId - Human-readable public ID (challenge slug)
 * @returns {Promise<{id: string, url: string}>}
 */
export async function uploadChallengeImage(fileBuffer, fileName, publicId = null) {
  return uploadPhoto(fileBuffer, fileName, {
    folder: 'united-album/challenges',
    mimeType: 'image/jpeg',
    publicId,
  });
}

/**
 * Upload a face thumbnail
 * @param {Buffer} fileBuffer - Face crop buffer
 * @param {string} fileName - File name
 * @returns {Promise<{id: string, url: string}>}
 */
export async function uploadFaceThumbnail(fileBuffer, fileName) {
  return uploadPhoto(fileBuffer, fileName, {
    folder: 'united-album/faces',
    mimeType: 'image/jpeg',
  });
}

/**
 * Delete a photo
 * @param {string} fileId - File identifier
 * @returns {Promise<void>}
 */
export async function deletePhoto(fileId) {
  if (!fileId) {
    throw new Error('File ID is required for deletion');
  }

  const storage = getStorageAdapter();
  await storage.delete(fileId);
  console.log(`[Storage] Photo deleted: ${fileId} via ${storage.getName()}`);
}

// =============================================================================
// URL OPERATIONS (Smart URLs based on provider and optimizations)
// =============================================================================

/**
 * Get photo URL with optional optimizations
 * @param {string} fileId - File identifier
 * @param {Object} options - URL options
 * @param {string} options.size - Size preset: 'thumbnail', 'gallery', 'fullsize'
 * @param {number} options.width - Custom width
 * @param {number} options.height - Custom height
 * @param {string} options.quality - Quality: 'auto', 'auto:good', 'auto:best', or number
 * @returns {string} - Optimized photo URL
 */
export function getPhotoUrl(fileId, options = {}) {
  const { size, width, height, quality } = options;

  const storage = getStorageAdapter();

  // If size preset specified, use optimized URL
  if (size && !width && !height) {
    return getOptimizedUrl(storage, fileId, size);
  }

  // Custom dimensions
  if (width || height) {
    return storage.getUrl(fileId, {
      width,
      height,
      quality: quality || 'auto',
      fetch_format: 'auto',
    });
  }

  // Default: basic URL
  return storage.getUrl(fileId);
}

/**
 * Get placeholder URL for lazy loading
 * @param {string} fileId - File identifier
 * @returns {string|null} - Tiny blurred preview URL or null
 */
export function getPhotoPlaceholder(fileId) {
  const storage = getStorageAdapter();
  return getPlaceholderUrl(storage, fileId);
}

/**
 * Get face thumbnail URL
 * @param {string} fileId - File identifier
 * @param {boolean} useFaceDetection - Use Cloudinary face detection if available
 * @returns {string} - Face thumbnail URL
 */
export function getFaceUrl(fileId, useFaceDetection = true) {
  const storage = getStorageAdapter();
  return getFaceThumbnailUrl(storage, fileId, useFaceDetection);
}

/**
 * Get download URL (full quality, no optimizations)
 * @param {string} fileId - File identifier
 * @returns {string} - Download URL
 */
export function getDownloadUrl(fileId) {
  const storage = getStorageAdapter();

  // For Cloudinary: return full quality URL
  if (storage.getName() === 'cloudinary') {
    return storage.getUrl(fileId, {
      quality: '90',
      fetch_format: 'auto',
    });
  }

  // For Google Drive: use download proxy
  return `/api/download/${fileId}`;
}

// =============================================================================
// STREAM OPERATIONS (For serving files)
// =============================================================================

/**
 * Get file stream for downloading
 * @param {string} fileId - File identifier
 * @returns {Promise<{stream: ReadableStream, contentType: string}>}
 */
export async function getPhotoStream(fileId) {
  const storage = getStorageAdapter();
  const result = await storage.getStream(fileId);
  return result;
}

// =============================================================================
// FOLDER OPERATIONS
// =============================================================================

/**
 * Create or get a folder
 * @param {string} folderName - Folder name
 * @param {string} parentId - Parent folder ID (optional)
 * @returns {Promise<string>} - Folder ID
 */
export async function createFolder(folderName, parentId = null) {
  const storage = getStorageAdapter();
  const folderId = await storage.createFolder(folderName, parentId);
  console.log(`[Storage] Folder ready: ${folderName} (${folderId})`);
  return folderId;
}

/**
 * List files in a folder
 * @param {string} folderId - Folder ID (optional)
 * @returns {Promise<Set<string>>} - Set of file IDs
 */
export async function listFiles(folderId = null) {
  const storage = getStorageAdapter();
  return storage.listFiles(folderId);
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get current storage provider name
 * @returns {string} - Provider name: 'cloudinary', 'google-drive', etc.
 */
export function getProviderName() {
  const storage = getStorageAdapter();
  return storage.getName();
}

/**
 * Check if using Cloudinary
 * @returns {boolean}
 */
export function isCloudinary() {
  return getProviderName() === 'cloudinary';
}

/**
 * Check if using Google Drive
 * @returns {boolean}
 */
export function isGoogleDrive() {
  return getProviderName() === 'google-drive';
}

/**
 * Get storage configuration
 * @returns {Object} - Storage config
 */
export function getStorageConfig() {
  return storageConfig;
}

// =============================================================================
// BATCH OPERATIONS
// =============================================================================

/**
 * Upload multiple photos in parallel
 * @param {Array<{buffer: Buffer, fileName: string}>} photos - Photos to upload
 * @param {Object} options - Upload options
 * @returns {Promise<Array<{id: string, url: string}>>}
 */
export async function uploadPhotos(photos, options = {}) {
  const results = await Promise.all(
    photos.map(({ buffer, fileName }) => uploadPhoto(buffer, fileName, options))
  );
  console.log(`[Storage] Batch uploaded ${results.length} photos via ${getProviderName()}`);
  return results;
}

/**
 * Delete multiple photos in parallel
 * @param {Array<string>} fileIds - File IDs to delete
 * @returns {Promise<void>}
 */
export async function deletePhotos(fileIds) {
  await Promise.all(fileIds.map((id) => deletePhoto(id)));
  console.log(`[Storage] Batch deleted ${fileIds.length} photos via ${getProviderName()}`);
}

// =============================================================================
// MIGRATION HELPERS
// =============================================================================

/**
 * Check if a URL is from a specific provider
 * @param {string} url - Photo URL
 * @returns {string} - Provider name: 'cloudinary', 'google-drive', 'unknown'
 */
export function detectProvider(url) {
  if (!url) return 'unknown';

  if (url.includes('cloudinary.com')) return 'cloudinary';
  if (url.includes('/api/image/') || url.includes('drive.google.com')) return 'google-drive';

  return 'unknown';
}

/**
 * Extract file ID from URL
 * @param {string} url - Photo URL
 * @returns {string|null} - File ID or null
 */
export function extractFileId(url) {
  if (!url) return null;

  // Cloudinary: extract public_id from URL
  if (url.includes('cloudinary.com')) {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
    return match ? match[1] : null;
  }

  // Google Drive: extract from proxy URL
  if (url.includes('/api/image/')) {
    const match = url.match(/\/api\/image\/(.+)$/);
    return match ? match[1] : null;
  }

  return null;
}

// Export all functions
export default {
  // Upload
  uploadPhoto,
  uploadChallengeImage,
  uploadFaceThumbnail,
  uploadPhotos,

  // Delete
  deletePhoto,
  deletePhotos,

  // URLs
  getPhotoUrl,
  getPhotoPlaceholder,
  getFaceUrl,
  getDownloadUrl,

  // Stream
  getPhotoStream,

  // Folders
  createFolder,
  listFiles,

  // Utilities
  getProviderName,
  isCloudinary,
  isGoogleDrive,
  getStorageConfig,
  detectProvider,
  extractFileId,
};
