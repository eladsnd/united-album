import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { AppError } from '../errors/app-error.js';

/**
 * DriveService handles all Google Drive operations
 * Wraps Google Drive API with business logic and error handling
 */
@Injectable()
export class DriveService {
  constructor() {
    this.drive = null;
  }

  /**
   * Initialize Google Drive client with OAuth credentials
   * @private
   * @returns {Promise<google.drive_v3.Drive>}
   */
  async getDriveClient() {
    if (this.drive) {
      return this.drive;
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    this.drive = google.drive({ version: 'v3', auth: oauth2Client });
    return this.drive;
  }

  /**
   * Upload a file to Google Drive
   * @param {Buffer|ReadableStream} fileData - File data to upload
   * @param {string} fileName - Name for the uploaded file
   * @param {string} folderId - Parent folder ID
   * @returns {Promise<Object>} Uploaded file metadata
   */
  async uploadFile(fileData, fileName, folderId) {
    try {
      const drive = await this.getDriveClient();

      // Convert Buffer to ReadableStream if needed
      const media = {
        mimeType: this.getMimeType(fileName),
        body: Buffer.isBuffer(fileData) ? Readable.from(fileData) : fileData,
      };

      const fileMetadata = {
        name: fileName,
        parents: folderId ? [folderId] : [],
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: 'id, name, webViewLink, webContentLink',
      });

      // Make file publicly accessible
      await drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      return response.data;
    } catch (error) {
      throw new AppError(
        `Failed to upload file to Google Drive: ${error.message}`,
        500,
        'DRIVE_UPLOAD_FAILED'
      );
    }
  }

  /**
   * Delete a file from Google Drive
   * @param {string} fileId - File ID to delete
   * @returns {Promise<void>}
   */
  async deleteFile(fileId) {
    try {
      const drive = await this.getDriveClient();
      await drive.files.delete({ fileId });
    } catch (error) {
      // Ignore 404 errors (file already deleted)
      if (error.code !== 404) {
        throw new AppError(
          `Failed to delete file from Google Drive: ${error.message}`,
          500,
          'DRIVE_DELETE_FAILED'
        );
      }
    }
  }

  /**
   * Get file stream from Google Drive
   * @param {string} fileId - File ID to download
   * @returns {Promise<ReadableStream>} File stream
   */
  async getFileStream(fileId) {
    try {
      const drive = await this.getDriveClient();
      const response = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );
      return response.data;
    } catch (error) {
      throw new AppError(
        `Failed to get file from Google Drive: ${error.message}`,
        500,
        'DRIVE_GET_FAILED'
      );
    }
  }

  /**
   * Get file metadata from Google Drive
   * @param {string} fileId - File ID
   * @returns {Promise<Object>} File metadata
   */
  async getFileMetadata(fileId) {
    try {
      const drive = await this.getDriveClient();
      const response = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, createdTime, modifiedTime',
      });
      return response.data;
    } catch (error) {
      throw new AppError(
        `Failed to get file metadata: ${error.message}`,
        500,
        'DRIVE_METADATA_FAILED'
      );
    }
  }

  /**
   * List files in a folder
   * @param {string} folderId - Folder ID to list
   * @param {number} pageSize - Number of files per page
   * @returns {Promise<Array>} Array of file metadata
   */
  async listFiles(folderId, pageSize = 100) {
    try {
      const drive = await this.getDriveClient();
      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        pageSize,
        fields: 'files(id, name, mimeType, size, createdTime)',
      });
      return response.data.files || [];
    } catch (error) {
      throw new AppError(
        `Failed to list files: ${error.message}`,
        500,
        'DRIVE_LIST_FAILED'
      );
    }
  }

  /**
   * Create a folder in Google Drive
   * @param {string} folderName - Name of the folder
   * @param {string} parentFolderId - Parent folder ID
   * @returns {Promise<Object>} Created folder metadata
   */
  async createFolder(folderName, parentFolderId) {
    try {
      const drive = await this.getDriveClient();
      const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : [],
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id, name',
      });

      return response.data;
    } catch (error) {
      throw new AppError(
        `Failed to create folder: ${error.message}`,
        500,
        'DRIVE_CREATE_FOLDER_FAILED'
      );
    }
  }

  /**
   * Find or create a folder
   * @param {string} folderName - Name of the folder
   * @param {string} parentFolderId - Parent folder ID
   * @returns {Promise<string>} Folder ID
   */
  async findOrCreateFolder(folderName, parentFolderId) {
    try {
      const drive = await this.getDriveClient();

      // Search for existing folder
      const query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`;
      const response = await drive.files.list({
        q: query,
        fields: 'files(id, name)',
        pageSize: 1,
      });

      if (response.data.files && response.data.files.length > 0) {
        // Folder exists, return its ID
        return response.data.files[0].id;
      }

      // Folder doesn't exist, create it
      const newFolder = await this.createFolder(folderName, parentFolderId);
      return newFolder.id;
    } catch (error) {
      throw new AppError(
        `Failed to find or create folder: ${error.message}`,
        500,
        'DRIVE_FIND_CREATE_FOLDER_FAILED'
      );
    }
  }

  /**
   * Get MIME type from file name
   * @private
   * @param {string} fileName - File name
   * @returns {string} MIME type
   */
  getMimeType(fileName) {
    const extension = fileName.split('.').pop().toLowerCase();
    const mimeTypes = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
    };
    return mimeTypes[extension] || 'application/octet-stream';
  }

  /**
   * Download file as buffer
   * @param {string} fileId - File ID to download
   * @returns {Promise<Buffer>} File buffer
   */
  async downloadFileAsBuffer(fileId) {
    try {
      const stream = await this.getFileStream(fileId);
      const chunks = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    } catch (error) {
      throw new AppError(
        `Failed to download file: ${error.message}`,
        500,
        'DRIVE_DOWNLOAD_FAILED'
      );
    }
  }
}
