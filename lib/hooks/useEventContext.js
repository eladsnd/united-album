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

  useEffect(() => {
    // Auto-detect event on mount
    detectAndLoadEvent();
  }, []);

  /**
   * Detect event from URL or use default
   */
  const detectAndLoadEvent = async () => {
    try {
      setLoading(true);

      // Try to detect from URL first (e.g., /events/my-wedding)
      const pathSegments = window.location.pathname.split('/');
      let detectedSlug = null;

      if (pathSegments[1] === 'events' && pathSegments[2]) {
        detectedSlug = pathSegments[2];
      }

      if (detectedSlug) {
        // Fetch event by slug
        const res = await fetch(`/api/events?slug=${detectedSlug}`);
        const data = await res.json();

        if (data.success && data.event) {
          setCurrentEventId(data.event.id);
          console.log('[EventContext] Detected event from URL:', data.event.name);
          setLoading(false);
          return;
        }
      }

      // Fallback: Use default event
      const defaultRes = await fetch('/api/events/default');
      const defaultData = await defaultRes.json();

      if (defaultData.success && defaultData.event) {
        setCurrentEventId(defaultData.event.id);
        console.log('[EventContext] Using default event:', defaultData.event.name);
      } else {
        console.warn('[EventContext] No default event found');
      }
    } catch (error) {
      console.error('[EventContext] Error detecting event:', error);
    } finally {
      setLoading(false);
    }
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
