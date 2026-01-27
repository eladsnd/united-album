/**
 * Leaderboard API Route (Public)
 *
 * Provides leaderboard data for gamification feature.
 * Only returns data when gamify mode is enabled.
 *
 * Endpoints:
 * - GET /api/leaderboard - Get top scorers (public, no auth required)
 *
 * Uses Decorator Pattern:
 * - withApi: Automatic error handling and logging
 * - No adminOnly: Public endpoint for all users
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { withFeature } from '@/lib/api/featureDecorators';
import { GamificationService } from '@/lib/services/GamificationService';

/**
 * GET /api/leaderboard
 *
 * Get current leaderboard (top 10 users)
 * Returns empty array if gamify mode is disabled
 *
 * Query params:
 * - limit: Number of top users to return (default: 10, max: 50)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     gamifyMode: true,
 *     leaderboard: [
 *       {
 *         rank: 1,
 *         userId: "user_123...",
 *         displayName: "Player 42",
 *         totalPoints: 150,
 *         completedChallenges: 5,
 *         lastEarned: "2024-01-..."
 *       },
 *       ...
 *     ]
 *   }
 * }
 */
async function handleGet(request) {
  const gamificationService = new GamificationService();

  // Get query params
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

  // Get leaderboard (feature gate handled by decorator)
  const leaderboard = await gamificationService.getLeaderboard(limit);

  return NextResponse.json({
    success: true,
    data: {
      leaderboard,
    },
  });
}

// Apply decorators (public endpoint, no auth required, feature gated)
export const GET = withApi(withFeature(handleGet, 'gamification'));
