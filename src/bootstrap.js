/**
 * Bootstrap file - initializes all services and dependencies
 * This file sets up the dependency injection container
 */
import { container } from './container.js';
import { PhotoRepository } from './repositories/photo.repository.js';
import { FaceRepository } from './repositories/face.repository.js';
import { DriveService } from './services/drive.service.js';
import { FaceService } from './services/face.service.js';
import { PhotoService } from './services/photo.service.js';

/**
 * Initialize the application services
 * Call this once at application startup
 */
export function bootstrapServices() {
  // Register repositories
  container.register('PhotoRepository', () => new PhotoRepository(), true);
  container.register('FaceRepository', () => new FaceRepository(), true);

  // Register DriveService
  container.register('DriveService', () => new DriveService(), true);

  // Register FaceService with dependencies
  container.register(
    'FaceService',
    (c) => {
      const faceRepository = c.get('FaceRepository');
      const photoRepository = c.get('PhotoRepository');
      return new FaceService(faceRepository, photoRepository);
    },
    true
  );

  // Register PhotoService with dependencies
  container.register(
    'PhotoService',
    (c) => {
      const driveService = c.get('DriveService');
      const photoRepository = c.get('PhotoRepository');
      const faceService = c.get('FaceService');
      return new PhotoService(driveService, photoRepository, faceService);
    },
    true
  );

  console.log('[Bootstrap] Services initialized successfully');
}

/**
 * Get PhotoService instance
 * @returns {PhotoService}
 */
export function getPhotoService() {
  return container.get('PhotoService');
}

/**
 * Get FaceService instance
 * @returns {FaceService}
 */
export function getFaceService() {
  return container.get('FaceService');
}

/**
 * Get DriveService instance
 * @returns {DriveService}
 */
export function getDriveService() {
  return container.get('DriveService');
}

/**
 * Get PhotoRepository instance
 * @returns {PhotoRepository}
 */
export function getPhotoRepository() {
  return container.get('PhotoRepository');
}

/**
 * Get FaceRepository instance
 * @returns {FaceRepository}
 */
export function getFaceRepository() {
  return container.get('FaceRepository');
}

// Auto-bootstrap on import (for Next.js API routes)
if (typeof window === 'undefined') {
  // Only run on server-side
  try {
    bootstrapServices();
  } catch (error) {
    console.error('[Bootstrap] Failed to initialize services:', error);
  }
}
