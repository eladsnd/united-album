/**
 * Admin Authentication Utilities
 *
 * Utilities for managing admin session tokens in the browser.
 * Tokens are stored in sessionStorage (cleared on browser close).
 */

import { logger } from './logger';

/**
 * Get the admin authentication token from sessionStorage
 *
 * @returns {string|null} The admin token, or null if not logged in or unavailable
 *
 * @example
 * const token = getAdminToken();
 * if (token) {
 *   // Make authenticated admin API call
 *   fetch('/api/admin/poses', {
 *     headers: { Authorization: `Bearer ${token}` }
 *   });
 * }
 */
export function getAdminToken() {
  // SSR safety check
  if (typeof window === 'undefined') {
    return null;
  }

  // Check if sessionStorage is available
  if (!window.sessionStorage) {
    logger.warn('[adminAuth] sessionStorage not available');
    return null;
  }

  try {
    const token = sessionStorage.getItem('admin_token');
    return token;
  } catch (error) {
    logger.error('[adminAuth] Error reading admin token:', error);
    return null;
  }
}

/**
 * Check if the user is currently authenticated as admin
 *
 * @returns {boolean} True if admin token exists, false otherwise
 *
 * @example
 * if (isAdmin()) {
 *   // Show admin-only UI
 * }
 */
export function isAdmin() {
  const token = getAdminToken();
  return !!token;
}

/**
 * Store admin authentication token in sessionStorage
 *
 * @param {string} token - The admin authentication token
 * @returns {boolean} True if stored successfully, false otherwise
 *
 * @example
 * const success = setAdminToken('jwt_token_here');
 * if (success) {
 *   // Redirect to admin dashboard
 * }
 */
export function setAdminToken(token) {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return false;
  }

  try {
    sessionStorage.setItem('admin_token', token);
    logger.debug('[adminAuth] Admin token stored');
    return true;
  } catch (error) {
    logger.error('[adminAuth] Error storing admin token:', error);
    return false;
  }
}

/**
 * Clear admin authentication token (logout)
 *
 * @returns {boolean} True if cleared successfully, false otherwise
 *
 * @example
 * clearAdminToken();
 * // Redirect to login page
 */
export function clearAdminToken() {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return false;
  }

  try {
    sessionStorage.removeItem('admin_token');
    logger.debug('[adminAuth] Admin token cleared');
    return true;
  } catch (error) {
    logger.error('[adminAuth] Error clearing admin token:', error);
    return false;
  }
}
