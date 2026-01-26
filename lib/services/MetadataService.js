/**
 * Metadata Service (Service Layer Pattern)
 *
 * Handles extraction of EXIF metadata from image files.
 *
 * Responsibilities:
 * - Extract EXIF data including capture timestamp and device information
 * - Parse EXIF DateTime format into ISO DateTime
 * - Provide fallback values when EXIF data is unavailable
 *
 * EXIF Fields Extracted:
 * - exif.DateTimeOriginal - Original capture time
 * - exif.Make - Camera/phone manufacturer
 * - exif.Model - Camera/phone model
 */

import sharp from 'sharp';

export class MetadataService {
  /**
   * Extract EXIF metadata from image buffer
   *
   * @param {Buffer} buffer - Image file buffer
   * @returns {Promise<{capturedAt: Date|null, deviceMake: string|null, deviceModel: string|null}>}
   */
  async extractMetadata(buffer) {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      // Extract EXIF data
      const exif = metadata.exif || {};

      // Parse capture time from EXIF DateTimeOriginal
      let capturedAt = null;
      if (exif.DateTimeOriginal) {
        capturedAt = this.parseExifDateTime(exif.DateTimeOriginal);
      }

      // Extract device information
      const deviceMake = exif.Make || null;
      const deviceModel = exif.Model || null;

      return {
        capturedAt,
        deviceMake,
        deviceModel
      };
    } catch (error) {
      console.error('Error extracting EXIF metadata:', error);
      // Return null values if extraction fails
      return {
        capturedAt: null,
        deviceMake: null,
        deviceModel: null
      };
    }
  }

  /**
   * Parse EXIF DateTime string to JavaScript Date
   *
   * EXIF DateTime format: "YYYY:MM:DD HH:MM:SS"
   *
   * @param {string|Buffer} exifDateStr - EXIF DateTime string or buffer
   * @returns {Date|null} - Parsed date or null if invalid
   */
  parseExifDateTime(exifDateStr) {
    try {
      // Handle Buffer input (sometimes EXIF data comes as buffers)
      let dateString = exifDateStr;
      if (Buffer.isBuffer(exifDateStr)) {
        dateString = exifDateStr.toString('utf8').trim();
      }

      if (typeof dateString !== 'string') {
        return null;
      }

      // EXIF format: "YYYY:MM:DD HH:MM:SS"
      // Example: "2024:01:15 14:30:45"
      const match = dateString.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);

      if (!match) {
        return null;
      }

      const [, year, month, day, hour, minute, second] = match;

      // Create ISO string: "YYYY-MM-DDTHH:MM:SS"
      const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}`;

      // Parse to Date object
      const date = new Date(isoString);

      // Validate the date
      if (isNaN(date.getTime())) {
        return null;
      }

      return date;
    } catch (error) {
      console.error('Error parsing EXIF DateTime:', error);
      return null;
    }
  }
}
