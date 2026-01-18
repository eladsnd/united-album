/**
 * @deprecated This file is DEPRECATED as of Phase 2 refactoring.
 *
 * All photo storage operations have been migrated to the Repository Pattern.
 * Use PhotoRepository from lib/repositories/PhotoRepository.js instead.
 *
 * Migration path:
 * - OLD: import { getPhotos, savePhoto } from '../lib/photoStorage';
 * - NEW: import { PhotoRepository } from '../lib/repositories/PhotoRepository.js';
 *        const photoRepo = new PhotoRepository();
 *        await photoRepo.findAll();
 *        await photoRepo.save(photo);
 *
 * Benefits of Repository Pattern:
 * - Better separation of concerns (data access vs business logic)
 * - Easier testing with mocked repositories
 * - Consistent interface across all data access
 * - Follows SOLID principles
 * - Better maintainability
 *
 * This file will be removed in a future release.
 * All API routes have been migrated. Only test files may still reference this.
 */

console.warn('[DEPRECATED] photoStorage.js is deprecated. Use PhotoRepository instead.');

// Legacy exports for backward compatibility (tests only)
export * from './repositories/PhotoRepository.js';
