/**
 * React Hook for Feature Flags (Observer Pattern)
 *
 * Provides reactive access to feature flags in components.
 * Auto-refreshes when admin toggles flags.
 *
 * Usage:
 * ```javascript
 * import { useFeatureFlag } from '@/lib/hooks/useFeatureFlag';
 *
 * function MyComponent() {
 *   const { enabled, loading } = useFeatureFlag('gamification');
 *
 *   if (!enabled) return null;
 *   return <Leaderboard />;
 * }
 * ```
 */

'use client';

import { useState, useEffect } from 'react';

/**
 * Hook to check if a feature is enabled
 * Automatically refreshes every 60 seconds
 *
 * @param {string} feature - Feature name
 * @param {Object} options - Options
 * @param {number} options.refreshInterval - Refresh interval in ms (default: 60000)
 * @returns {Object} { enabled: boolean, loading: boolean }
 */
export function useFeatureFlag(feature, options = {}) {
  const { refreshInterval = 60000 } = options;
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFlag() {
      try {
        // Fetch from dedicated endpoint (lightweight)
        const res = await fetch(`/api/features?feature=${feature}`);
        const data = await res.json();

        if (data.success) {
          setEnabled(data.data.enabled);
        }
      } catch (err) {
        console.error(`[useFeatureFlag] Error fetching ${feature}:`, err);
        setEnabled(false);
      } finally {
        setLoading(false);
      }
    }

    fetchFlag();
    const interval = setInterval(fetchFlag, refreshInterval);

    return () => clearInterval(interval);
  }, [feature, refreshInterval]);

  return { enabled, loading };
}

/**
 * Hook to fetch all feature flags at once
 * Useful for components that need multiple flags
 *
 * @param {Object} options - Options
 * @param {number} options.refreshInterval - Refresh interval in ms (default: 60000)
 * @returns {Object} { flags: {...}, loading: boolean }
 */
export function useFeatureFlags(options = {}) {
  const { refreshInterval = 60000 } = options;
  const [flags, setFlags] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFlags() {
      try {
        const res = await fetch('/api/features');
        const data = await res.json();

        if (data.success) {
          setFlags(data.data);
        }
      } catch (err) {
        console.error('[useFeatureFlags] Error fetching flags:', err);
        setFlags({});
      } finally {
        setLoading(false);
      }
    }

    fetchFlags();
    const interval = setInterval(fetchFlags, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  return { flags, loading };
}
