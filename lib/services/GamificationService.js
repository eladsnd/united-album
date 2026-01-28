/**
 * Gamification Service (Service Layer Pattern)
 *
 * Handles business logic for points system and leaderboard.
 *
 * Responsibilities:
 * - Award points when users complete challenges
 * - Prevent duplicate point awards
 * - Generate leaderboard rankings
 * - Check gamify mode status
 * - Provide user statistics
 *
 * Workflow:
 * 1. Check if gamify mode is enabled
 * 2. Verify photo has valid poseId
 * 3. Check if user already completed this challenge
 * 4. Get challenge points value
 * 5. Award points to user
 * 6. Log achievement
 *
 * Usage:
 * ```javascript
 * const service = new GamificationService();
 * await service.awardPointsForPhoto({ poseId: 'dip', uploaderId: 'user_123' });
 * const leaderboard = await service.getLeaderboard();
 * ```
 */

import { FeatureFlagService } from './FeatureFlagService.js';
import { UserScoreRepository } from '../repositories/UserScoreRepository.js';
import { ChallengeRepository } from '../repositories/ChallengeRepository.js';

export class GamificationService {
  constructor(eventId = null) {
    this.eventId = eventId;
    this.featureFlags = new FeatureFlagService(eventId);
    this.scoreRepo = new UserScoreRepository();
    this.challengeRepo = new ChallengeRepository();
  }

  /**
   * Award points for uploading a photo that matches a challenge
   *
   * @param {Object} photo - Photo object with poseId and uploaderId
   * @param {string} photo.poseId - Challenge ID the photo matches
   * @param {string} photo.uploaderId - User who uploaded the photo
   * @returns {Promise<Object|null>} Award result { pointsEarned, totalPoints, challengeTitle } or null if no points awarded
   */
  async awardPointsForPhoto(photo) {
    try {
      // 1. Check if gamify mode is enabled
      const gamifyEnabled = await this.isGamifyModeEnabled();
      if (!gamifyEnabled) {
        console.log('[GamificationService] Gamify mode disabled - no points awarded');
        return null;
      }

      // 2. Validate photo has poseId and uploaderId
      if (!photo.poseId || photo.poseId === 'unknown_pose') {
        console.log('[GamificationService] Photo has no valid poseId - no points awarded');
        return null;
      }

      if (!photo.uploaderId) {
        console.log('[GamificationService] Photo has no uploaderId - no points awarded');
        return null;
      }

      const userId = photo.uploaderId;
      const challengeId = photo.poseId;

      // 3. Check if user already completed this challenge
      const alreadyCompleted = await this.scoreRepo.hasCompletedChallenge(userId, challengeId);
      if (alreadyCompleted) {
        console.log(`[GamificationService] User ${userId} already completed challenge ${challengeId} - no duplicate points`);
        return null;
      }

      // 4. Get challenge and its points value
      const challenge = await this.challengeRepo.findById(challengeId);
      if (!challenge) {
        console.log(`[GamificationService] Challenge ${challengeId} not found - no points awarded`);
        return null;
      }

      // 4.5. Check if challenge is within time window
      const now = new Date();
      const isActive = this._isChallengeActive(challenge, now);

      if (!isActive) {
        console.log(`[GamificationService] Challenge ${challengeId} is not active (window: ${challenge.startTime} - ${challenge.endTime})`);
        return null;
      }

      // Calculate points (base + bonus if in time window)
      let pointsToAward = challenge.points || 10;
      let bonusAwarded = 0;

      // Award bonus points if challenge has time window
      if (challenge.startTime && challenge.endTime) {
        bonusAwarded = challenge.bonusPoints || 0;
        pointsToAward += bonusAwarded;
      }

      // 5. Award points to user
      const updatedScore = await this.scoreRepo.addPoints(userId, challengeId, pointsToAward);

      // 6. Log achievement
      const bonusMsg = bonusAwarded > 0 ? ` (+${bonusAwarded} bonus!)` : '';
      console.log(`[GamificationService] 🎉 User ${userId} earned ${pointsToAward} points${bonusMsg} for completing "${challenge.title}" (total: ${updatedScore.totalPoints})`);

      return {
        pointsEarned: pointsToAward,
        basePoints: challenge.points || 10,
        bonusPoints: bonusAwarded,
        totalPoints: updatedScore.totalPoints,
        challengeId: challenge.id,
        challengeTitle: challenge.title,
        completedCount: updatedScore.completedChallenges.length,
        isTimedChallenge: !!(challenge.startTime && challenge.endTime),
      };
    } catch (error) {
      console.error('[GamificationService] Error awarding points:', error);
      // Don't throw - photo upload should succeed even if points fail
      return null;
    }
  }

  /**
   * Get leaderboard with top scorers
   *
   * @param {number} limit - Number of top users to return (default: 10)
   * @returns {Promise<Array>} Leaderboard with ranks and display names
   */
  async getLeaderboard(limit = 10) {
    const scores = await this.scoreRepo.getLeaderboard(limit);

    // Enrich with rank and display name
    const leaderboard = scores.map((score, index) => ({
      rank: index + 1,
      userId: score.userId,
      displayName: score.nickname || `Player ${this._generatePlayerNumber(score.userId)}`,
      totalPoints: score.totalPoints,
      completedChallenges: score.completedChallenges.length,
      lastEarned: score.lastEarned,
    }));

    return leaderboard;
  }

  /**
   * Get statistics for a specific user
   *
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} User stats { totalPoints, completedChallenges, rank } or null if user has no score
   */
  async getUserStats(userId) {
    const userScore = await this.scoreRepo.findByUserId(userId);

    if (!userScore) {
      return null;
    }

    const rank = await this.scoreRepo.getUserRank(userId);
    const totalUsers = await this.scoreRepo.getTotalUsers();

    return {
      userId: userScore.userId,
      displayName: userScore.nickname || `Player ${this._generatePlayerNumber(userScore.userId)}`,
      totalPoints: userScore.totalPoints,
      completedChallenges: userScore.completedChallenges,
      completedCount: userScore.completedChallenges.length,
      rank,
      totalUsers,
      lastEarned: userScore.lastEarned,
    };
  }

  /**
   * Check if gamify mode is currently enabled
   *
   * @returns {Promise<boolean>} True if gamify mode is on
   */
  async isGamifyModeEnabled() {
    return await this.featureFlags.isEnabled('gamification');
  }

  /**
   * Check if challenge is currently active based on time window
   *
   * @private
   * @param {Object} challenge - Challenge object with startTime and endTime
   * @param {Date} now - Current time
   * @returns {boolean} True if challenge is active
   */
  _isChallengeActive(challenge, now) {
    // If no time window, challenge is always active
    if (!challenge.startTime && !challenge.endTime) {
      return true;
    }

    // If only startTime, check if started
    if (challenge.startTime && !challenge.endTime) {
      return now >= new Date(challenge.startTime);
    }

    // If only endTime, check if not expired
    if (!challenge.startTime && challenge.endTime) {
      return now <= new Date(challenge.endTime);
    }

    // Both times set - check if within window
    const start = new Date(challenge.startTime);
    const end = new Date(challenge.endTime);
    return now >= start && now <= end;
  }

  /**
   * Generate a consistent player number from userId
   * Hash the userId to create a stable player number
   *
   * @private
   * @param {string} userId - User ID
   * @returns {number} Player number (1-9999)
   */
  _generatePlayerNumber(userId) {
    // Simple hash to generate consistent player number
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Convert to positive number between 1 and 9999
    return (Math.abs(hash) % 9999) + 1;
  }
}
