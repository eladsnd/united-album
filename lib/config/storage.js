/**
 * Storage Configuration
 *
 * Centralized configuration for storage features and optimizations.
 * Allows toggling features without changing code.
 */

export const storageConfig = {
  // Provider settings
  provider: process.env.STORAGE_PROVIDER || 'cloudinary',

  // Feature flags for Cloudinary optimizations
  cloudinary: {
    // Use Cloudinary's auto-quality optimization
    useAutoQuality: process.env.CLOUDINARY_AUTO_QUALITY !== 'false', // Default: true

    // Use Cloudinary's auto-format (WebP, AVIF)
    useAutoFormat: process.env.CLOUDINARY_AUTO_FORMAT !== 'false', // Default: true

    // Use Cloudinary's face detection for thumbnails
    useFaceDetection: process.env.CLOUDINARY_FACE_DETECTION === 'true', // Default: false (keep face-api.js)

    // Responsive image sizes
    sizes: {
      thumbnail: { width: 400, height: 400, crop: 'fill' },
      gallery: { width: 800, height: 600, crop: 'limit' },
      fullsize: { width: 1200, quality: 'auto' },
      faceCrop: { width: 120, height: 120, crop: 'thumb', gravity: 'face' },
    },

    // Quality settings
    quality: {
      thumbnail: 'auto:good', // Higher quality for thumbnails
      gallery: 'auto:good',
      fullsize: 'auto:best',
      download: '90', // Original quality for downloads
    },
  },

  // Download rate limiting
  downloads: {
    // Enable rate limiting
    enableRateLimit: process.env.DOWNLOAD_RATE_LIMIT !== 'false', // Default: true

    // Max concurrent downloads per user
    maxConcurrent: parseInt(process.env.DOWNLOAD_MAX_CONCURRENT) || 3,

    // Max downloads per minute per user
    maxPerMinute: parseInt(process.env.DOWNLOAD_MAX_PER_MINUTE) || 20,

    // Enable batching for large albums
    enableBatching: process.env.DOWNLOAD_BATCHING !== 'false', // Default: true

    // Batch size (photos per batch)
    batchSize: parseInt(process.env.DOWNLOAD_BATCH_SIZE) || 50,

    // Max album size (photos)
    maxAlbumSize: parseInt(process.env.DOWNLOAD_MAX_ALBUM_SIZE) || 500,
  },

  // Bandwidth optimization
  bandwidth: {
    // Serve optimized images by default
    serveOptimized: process.env.SERVE_OPTIMIZED !== 'false', // Default: true

    // Use lazy loading placeholders
    usePlaceholders: process.env.USE_PLACEHOLDERS !== 'false', // Default: true

    // Placeholder quality (1-100, lower = smaller file)
    placeholderQuality: parseInt(process.env.PLACEHOLDER_QUALITY) || 10,

    // Placeholder width
    placeholderWidth: parseInt(process.env.PLACEHOLDER_WIDTH) || 50,
  },

  // Fallback strategies
  fallback: {
    // If Cloudinary fails, use Google Drive
    enableFallback: process.env.STORAGE_FALLBACK !== 'false', // Default: true

    // If Cloudinary face detection fails, use face-api.js
    useFaceApiFallback: process.env.FACE_API_FALLBACK !== 'false', // Default: true
  },
};

/**
 * Get optimized image URL with smart defaults
 */
export function getOptimizedUrl(storage, fileId, size = 'gallery') {
  const config = storageConfig.cloudinary;

  // If not Cloudinary or optimizations disabled, return basic URL
  if (storage.getName() !== 'cloudinary' || !config.useAutoQuality) {
    return storage.getUrl(fileId);
  }

  // Get size config
  const sizeConfig = config.sizes[size] || config.sizes.gallery;
  const quality = config.quality[size] || 'auto';

  // Build optimization options
  const options = {
    ...sizeConfig,
    quality,
  };

  // Add auto-format if enabled
  if (config.useAutoFormat) {
    options.fetch_format = 'auto';
  }

  return storage.getUrl(fileId, options);
}

/**
 * Get lazy loading placeholder URL
 */
export function getPlaceholderUrl(storage, fileId) {
  const config = storageConfig.bandwidth;

  if (storage.getName() !== 'cloudinary' || !config.usePlaceholders) {
    return null; // No placeholder, load full image
  }

  return storage.getUrl(fileId, {
    width: config.placeholderWidth,
    quality: config.placeholderQuality,
    effect: 'blur:1000',
    fetch_format: 'auto',
  });
}

/**
 * Get face thumbnail URL (uses Cloudinary face detection if available)
 */
export function getFaceThumbnailUrl(storage, fileId, useFallback = true) {
  const config = storageConfig.cloudinary;

  // Use Cloudinary face detection if enabled
  if (storage.getName() === 'cloudinary' && config.useFaceDetection) {
    return storage.getUrl(fileId, config.sizes.faceCrop);
  }

  // Fallback to face-api.js generated thumbnails
  if (useFallback && storageConfig.fallback.useFaceApiFallback) {
    return storage.getUrl(fileId); // Uses server-generated face crop
  }

  // Default: center crop
  return storage.getUrl(fileId, {
    width: 120,
    height: 120,
    crop: 'fill',
    gravity: 'center',
  });
}

export default storageConfig;
