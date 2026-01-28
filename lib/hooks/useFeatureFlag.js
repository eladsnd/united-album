/**
 * React Hook for Feature Flags (Observer Pattern)
 *
 * Provides reactive access to feature flags in components.
 * Auto-refreshes when admin toggles flags.
 * Now event-aware - automatically uses current event from EventContext.
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
import { useEventContext } from './useEventContext';

/**
 * Hook to check if a feature is enabled
 * Automatically refreshes every 60 seconds
 * Enhanced with defensive error handling and fallback defaults
 * Event-aware - uses current event from EventContext
 *
 * @param {string} feature - Feature name
 * @param {Object} options - Options
 * @param {number} options.refreshInterval - Refresh interval in ms (default: 60000)
 * @param {boolean} options.defaultValue - Default value on error (default: false)
 * @returns {Object} { enabled: boolean, loading: boolean, error: string|null }
 */
export function useFeatureFlag(feature, options = {}) {
  const { refreshInterval = 60000, defaultValue = false } = options;
  const { currentEventId, loading: eventLoading } = useEventContext();
  const [enabled, setEnabled] = useState(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    // Don't fetch until we have an eventId
    if (!currentEventId) {
      setLoading(eventLoading);
      return;
    }

    async function fetchFlag() {
      try {
        // Fetch from event-scoped endpoint
        const res = await fetch(`/api/events/${currentEventId}/features?feature=${feature}`);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        if (mounted) {
          // Defensive: Check multiple possible response formats
          const isEnabled = data?.enabled ??
                           data?.data?.enabled ??
                           data?.[feature] ??
                           defaultValue;
          setEnabled(Boolean(isEnabled));
          setError(null);
        }
      } catch (err) {
        console.warn(`[useFeatureFlag] Failed to check ${feature} for event ${currentEventId}:`, err);
        if (mounted) {
          setEnabled(defaultValue); // Fallback to default
          setError(err.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchFlag();
    const interval = setInterval(fetchFlag, refreshInterval);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [feature, currentEventId, refreshInterval, defaultValue, eventLoading]);

  return { enabled, loading, error };
}

/**
 * Hook to fetch all feature flags at once
 * Useful for components that need multiple flags
 * Enhanced with defensive error handling and safe defaults
 * Event-aware - uses current event from EventContext
 *
 * @param {Object} options - Options
 * @param {number} options.refreshInterval - Refresh interval in ms (default: 60000)
 * @returns {Object} { flags: {...}, loading: boolean, error: string|null }
 */
export function useFeatureFlags(options = {}) {
  const { refreshInterval = 60000 } = options;
  const { currentEventId, loading: eventLoading } = useEventContext();
  const [flags, setFlags] = useState({
    gamification: false,
    events: false,
    faceDetection: false,
    photoLikes: false,
    bulkUpload: false,
    challenges: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    // Don't fetch until we have an eventId
    if (!currentEventId) {
      setLoading(eventLoading);
      return;
    }

    async function fetchFlags() {
      try {
        const res = await fetch(`/api/events/${currentEventId}/features`);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        if (mounted) {
          // Defensive: Extract flags with fallback defaults
          const fetchedFlags = data?.data ?? data?.flags ?? {};
          setFlags({
            gamification: fetchedFlags?.gamification ?? false,
            events: fetchedFlags?.events ?? false,
            faceDetection: fetchedFlags?.faceDetection ?? false,
            photoLikes: fetchedFlags?.photoLikes ?? false,
            bulkUpload: fetchedFlags?.bulkUpload ?? false,
            challenges: fetchedFlags?.challenges ?? false,
          });
          setError(null);
        }
      } catch (err) {
        console.error(`[useFeatureFlags] Error fetching flags for event ${currentEventId}:`, err);
        if (mounted) {
          // Keep safe defaults, don't overwrite
          setError(err.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchFlags();
    const interval = setInterval(fetchFlags, refreshInterval);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [currentEventId, refreshInterval, eventLoading]);

  return { flags, loading, error };
}
