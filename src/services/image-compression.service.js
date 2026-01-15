import sharp from 'sharp';
import { Injectable } from '@nestjs/common';
import { AppError } from '../errors/app-error.js';

/**
 * ImageCompressionService handles image optimization and compression
 * Uses sharp library for high-performance image processing
 */
@Injectable()
export class ImageCompressionService {
  constructor() {
    this.maxFileSizeMB = 5; // Google Drive API limit
    this.maxFileSizeBytes = this.maxFileSizeMB * 1024 * 1024;
    this.maxDimension = 4000; // Max width/height
    this.targetQuality = 85; // JPEG quality (0-100)
  }

  /**
   * Compress image to meet file size constraints
   * @param {Buffer} imageBuffer - Original image buffer
   * @param {string} mimeType - Image MIME type
   * @returns {Promise<{buffer: Buffer, metadata: Object}>} Compressed image
   */
  async compressImage(imageBuffer, mimeType = 'image/jpeg') {
    try {
      // Get image metadata
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      console.log(`[Image Compression] Original: ${Math.round(imageBuffer.length / 1024)}KB, ${metadata.width}x${metadata.height}, format: ${metadata.format}`);

      // If already under limit and reasonable size, return as-is
      if (imageBuffer.length <= this.maxFileSizeBytes && metadata.width <= this.maxDimension && metadata.height <= this.maxDimension) {
        console.log('[Image Compression] Image already optimized, no compression needed');
        return {
          buffer: imageBuffer,
          metadata: {
            originalSize: imageBuffer.length,
            finalSize: imageBuffer.length,
            compressionRatio: 1,
            width: metadata.width,
            height: metadata.height,
          },
        };
      }

      // Calculate target dimensions (maintain aspect ratio)
      let targetWidth = metadata.width;
      let targetHeight = metadata.height;

      if (metadata.width > this.maxDimension || metadata.height > this.maxDimension) {
        const aspectRatio = metadata.width / metadata.height;
        if (metadata.width > metadata.height) {
          targetWidth = this.maxDimension;
          targetHeight = Math.round(this.maxDimension / aspectRatio);
        } else {
          targetHeight = this.maxDimension;
          targetWidth = Math.round(this.maxDimension * aspectRatio);
        }
        console.log(`[Image Compression] Resizing to ${targetWidth}x${targetHeight}`);
      }

      // Compress with adaptive quality
      let compressedBuffer;
      let quality = this.targetQuality;
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        compressedBuffer = await this.compressWithQuality(
          imageBuffer,
          targetWidth,
          targetHeight,
          quality,
          mimeType
        );

        console.log(`[Image Compression] Attempt ${attempts + 1}: Quality ${quality}%, Size: ${Math.round(compressedBuffer.length / 1024)}KB`);

        // Check if under limit
        if (compressedBuffer.length <= this.maxFileSizeBytes) {
          break;
        }

        // Reduce quality for next attempt
        quality -= 10;
        attempts++;

        if (quality < 50) {
          // If quality is too low, reduce dimensions instead
          targetWidth = Math.round(targetWidth * 0.8);
          targetHeight = Math.round(targetHeight * 0.8);
          quality = 75; // Reset quality
          console.log(`[Image Compression] Reducing dimensions to ${targetWidth}x${targetHeight}`);
        }
      }

      // Final check
      if (compressedBuffer.length > this.maxFileSizeBytes) {
        throw new AppError(
          `Unable to compress image below ${this.maxFileSizeMB}MB limit. Please use a smaller image or reduce resolution.`,
          400,
          'IMAGE_TOO_LARGE'
        );
      }

      const compressionRatio = imageBuffer.length / compressedBuffer.length;

      console.log(
        `[Image Compression] Success! ${Math.round(imageBuffer.length / 1024)}KB → ${Math.round(compressedBuffer.length / 1024)}KB ` +
        `(${Math.round((1 - 1/compressionRatio) * 100)}% reduction, ${compressionRatio.toFixed(2)}x compression)`
      );

      return {
        buffer: compressedBuffer,
        metadata: {
          originalSize: imageBuffer.length,
          finalSize: compressedBuffer.length,
          compressionRatio,
          width: targetWidth,
          height: targetHeight,
          quality,
        },
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        `Image compression failed: ${error.message}`,
        500,
        'COMPRESSION_FAILED'
      );
    }
  }

  /**
   * Compress image with specific quality settings
   * @private
   * @param {Buffer} imageBuffer - Image buffer
   * @param {number} width - Target width
   * @param {number} height - Target height
   * @param {number} quality - JPEG quality (0-100)
   * @param {string} mimeType - Output MIME type
   * @returns {Promise<Buffer>} Compressed buffer
   */
  async compressWithQuality(imageBuffer, width, height, quality, mimeType) {
    let pipeline = sharp(imageBuffer).resize(width, height, {
      fit: 'inside',
      withoutEnlargement: true,
    });

    // Apply format-specific compression
    if (mimeType === 'image/png') {
      pipeline = pipeline.png({
        quality,
        compressionLevel: 9,
        effort: 10,
      });
    } else if (mimeType === 'image/webp') {
      pipeline = pipeline.webp({
        quality,
        effort: 6,
      });
    } else {
      // Default to JPEG
      pipeline = pipeline.jpeg({
        quality,
        progressive: true,
        optimizeScans: true,
      });
    }

    return pipeline.toBuffer();
  }

  /**
   * Optimize image for web display (smaller, faster loading)
   * @param {Buffer} imageBuffer - Image buffer
   * @param {number} maxWidth - Maximum width (default: 1920)
   * @returns {Promise<Buffer>} Optimized buffer
   */
  async optimizeForWeb(imageBuffer, maxWidth = 1920) {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    let targetWidth = metadata.width;
    let targetHeight = metadata.height;

    if (metadata.width > maxWidth) {
      const aspectRatio = metadata.width / metadata.height;
      targetWidth = maxWidth;
      targetHeight = Math.round(maxWidth / aspectRatio);
    }

    return image
      .resize(targetWidth, targetHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 85,
        progressive: true,
      })
      .toBuffer();
  }

  /**
   * Create thumbnail from image
   * @param {Buffer} imageBuffer - Image buffer
   * @param {number} size - Thumbnail size (default: 300)
   * @returns {Promise<Buffer>} Thumbnail buffer
   */
  async createThumbnail(imageBuffer, size = 300) {
    return sharp(imageBuffer)
      .resize(size, size, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({
        quality: 80,
      })
      .toBuffer();
  }
}
