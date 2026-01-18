/**
 * @deprecated This file is DEPRECATED as of Phase 2 refactoring.
 *
 * All face storage operations have been migrated to the Repository Pattern.
 * Use FaceRepository from lib/repositories/FaceRepository.js instead.
 *
 * Migration path:
 * - OLD: import { getAllFaces, saveFaceDescriptor } from '../lib/faceStorage';
 * - NEW: import { FaceRepository } from '../lib/repositories/FaceRepository.js';
 *        const faceRepo = new FaceRepository();
 *        await faceRepo.findAll();
 *        await faceRepo.saveDescriptor(faceId, descriptor, metadata);
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

console.warn('[DEPRECATED] faceStorage.js is deprecated. Use FaceRepository instead.');

// Legacy exports for backward compatibility (tests only)
export * from './repositories/FaceRepository.js';
