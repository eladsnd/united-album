"use client";
import { useState, useEffect } from 'react';
import { Trophy, Medal, Award } from 'lucide-react';
import { getUserId } from '../lib/utils/getUserId';
import { useFeatureFlag } from '../lib/hooks/useFeatureFlag';

/**
 * Leaderboard Component
 *
 * Displays top 10 users with points in gamification mode.
 * Only shows when gamify mode is enabled.
 *
 * Features:
 * - Auto-updates every 30 seconds
 * - Shows rank with medals for top 3 (🥇🥈🥉)
 * - Highlights current user's row
 * - Display names: "Player X" (anonymous)
 * - Compact card design for sidebar
 *
 * Usage:
 * <Leaderboard />
 */
export default function Leaderboard() {
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState(null);

    // Check if gamification feature is enabled
    const { enabled: gamificationEnabled } = useFeatureFlag('gamification');

    useEffect(() => {
        // Get current user ID
        const userId = getUserId();
        setCurrentUserId(userId);

        // Fetch leaderboard initially
        fetchLeaderboard();

        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchLeaderboard, 30000);

        return () => clearInterval(interval);
    }, []);

    const fetchLeaderboard = async () => {
        try {
            const res = await fetch('/api/leaderboard');
            const data = await res.json();

            if (data.success) {
                setLeaderboard(data.data.leaderboard || []);
            }
        } catch (err) {
            console.error('[Leaderboard] Error fetching leaderboard:', err);
        } finally {
            setLoading(false);
        }
    };

    // Don't render if gamification feature is disabled
    if (!gamificationEnabled) {
        return null;
    }

    if (loading) {
        return (
            <div className="card p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Trophy size={18} className="text-yellow-600" />
                    Leaderboard
                </h3>
                <div className="text-center text-gray-500 text-sm py-4">
                    Loading...
                </div>
            </div>
        );
    }

    if (leaderboard.length === 0) {
        return (
            <div className="card p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Trophy size={18} className="text-yellow-600" />
                    Leaderboard
                </h3>
                <div className="text-center text-gray-500 text-sm py-4">
                    No scores yet. Complete a challenge to get on the board!
                </div>
            </div>
        );
    }

    const getRankMedal = (rank) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return `${rank}.`;
    };

    return (
        <div className="card p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Trophy size={18} className="text-yellow-600" />
                Leaderboard
            </h3>

            <div className="space-y-2">
                {leaderboard.map((entry) => {
                    const isCurrentUser = entry.userId === currentUserId;

                    return (
                        <div
                            key={entry.userId}
                            className={`flex items-center justify-between p-2 rounded-lg transition ${
                                isCurrentUser
                                    ? 'bg-blue-50 border border-blue-200'
                                    : 'bg-gray-50 hover:bg-gray-100'
                            }`}
                        >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="text-lg font-bold text-gray-700 w-8 flex-shrink-0">
                                    {getRankMedal(entry.rank)}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className={`font-medium truncate ${
                                        isCurrentUser ? 'text-blue-700' : 'text-gray-900'
                                    }`}>
                                        {entry.displayName}
                                        {isCurrentUser && (
                                            <span className="text-xs ml-1 text-blue-600">(You)</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {entry.completedChallenges} challenge{entry.completedChallenges !== 1 ? 's' : ''}
                                    </div>
                                </div>
                            </div>
                            <div className={`text-right font-bold ${
                                isCurrentUser ? 'text-blue-700' : 'text-gray-900'
                            }`}>
                                {entry.totalPoints}
                                <div className="text-xs font-normal text-gray-500">pts</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-500 text-center">
                    🎮 Complete challenges to earn points!
                </div>
            </div>
        </div>
    );
}
