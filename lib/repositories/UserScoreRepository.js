/**
 * UserScore Repository (Repository Pattern)
 *
 * Manages user scores and leaderboard data.
 * Tracks points, completed challenges, and leaderboard rankings.
 *
 * Design Pattern: Repository Pattern with JSON Serialization
 * - Extends BaseRepository for consistent CRUD operations
 * - Serializes completedChallenges array to JSON for SQLite compatibility
 * - Provides leaderboard queries optimized for performance
 *
 * Usage:
 * ```javascript
 * const scoreRepo = new UserScoreRepository();
 * await scoreRepo.addPoints('user_123', 'dip', 25);
 * const leaderboard = await scoreRepo.getLeaderboard(10);
 * ```
 */

import { BaseRepository } from './BaseRepository.js';

export class UserScoreRepository extends BaseRepository {
  /**
   * Get Prisma model name
   * @returns {string} 'userScore'
   */
  getModel() {
    return 'userScore';
  }

  /**
   * Serialize data before saving to database
   * Converts completedChallenges array to JSON string for SQLite
   *
   * @param {Object} data - Raw data
   * @returns {Object} Serialized data
   */
  serialize(data) {
    if (!data) return data;

    const serialized = { ...data };

    if (Array.isArray(data.completedChallenges)) {
      serialized.completedChallenges = JSON.stringify(data.completedChallenges);
    }

    return serialized;
  }

  /**
   * Deserialize data after reading from database
   * Parses completedChallenges JSON string back to array
   *
   * @param {Object} record - Database record
   * @returns {Object} Deserialized record
   */
  deserialize(record) {
    if (!record) return record;

    const deserialized = { ...record };

    if (typeof record.completedChallenges === 'string') {
      try {
        deserialized.completedChallenges = JSON.parse(record.completedChallenges);
      } catch (e) {
        deserialized.completedChallenges = [];
      }
    }

    return deserialized;
  }

  /**
   * Get user score by userId
   *
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} User score record or null if not found
   */
  async findByUserId(userId) {
    return await this.findUnique({ userId });
  }

  /**
   * Get leaderboard (top scorers)
   *
   * @param {number} limit - Number of top users to return (default: 10)
   * @returns {Promise<Array>} Array of user scores ordered by totalPoints DESC
   */
  async getLeaderboard(limit = 10) {
    const scores = await this.findMany({
      orderBy: [
        { totalPoints: 'desc' },
        { lastEarned: 'desc' }, // Tie-breaker: who earned most recently
      ],
      take: limit,
    });

    return scores;
  }

  /**
   * Check if user has completed a specific challenge
   *
   * @param {string} userId - User ID
   * @param {string} challengeId - Challenge ID
   * @returns {Promise<boolean>} True if user has completed this challenge
   */
  async hasCompletedChallenge(userId, challengeId) {
    const userScore = await this.findByUserId(userId);

    if (!userScore) {
      return false;
    }

    return userScore.completedChallenges.includes(challengeId);
  }

  /**
   * Add points for completing a challenge
   * Creates user score record if it doesn't exist
   * Prevents duplicate points for same challenge
   *
   * @param {string} userId - User ID
   * @param {string} challengeId - Challenge ID
   * @param {number} points - Points to award
   * @returns {Promise<Object>} Updated user score
   * @throws {Error} If user already completed this challenge
   */
  async addPoints(userId, challengeId, points) {
    // Get or create user score
    let userScore = await this.findByUserId(userId);

    if (!userScore) {
      // Create new user score record
      userScore = await this.create({
        userId,
        totalPoints: 0,
        completedChallenges: [],
      });
      console.log(`[UserScoreRepository] Created new user score for: ${userId}`);
    }

    // Check if already completed
    if (userScore.completedChallenges.includes(challengeId)) {
      throw new Error(`User ${userId} has already completed challenge ${challengeId}`);
    }

    // Add points and mark challenge as completed
    const updatedChallenges = [...userScore.completedChallenges, challengeId];
    const updatedPoints = userScore.totalPoints + points;

    const updated = await this.update(
      { userId },
      {
        totalPoints: updatedPoints,
        completedChallenges: updatedChallenges,
        lastEarned: new Date(),
      }
    );

    console.log(`[UserScoreRepository] Awarded ${points} points to ${userId} for challenge ${challengeId} (total: ${updatedPoints})`);

    return updated;
  }

  /**
   * Increment user points without checking challenges
   * Used for manual point adjustments
   *
   * @param {string} userId - User ID
   * @param {number} points - Points to add (can be negative to subtract)
   * @returns {Promise<Object>} Updated user score
   */
  async incrementPoints(userId, points) {
    let userScore = await this.findByUserId(userId);

    if (!userScore) {
      userScore = await this.create({
        userId,
        totalPoints: 0,
        completedChallenges: [],
      });
    }

    const updatedPoints = userScore.totalPoints + points;

    const updated = await this.update(
      { userId },
      {
        totalPoints: Math.max(0, updatedPoints), // Prevent negative points
      }
    );

    console.log(`[UserScoreRepository] Incremented points for ${userId}: ${points} (total: ${updated.totalPoints})`);

    return updated;
  }

  /**
   * Get user's rank in leaderboard
   *
   * @param {string} userId - User ID
   * @returns {Promise<number|null>} User's rank (1-based) or null if user has no score
   */
  async getUserRank(userId) {
    const userScore = await this.findByUserId(userId);

    if (!userScore) {
      return null;
    }

    // Count users with higher points
    const higherCount = await this.count({
      where: {
        totalPoints: { gt: userScore.totalPoints },
      },
    });

    return higherCount + 1; // Rank is 1-based
  }

  /**
   * Get total number of users with scores
   *
   * @returns {Promise<number>} Total count of users in leaderboard
   */
  async getTotalUsers() {
    return await this.count();
  }
}
