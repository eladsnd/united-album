/**
 * User Stats API Route (Public)
 *
 * Provides individual user statistics for gamification feature.
 *
 * Endpoints:
 * - GET /api/user-stats?userId=xyz - Get stats for specific user (public, no auth required)
 *
 * Uses Decorator Pattern:
 * - withApi: Automatic error handling and logging
 * - No adminOnly: Public endpoint for all users
 */

import { NextResponse } from 'next/server';
import { withApi } from '@/lib/api/decorators';
import { GamificationService } from '@/lib/services/GamificationService';
import { ValidationError } from '@/lib/api/errors';

/**
 * GET /api/user-stats?userId=xyz&eventId={eventId}
 *
 * Get statistics for a specific user in specific event
 *
 * Query params:
 * - userId: User ID (required)
 * - eventId: Event ID (required for multi-tenancy)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     userId: "user_123...",
 *     eventId: "event-123",
 *     displayName: "Player 42",
 *     totalPoints: 75,
 *     completedChallenges: ["dip", "whisper"],
 *     completedCount: 2,
 *     rank: 3,
 *     totalUsers: 25,
 *     lastEarned: "2024-01-..."
 *   }
 * }
 *
 * Or if user has no score:
 * {
 *   success: true,
 *   data: null,
 *   message: "User has not earned any points yet."
 * }
 */
async function handleGet(request) {
  // Get userId and eventId from query params
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const eventId = searchParams.get('eventId');

  if (!userId) {
    throw new ValidationError('userId query parameter is required');
  }

  // CRITICAL: Require eventId for multi-tenancy isolation
  if (!eventId) {
    throw new ValidationError('eventId is required for data isolation');
  }

  const gamificationService = new GamificationService(eventId);

  // Get user stats (event-scoped)
  const stats = await gamificationService.getUserStats(userId);

  if (!stats) {
    return NextResponse.json({
      success: true,
      data: null,
      message: 'User has not earned any points yet.',
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      ...stats,
      eventId, // Include eventId in response
    },
  });
}

// Apply decorators (public endpoint, no auth required)
export const GET = withApi(handleGet);
