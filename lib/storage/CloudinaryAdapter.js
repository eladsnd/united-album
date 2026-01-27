/**
 * Cloudinary Storage Adapter
 *
 * Implementation of StorageAdapter for Cloudinary.
 *
 * FREE TIER:
 * - 25 GB storage
 * - 25 GB bandwidth/month
 * - Automatic image optimization
 * - Built-in CDN
 * - No OAuth token expiration!
 *
 * Setup:
 * 1. Sign up: https://cloudinary.com/users/register/free
 * 2. Get credentials from dashboard: https://console.cloudinary.com/
 * 3. Add to .env.local:
 *    CLOUDINARY_CLOUD_NAME=your_cloud_name
 *    CLOUDINARY_API_KEY=your_api_key
 *    CLOUDINARY_API_SECRET=your_api_secret
 */

import { StorageAdapter } from './StorageAdapter';

export class CloudinaryAdapter extends StorageAdapter {
  constructor() {
    super();
    this.cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    this.apiKey = process.env.CLOUDINARY_API_KEY;
    this.apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      throw new Error(
        'Cloudinary credentials missing. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env.local'
      );
    }
  }

  /**
   * Upload a file to Cloudinary
   */
  async upload(fileBuffer, fileName, options = {}) {
    const { folder = 'united-album', mimeType = 'image/jpeg' } = options;

    try {
      // Convert buffer to base64
      const base64File = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;

      // Generate timestamp and signature for authenticated upload
      const timestamp = Math.round(Date.now() / 1000);
      const signature = this._generateSignature(timestamp, folder);

      // Upload via Cloudinary Upload API
      const formData = new FormData();
      formData.append('file', base64File);
      formData.append('timestamp', timestamp.toString());
      formData.append('api_key', this.apiKey);
      formData.append('signature', signature);
      formData.append('folder', folder);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Cloudinary upload failed: ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();

      return {
        id: data.public_id, // e.g., "united-album/photo123"
        url: data.secure_url, // HTTPS URL
      };
    } catch (error) {
      console.error('[CloudinaryAdapter] Upload error:', error);
      throw error;
    }
  }

  /**
   * Delete a file from Cloudinary
   */
  async delete(fileId) {
    try {
      const timestamp = Math.round(Date.now() / 1000);
      const signature = this._generateSignature(timestamp, null, fileId);

      const formData = new FormData();
      formData.append('public_id', fileId);
      formData.append('timestamp', timestamp.toString());
      formData.append('api_key', this.apiKey);
      formData.append('signature', signature);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${this.cloudName}/image/destroy`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Cloudinary delete failed: ${error.error?.message || 'Unknown error'}`);
      }

      console.log(`[CloudinaryAdapter] Deleted file: ${fileId}`);
    } catch (error) {
      console.error('[CloudinaryAdapter] Delete error:', error);
      throw error;
    }
  }

  /**
   * Get file stream (for downloads)
   * Cloudinary uses direct URLs, so we fetch and return stream
   */
  async getStream(fileId) {
    try {
      const url = this.getUrl(fileId);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }

      return {
        stream: response.body,
        contentType: response.headers.get('content-type') || 'image/jpeg',
      };
    } catch (error) {
      console.error('[CloudinaryAdapter] Stream error:', error);
      throw error;
    }
  }

  /**
   * Get public URL for a file
   * Supports Cloudinary transformations (resize, crop, etc.)
   */
  getUrl(fileId, options = {}) {
    const {
      width,
      height,
      crop = 'limit',
      quality = 'auto',
      fetch_format,
      gravity,
      effect,
    } = options;

    // Build transformation string
    const transformations = [];

    // Quality (always include)
    transformations.push(`q_${quality}`);

    // Auto-format (WebP, AVIF) for better compression
    if (fetch_format) {
      transformations.push(`f_${fetch_format}`);
    }

    // Dimensions and cropping
    if (width || height) {
      transformations.push(`c_${crop}`);
      if (width) transformations.push(`w_${width}`);
      if (height) transformations.push(`h_${height}`);
    }

    // Gravity (for face detection, etc.)
    if (gravity) {
      transformations.push(`g_${gravity}`);
    }

    // Effects (blur, etc.)
    if (effect) {
      transformations.push(`e_${effect}`);
    }

    const transformString = transformations.join(',');
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/${transformString}/${fileId}`;
  }

  /**
   * Create folder (Cloudinary uses virtual folders - no API needed)
   */
  async createFolder(folderName, parentId = null) {
    // Cloudinary creates folders automatically when uploading
    // Just return the folder path
    const folderPath = parentId ? `${parentId}/${folderName}` : folderName;
    console.log(`[CloudinaryAdapter] Folder will be created on first upload: ${folderPath}`);
    return folderPath;
  }

  /**
   * List files (via Admin API)
   */
  async listFiles(folderId = null) {
    try {
      const timestamp = Math.round(Date.now() / 1000);
      const signature = this._generateSignature(timestamp);

      const params = new URLSearchParams({
        timestamp: timestamp.toString(),
        api_key: this.apiKey,
        signature: signature,
        max_results: '500',
      });

      if (folderId) {
        params.append('prefix', folderId);
      }

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${this.cloudName}/resources/image?${params}`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to list files: ${response.statusText}`);
      }

      const data = await response.json();
      return new Set(data.resources?.map((r) => r.public_id) || []);
    } catch (error) {
      console.error('[CloudinaryAdapter] List files error:', error);
      return new Set();
    }
  }

  /**
   * Generate signature for authenticated requests
   * Cloudinary requires params in alphabetical order!
   */
  _generateSignature(timestamp, folder = null, publicId = null) {
    const crypto = require('crypto');

    // Build params object
    const params = { timestamp };
    if (folder) params.folder = folder;
    if (publicId) params.public_id = publicId;

    // Sort params alphabetically and concatenate
    const sortedKeys = Object.keys(params).sort();
    const paramsToSign = sortedKeys.map(key => `${key}=${params[key]}`).join('&');

    // Append API secret at the end (not as a param)
    const stringToSign = paramsToSign + this.apiSecret;

    console.log(`[CloudinaryAdapter] Generating signature for: ${paramsToSign}`);

    return crypto.createHash('sha1').update(stringToSign).digest('hex');
  }

  getName() {
    return 'cloudinary';
  }
}
