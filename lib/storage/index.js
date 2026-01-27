/**
 * Storage Provider Factory
 *
 * Dynamically loads the correct storage adapter based on environment variable.
 *
 * Switch providers by changing STORAGE_PROVIDER in .env.local:
 *   STORAGE_PROVIDER=cloudinary   # Recommended (free 25GB, no OAuth!)
 *   STORAGE_PROVIDER=drive        # Current (free 15GB, OAuth expires)
 *   STORAGE_PROVIDER=gcs          # Future (free 5GB, service account)
 *
 * Usage:
 *   import { getStorageAdapter } from '@/lib/storage';
 *   const storage = getStorageAdapter();
 *   await storage.upload(buffer, 'photo.jpg', { folder: 'photos' });
 */

import { CloudinaryAdapter } from './CloudinaryAdapter';
import { GoogleDriveAdapter } from './GoogleDriveAdapter';

// Singleton instance cache
let storageInstance = null;

/**
 * Get the configured storage adapter
 * @returns {StorageAdapter}
 */
export function getStorageAdapter() {
  // Return cached instance if available
  if (storageInstance) {
    return storageInstance;
  }

  const provider = (process.env.STORAGE_PROVIDER || 'cloudinary').toLowerCase();

  console.log(`[Storage] Initializing ${provider} adapter...`);

  try {
    switch (provider) {
      case 'cloudinary':
        storageInstance = new CloudinaryAdapter();
        break;

      case 'drive':
      case 'google-drive':
        storageInstance = new GoogleDriveAdapter();
        break;

      case 'gcs':
      case 'google-cloud-storage':
        // Future: Add GCS adapter
        throw new Error(
          'Google Cloud Storage adapter not yet implemented. Use "cloudinary" or "drive".'
        );

      default:
        console.warn(`[Storage] Unknown provider "${provider}", falling back to Cloudinary`);
        storageInstance = new CloudinaryAdapter();
    }

    console.log(`[Storage] ✓ ${storageInstance.getName()} adapter ready`);
    return storageInstance;
  } catch (error) {
    console.error(`[Storage] Failed to initialize ${provider} adapter:`, error.message);

    // Fallback to Google Drive if Cloudinary fails
    if (provider === 'cloudinary') {
      console.warn('[Storage] Falling back to Google Drive...');
      try {
        storageInstance = new GoogleDriveAdapter();
        console.log(`[Storage] ✓ Fallback to ${storageInstance.getName()} adapter successful`);
        return storageInstance;
      } catch (fallbackError) {
        console.error('[Storage] Fallback also failed:', fallbackError.message);
        throw new Error(
          'No storage provider available. Please configure Cloudinary or Google Drive.'
        );
      }
    }

    throw error;
  }
}

/**
 * Reset the storage adapter (for testing or switching providers)
 */
export function resetStorageAdapter() {
  storageInstance = null;
  console.log('[Storage] Adapter cache cleared');
}

// Export adapter classes for direct usage if needed
export { CloudinaryAdapter, GoogleDriveAdapter };
