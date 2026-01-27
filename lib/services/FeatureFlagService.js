/**
 * Feature Flag Service (Facade Pattern + Singleton)
 *
 * Central service for managing all application feature flags.
 * Provides simple API for checking/updating feature availability.
 *
 * Design Patterns:
 * - Facade: Simple interface hiding complexity
 * - Singleton: One service instance manages all flags
 * - Strategy: Features as configuration, not hardcoded
 *
 * Usage:
 * ```javascript
 * const flags = new FeatureFlagService();
 * const enabled = await flags.isEnabled('gamification');
 * await flags.updateFlag('events', true);
 * ```
 */

import { AppSettingsRepository } from '../repositories/AppSettingsRepository.js';

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

  constructor() {
    this.settingsRepo = new AppSettingsRepository();
    this.cache = null; // Simple in-memory cache
    this.cacheExpiry = null;
    this.CACHE_TTL = 30000; // 30 seconds
  }

  /**
   * Check if a feature is enabled
   * Uses caching to minimize database queries
   *
   * @param {string} feature - Feature name (use FeatureFlagService.FEATURES)
   * @returns {Promise<boolean>} True if feature is enabled
   */
  async isEnabled(feature) {
    const flags = await this._getFlags();
    return flags[feature] || false;
  }

  /**
   * Get all feature flags
   *
   * @returns {Promise<Object>} All feature flags { gamification: true, events: false, ... }
   */
  async getAllFlags() {
    return await this._getFlags();
  }

  /**
   * Update a feature flag
   *
   * @param {string} feature - Feature name
   * @param {boolean} enabled - New value
   * @returns {Promise<Object>} Updated settings
   */
  async updateFlag(feature, enabled) {
    this._invalidateCache();
    const updated = await this.settingsRepo.updateSettings({
      [feature]: enabled,
    });
    console.log(`[FeatureFlagService] Feature "${feature}" ${enabled ? 'enabled' : 'disabled'}`);
    return updated;
  }

  /**
   * Bulk update multiple flags
   *
   * @param {Object} updates - { gamification: true, events: false, ... }
   * @returns {Promise<Object>} Updated settings
   */
  async updateFlags(updates) {
    this._invalidateCache();
    const updated = await this.settingsRepo.updateSettings(updates);
    console.log(`[FeatureFlagService] Bulk update:`, updates);
    return updated;
  }

  /**
   * Safe flag check with fallback
   * Never throws, always returns boolean
   *
   * @param {string} feature - Feature name
   * @param {boolean} fallback - Fallback value if check fails (default: false)
   * @returns {Promise<boolean>} True if enabled, fallback on error
   */
  async isEnabledSafe(feature, fallback = false) {
    try {
      return await this.isEnabled(feature);
    } catch (err) {
      console.warn(`[FeatureFlagService] Failed to check ${feature}, using fallback:`, err);
      return fallback;
    }
  }

  /**
   * Get all flags with defensive defaults
   * Never throws, returns safe defaults on error
   *
   * @returns {Promise<Object>} All flags or safe defaults
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
      console.error('[FeatureFlagService] Failed to load flags:', err);
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
   * Batch update with rollback on failure
   * Defensive update that rolls back on error
   *
   * @param {Object} updates - { gamification: true, events: false, ... }
   * @returns {Promise<Object>} { success: boolean, error?: string }
   */
  async updateBatch(updates) {
    let originalSettings;

    try {
      originalSettings = await this.getAllSafe();
      await this.updateFlags(updates);
      return { success: true };
    } catch (err) {
      console.error('[FeatureFlagService] Batch update failed, rolling back:', err);

      // Attempt rollback
      if (originalSettings) {
        try {
          await this.updateFlags(originalSettings);
          console.log('[FeatureFlagService] Rollback successful');
        } catch (rollbackErr) {
          console.error('[FeatureFlagService] Rollback failed:', rollbackErr);
        }
      }

      return { success: false, error: err.message };
    }
  }

  /**
   * Get feature flags with caching
   * @private
   */
  async _getFlags() {
    const now = Date.now();

    // Return cached if valid
    if (this.cache && this.cacheExpiry && now < this.cacheExpiry) {
      return this.cache;
    }

    // Fetch from database
    const settings = await this.settingsRepo.getSettings();

    // Extract only feature flags (remove id, timestamps)
    const flags = {
      gamification: settings.gamification,
      events: settings.events,
      faceDetection: settings.faceDetection,
      photoLikes: settings.photoLikes,
      bulkUpload: settings.bulkUpload,
      challenges: settings.challenges,
    };

    // Update cache
    this.cache = flags;
    this.cacheExpiry = now + this.CACHE_TTL;

    return flags;
  }

  /**
   * Clear cache (called after updates)
   * @private
   */
  _invalidateCache() {
    this.cache = null;
    this.cacheExpiry = null;
  }
}
