/**
 * Storage Adapter Interface
 *
 * Abstract base class that defines the contract for all storage providers.
 * Allows switching between Cloudinary, Google Drive, GCS, etc. seamlessly.
 *
 * Usage:
 *   import { getStorageAdapter } from '@/lib/storage';
 *   const storage = getStorageAdapter();
 *   const result = await storage.upload(buffer, 'photo.jpg');
 */

export class StorageAdapter {
  /**
   * Upload a file to storage
   * @param {Buffer} fileBuffer - File content as buffer
   * @param {string} fileName - Name of the file
   * @param {Object} options - Provider-specific options
   * @param {string} options.folder - Folder/path to upload to
   * @param {string} options.mimeType - MIME type of the file
   * @returns {Promise<{id: string, url: string}>} - File ID and public URL
   */
  async upload(fileBuffer, fileName, options = {}) {
    throw new Error('upload() must be implemented by storage provider');
  }

  /**
   * Delete a file from storage
   * @param {string} fileId - File identifier
   * @returns {Promise<void>}
   */
  async delete(fileId) {
    throw new Error('delete() must be implemented by storage provider');
  }

  /**
   * Get a file stream for downloading
   * @param {string} fileId - File identifier
   * @returns {Promise<{stream: ReadableStream, contentType: string}>}
   */
  async getStream(fileId) {
    throw new Error('getStream() must be implemented by storage provider');
  }

  /**
   * Get public URL for a file
   * @param {string} fileId - File identifier
   * @param {Object} options - URL options (transformations, etc.)
   * @returns {string} - Public URL
   */
  getUrl(fileId, options = {}) {
    throw new Error('getUrl() must be implemented by storage provider');
  }

  /**
   * Create or get a folder
   * @param {string} folderName - Folder name
   * @param {string} parentId - Parent folder ID (optional)
   * @returns {Promise<string>} - Folder ID
   */
  async createFolder(folderName, parentId = null) {
    throw new Error('createFolder() must be implemented by storage provider');
  }

  /**
   * List files in storage
   * @param {string} folderId - Folder ID to list (optional)
   * @returns {Promise<Set<string>>} - Set of file IDs
   */
  async listFiles(folderId = null) {
    throw new Error('listFiles() must be implemented by storage provider');
  }

  /**
   * Get storage provider name
   * @returns {string}
   */
  getName() {
    return 'base';
  }
}
