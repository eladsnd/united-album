/**
 * Google Drive Storage Adapter
 *
 * Implementation of StorageAdapter for Google Drive.
 *
 * FREE TIER:
 * - 15 GB storage
 * - OAuth authentication (tokens can expire!)
 * - Requires periodic token refresh
 *
 * Setup:
 * 1. Run: npm run oauth
 * 2. Add to .env.local:
 *    GOOGLE_CLIENT_ID=your_client_id
 *    GOOGLE_CLIENT_SECRET=your_client_secret
 *    GOOGLE_REFRESH_TOKEN=your_refresh_token
 *    GOOGLE_DRIVE_FOLDER_ID=your_folder_id
 *
 * See GOOGLE_DRIVE_SETUP.md for detailed instructions
 */

import { StorageAdapter } from './StorageAdapter';
import {
  uploadToDrive,
  deleteFromDrive,
  getFileStream,
  findOrCreateFolder,
  listDriveFiles,
} from '../googleDrive';

export class GoogleDriveAdapter extends StorageAdapter {
  constructor() {
    super();
    this.rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!this.rootFolderId) {
      throw new Error(
        'Google Drive folder ID missing. Please set GOOGLE_DRIVE_FOLDER_ID in .env.local'
      );
    }

    // Validate OAuth credentials
    if (
      !process.env.GOOGLE_CLIENT_ID ||
      !process.env.GOOGLE_CLIENT_SECRET ||
      !process.env.GOOGLE_REFRESH_TOKEN
    ) {
      throw new Error(
        'Google Drive OAuth credentials missing. Run: npm run oauth'
      );
    }
  }

  /**
   * Upload a file to Google Drive
   */
  async upload(fileBuffer, fileName, options = {}) {
    const { folder = null, mimeType = 'image/jpeg' } = options;

    try {
      // Determine parent folder ID
      let parentFolderId = this.rootFolderId;

      // If folder specified, find or create subfolder
      if (folder) {
        parentFolderId = await this.createFolder(folder, this.rootFolderId);
      }

      // Upload to Drive
      const result = await uploadToDrive(fileBuffer, fileName, parentFolderId);

      return {
        id: result.id, // Google Drive file ID
        url: `/api/image/${result.id}`, // Proxy URL for serving
      };
    } catch (error) {
      console.error('[GoogleDriveAdapter] Upload error:', error);
      throw error;
    }
  }

  /**
   * Delete a file from Google Drive
   */
  async delete(fileId) {
    try {
      await deleteFromDrive(fileId);
      console.log(`[GoogleDriveAdapter] Deleted file: ${fileId}`);
    } catch (error) {
      console.error('[GoogleDriveAdapter] Delete error:', error);
      throw error;
    }
  }

  /**
   * Get file stream from Google Drive
   */
  async getStream(fileId) {
    try {
      const result = await getFileStream(fileId);
      return {
        stream: result.stream,
        contentType: result.contentType,
      };
    } catch (error) {
      console.error('[GoogleDriveAdapter] Stream error:', error);
      throw error;
    }
  }

  /**
   * Get URL for a file
   * Google Drive files are served through proxy API
   */
  getUrl(fileId, options = {}) {
    return `/api/image/${fileId}`;
  }

  /**
   * Create or find a folder
   */
  async createFolder(folderName, parentId = null) {
    try {
      const parentFolderId = parentId || this.rootFolderId;
      const folderId = await findOrCreateFolder(folderName, parentFolderId);
      console.log(`[GoogleDriveAdapter] Folder ready: ${folderName} (${folderId})`);
      return folderId;
    } catch (error) {
      console.error('[GoogleDriveAdapter] Create folder error:', error);
      throw error;
    }
  }

  /**
   * List files in Google Drive
   */
  async listFiles(folderId = null) {
    try {
      const targetFolder = folderId || this.rootFolderId;
      const fileIds = await listDriveFiles(targetFolder);
      return fileIds;
    } catch (error) {
      console.error('[GoogleDriveAdapter] List files error:', error);
      return new Set();
    }
  }

  getName() {
    return 'google-drive';
  }
}
