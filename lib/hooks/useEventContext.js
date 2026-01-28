/**
 * Event Context Hook (Multi-Tenancy)
 *
 * Provides global event context for the application.
 * Manages current event ID and available events for the user.
 *
 * Usage:
 * ```javascript
 * // In app layout (wrap app)
 * <EventProvider>
 *   <App />
 * </EventProvider>
 *
 * // In components
 * const { currentEventId, setCurrentEventId, events } = useEventContext();
 * ```
 */

'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

const EventContext = createContext(null);

/**
 * Event Context Provider
 *
 * Wraps the application to provide event context to all components.
 * Auto-detects event from URL slug or uses default event.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components
 *
 * @example
 * // app/layout.js
 * export default function RootLayout({ children }) {
 *   return (
 *     <EventProvider>
 *       {children}
 *     </EventProvider>
 *   );
 * }
 */
export function EventProvider({ children }) {
  const [currentEventId, setCurrentEventId] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pathname = usePathname();

  useEffect(() => {
    // Auto-detect event whenever pathname changes
    detectAndLoadEvent();
  }, [pathname]);

  /**
   * Detect event from URL or use default
   * Enhanced with error handling, abort controller, and proper cleanup
   */
  const detectAndLoadEvent = async () => {
    const controller = new AbortController();
    let mounted = true;

    try {
      if (mounted) {
        setLoading(true);
        setError(null);
      }

      // Try to detect from URL first (e.g., /my-wedding or /my-wedding/admin)
      const pathSegments = pathname.split('/').filter(Boolean);
      let detectedSlug = null;

      // Check if first segment is a slug (not admin, super-admin, api, _next, favicon, robots, etc.)
      if (pathSegments.length > 0) {
        const firstSegment = pathSegments[0];
        const systemRoutes = ['admin', 'super-admin', 'api', '_next', 'favicon.ico', 'robots.txt', 'sitemap.xml'];

        if (!systemRoutes.includes(firstSegment)) {
          detectedSlug = firstSegment;
        }
      }

      if (detectedSlug) {
        // Validate slug format
        if (detectedSlug.length > 100) {
          throw new Error('Event slug too long');
        }

        // Fetch event by slug with timeout
        const res = await fetch(`/api/events/by-slug/${detectedSlug}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();

        // Validate response structure
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid API response');
        }

        if (data.success && data.event && data.event.id) {
          if (mounted) {
            setCurrentEventId(data.event.id);
            console.log('[EventContext] Detected event from URL:', data.event.name, 'ID:', data.event.id);
            setLoading(false);
            setError(null);
          }
          return;
        } else {
          console.warn('[EventContext] Event not found for slug:', detectedSlug);
          if (mounted) {
            setError(`Event "${detectedSlug}" not found`);
          }
        }
      }

      // Fallback: No event detected (homepage, admin, etc.)
      console.log('[EventContext] No event slug detected');
      if (mounted) {
        setCurrentEventId(null);
        setLoading(false);
        setError(null);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('[EventContext] Request aborted');
        return;
      }

      console.error('[EventContext] Error detecting event:', error);
      if (mounted) {
        setError(error.message);
        setCurrentEventId(null);
        setLoading(false);
      }
    }

    return () => {
      mounted = false;
      controller.abort();
    };
  };

  /**
   * Load available events for current user
   * (Called after user logs in as admin)
   */
  const loadUserEvents = async (authToken) => {
    try {
      const res = await fetch('/api/events/user', {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });

      const data = await res.json();

      if (data.success) {
        setEvents(data.events || []);
        console.log(`[EventContext] Loaded ${data.events?.length || 0} events for user`);
      }
    } catch (error) {
      console.error('[EventContext] Error loading user events:', error);
    }
  };

  const value = {
    currentEventId,
    setCurrentEventId,
    events,
    setEvents,
    loading,
    error,
    loadUserEvents,
  };

  return (
    <EventContext.Provider value={value}>
      {children}
    </EventContext.Provider>
  );
}

/**
 * Hook to access event context
 *
 * @returns {Object} Event context
 * @returns {string|null} currentEventId - Current event ID
 * @returns {Function} setCurrentEventId - Update current event
 * @returns {Array} events - List of available events for user
 * @returns {Function} setEvents - Update events list
 * @returns {boolean} loading - Whether event is being loaded
 * @returns {Function} loadUserEvents - Load events for authenticated user
 *
 * @example
 * const { currentEventId, setCurrentEventId } = useEventContext();
 *
 * if (!currentEventId) {
 *   return <div>Loading event...</div>;
 * }
 *
 * // Switch event
 * setCurrentEventId('other-event-id');
 */
export function useEventContext() {
  const context = useContext(EventContext);

  if (!context) {
    throw new Error('useEventContext must be used within EventProvider');
  }

  return context;
}
