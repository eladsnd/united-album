"use client";
import { useState, useEffect } from 'react';
import { Gamepad2 } from 'lucide-react';

/**
 * Gamify Mode Toggle Component
 *
 * Admin-only toggle switch for enabling/disabling gamification mode.
 * Shows current status and allows admin to toggle between ON/OFF states.
 *
 * Features:
 * - Fetches current gamify mode on mount
 * - PUT request to /api/admin/settings when toggled
 * - Visual indicator with game icon
 * - Loading state during toggle operation
 * - Success/error feedback
 *
 * Usage:
 * <GamifyToggle adminToken={adminToken} />
 */
export default function GamifyToggle({ adminToken }) {
    const [gamifyMode, setGamifyMode] = useState(false);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);
    const [error, setError] = useState(null);

    // Fetch current gamify mode on mount
    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/admin/settings', {
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                },
            });

            if (res.ok) {
                const data = await res.json();
                setGamifyMode(data.data.gamifyMode);
            } else {
                console.error('[GamifyToggle] Failed to fetch settings');
            }
        } catch (err) {
            console.error('[GamifyToggle] Error fetching settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async () => {
        setToggling(true);
        setError(null);

        try {
            const newValue = !gamifyMode;

            const res = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${adminToken}`,
                },
                body: JSON.stringify({ gamifyMode: newValue }),
            });

            const data = await res.json();

            if (res.ok) {
                setGamifyMode(data.data.gamifyMode);
                console.log(`[GamifyToggle] Gamify mode toggled: ${newValue ? 'ON' : 'OFF'}`);
            } else {
                setError(data.error || 'Failed to update settings');
            }
        } catch (err) {
            console.error('[GamifyToggle] Error toggling gamify mode:', err);
            setError('Failed to update settings');
        } finally {
            setToggling(false);
        }
    };

    if (loading) {
        return null; // Don't show toggle while loading
    }

    return (
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
            <Gamepad2
                size={20}
                className={gamifyMode ? 'text-green-600' : 'text-gray-400'}
            />
            <span className="text-sm font-medium text-gray-700">Gamify Mode</span>

            <button
                onClick={handleToggle}
                disabled={toggling}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    gamifyMode ? 'bg-green-600' : 'bg-gray-300'
                } ${toggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                aria-label="Toggle gamify mode"
            >
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        gamifyMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
            </button>

            <span className={`text-xs font-semibold ${gamifyMode ? 'text-green-600' : 'text-gray-500'}`}>
                {gamifyMode ? 'ON' : 'OFF'}
            </span>

            {error && (
                <span className="text-xs text-red-600">{error}</span>
            )}
        </div>
    );
}
