/**
 * Challenge Repository (Repository Pattern)
 *
 * Extends BaseRepository to provide challenge/pose-specific data access operations.
 *
 * Design Pattern: Repository Pattern + Template Method Pattern
 * - Inherits all CRUD operations from BaseRepository
 * - No special serialization needed (Challenge model has only string fields)
 * - Adds challenge-specific query methods
 *
 * Benefits:
 * - Consistent interface with PhotoRepository and FaceRepository
 * - Automatic error handling via BaseRepository
 * - Clean separation of data access from business logic
 *
 * Usage:
 * ```javascript
 * const challengeRepo = new ChallengeRepository();
 * const challenge = await challengeRepo.create({ id: 'dip', title: 'Dip', ... });
 * const challenges = await challengeRepo.findAll();
 * ```
 */

import { BaseRepository } from './BaseRepository.js';

export class ChallengeRepository extends BaseRepository {
  /**
   * Get Prisma model name
   * @returns {string} 'challenge'
   */
  getModel() {
    return 'challenge';
  }

  /**
   * Get all challenges ordered by custom order field (then creation date)
   *
   * @returns {Promise<Array>} All challenge records
   */
  async findAll() {
    return await this.findMany({
      orderBy: [
        { order: 'asc' },
        { createdAt: 'asc' }
      ],
    });
  }

  /**
   * Get challenge by ID (slug)
   *
   * @param {string} id - Challenge ID (e.g., "dip", "whisper")
   * @returns {Promise<Object|null>} Challenge or null if not found
   */
  async findById(id) {
    return await this.findUnique({ id });
  }

  /**
   * Delete challenge by ID
   *
   * @param {string} id - Challenge ID
   * @returns {Promise<Object>} Deleted challenge record
   */
  async deleteById(id) {
    const deletedChallenge = await this.delete({ id });
    console.log(`[ChallengeRepository] Deleted challenge: ${id}`);
    return deletedChallenge;
  }

  /**
   * Check if challenge exists
   *
   * @param {string} id - Challenge ID
   * @returns {Promise<boolean>} True if exists, false otherwise
   */
  async exists(id) {
    const challenge = await this.findUnique({ id });
    return challenge !== null;
  }

  /**
   * Get challenges for a specific event (global + event-specific)
   *
   * Returns:
   * - All global challenges (isGlobal=true)
   * - All event-specific challenges for this event (eventId=X)
   *
   * @param {string} eventId - Event ID
   * @returns {Promise<Array>} Filtered challenge records
   */
  async findForEvent(eventId) {
    if (!eventId) {
      // If no eventId provided, return only global challenges
      return await this.findMany({
        where: { isGlobal: true },
        orderBy: [
          { order: 'asc' },
          { createdAt: 'asc' }
        ],
      });
    }

    return await this.findMany({
      where: {
        OR: [
          { isGlobal: true }, // Global challenges
          { eventId: eventId } // Event-specific challenges
        ]
      },
      orderBy: [
        { order: 'asc' },
        { createdAt: 'asc' }
      ],
    });
  }
}
