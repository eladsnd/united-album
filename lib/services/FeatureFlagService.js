/**
 * Feature Flag Service (Multi-Tenant)
 *
 * Manages per-event feature flags with caching.
 * Each event has independent feature flag configuration.
 *
 * Design Patterns:
 * - Facade: Simple interface hiding complexity
 * - Strategy: Features as configuration, not hardcoded
 * - Multi-Tenancy: Event-scoped flags
 *
 * Usage:
 * ```javascript
 * // Event-specific flags
 * const flags = new FeatureFlagService('event-123');
 * const enabled = await flags.isEnabled('gamification');
 * await flags.updateFlag('events', true);
 *
 * // Get all flags for event
 * const allFlags = await flags.getAllFlags();
 * ```
 */

import { EventSettingsRepository } from '../repositories/EventSettingsRepository.js';

export class FeatureFlagService {
  // Valid feature names (prevents typos)
  static FEATURES = {
    GAMIFICATION: 'gamification',
    EVENTS: 'events',
    FACE_DETECTION: 'faceDetection',
    PHOTO_LIKES: 'photoLikes',
    BULK_UPLOAD: 'bulkUpload',
    CHALLENGES: 'challenges',
  };

  // Shared cache across all instances (per-event caching)
  static cache = new Map(); // Map<eventId, {data, expiry}>
  static CACHE_TTL = 30000; // 30 seconds

  /**
   * Create feature flag service for a specific event
   *
   * @param {string} eventId - Event ID for scoped flags
   *
   * @example
   * const service = new FeatureFlagService('event-123');
   */
  constructor(eventId = null) {
    if (!eventId) {
      throw new Error('EventId is required for feature flag service');
    }

    this.eventId = eventId;
    this.settingsRepo = new EventSettingsRepository();
  }

  /**
   * Check if a feature is enabled for this event
   * Uses caching to minimize database queries
   *
   * @param {string} feature - Feature name (use FeatureFlagService.FEATURES)
   * @returns {Promise<boolean>} True if feature is enabled
   *
   * @example
   * const enabled = await service.isEnabled('gamification');
   */
  async isEnabled(feature) {
    const flags = await this._getFlags();
    return flags[feature] || false;
  }

  /**
   * Get all feature flags for this event
   *
   * @returns {Promise<Object>} All feature flags { gamification: true, events: false, ... }
   *
   * @example
   * const flags = await service.getAllFlags();
   * console.log('Features:', flags);
   */
  async getAllFlags() {
    return await this._getFlags();
  }

  /**
   * Update a single feature flag for this event
   *
   * @param {string} feature - Feature name
   * @param {boolean} enabled - New value
   * @returns {Promise<Object>} Updated settings
   *
   * @example
   * await service.updateFlag('gamification', true);
   */
  async updateFlag(feature, enabled) {
    this._invalidateCache();

    await this.settingsRepo.updateSettings(this.eventId, {
      [feature]: enabled,
    });

    console.log(`[FeatureFlagService] Event ${this.eventId}: Feature "${feature}" ${enabled ? 'enabled' : 'disabled'}`);

    // Return just the flags (not full database record)
    return await this._getFlags();
  }

  /**
   * Bulk update multiple flags for this event
   *
   * @param {Object} updates - { gamification: true, events: false, ... }
   * @returns {Promise<Object>} Updated settings
   *
   * @example
   * await service.updateFlags({
   *   gamification: true,
   *   challenges: true,
   *   bulkUpload: false
   * });
   */
  async updateFlags(updates) {
    this._invalidateCache();

    await this.settingsRepo.updateSettings(this.eventId, updates);
    console.log(`[FeatureFlagService] Event ${this.eventId}: Bulk update:`, updates);

    // Return just the flags (not full database record)
    return await this._getFlags();
  }

  /**
   * Safe flag check with fallback (never throws)
   *
   * @param {string} feature - Feature name
   * @param {boolean} fallback - Fallback value if check fails (default: false)
   * @returns {Promise<boolean>} True if enabled, fallback on error
   *
   * @example
   * const enabled = await service.isEnabledSafe('gamification', false);
   */
  async isEnabledSafe(feature, fallback = false) {
    try {
      return await this.isEnabled(feature);
    } catch (err) {
      console.warn(`[FeatureFlagService] Event ${this.eventId}: Failed to check ${feature}, using fallback:`, err);
      return fallback;
    }
  }

  /**
   * Get all flags with defensive defaults (never throws)
   *
   * @returns {Promise<Object>} All flags or safe defaults
   *
   * @example
   * const flags = await service.getAllSafe();
   */
  async getAllSafe() {
    try {
      const settings = await this._getFlags();
      return {
        gamification: settings?.gamification ?? false,
        events: settings?.events ?? false,
        faceDetection: settings?.faceDetection ?? false,
        photoLikes: settings?.photoLikes ?? false,
        bulkUpload: settings?.bulkUpload ?? false,
        challenges: settings?.challenges ?? false,
      };
    } catch (err) {
      console.error(`[FeatureFlagService] Event ${this.eventId}: Failed to load flags:`, err);
      // Return all disabled as safe default
      return {
        gamification: false,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
        challenges: false,
      };
    }
  }

  /**
   * Get feature flags with caching (per-event)
   * @private
   */
  async _getFlags() {
    const now = Date.now();

    // Check cache for this event
    const cached = FeatureFlagService.cache.get(this.eventId);
    if (cached && cached.expiry > now) {
      return cached.data;
    }

    // Fetch from database
    const settings = await this.settingsRepo.getByEventId(this.eventId);

    // Extract only feature flags (remove id, timestamps, eventId)
    const flags = {
      gamification: settings.gamification,
      events: settings.events,
      faceDetection: settings.faceDetection,
      photoLikes: settings.photoLikes,
      bulkUpload: settings.bulkUpload,
      challenges: settings.challenges,
    };

    // Update cache for this event
    FeatureFlagService.cache.set(this.eventId, {
      data: flags,
      expiry: now + FeatureFlagService.CACHE_TTL,
    });

    return flags;
  }

  /**
   * Clear cache for this event (called after updates)
   * @private
   */
  _invalidateCache() {
    FeatureFlagService.cache.delete(this.eventId);
  }

  /**
   * Clear all cached flags (for all events)
   * @static
   */
  static clearAllCache() {
    FeatureFlagService.cache.clear();
    console.log('[FeatureFlagService] All caches cleared');
  }
}
