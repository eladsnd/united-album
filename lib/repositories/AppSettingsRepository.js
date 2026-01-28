/**
 * AppSettings Repository (Repository Pattern + Singleton Pattern)
 *
 * Manages global application settings including feature flags.
 * Only one AppSettings record ever exists (id: "app_settings").
 *
 * Design Pattern: Repository Pattern + Singleton Pattern
 * - Extends BaseRepository for consistent CRUD operations
 * - Singleton: Always returns/updates same record
 * - Auto-creates settings on first access with defaults
 *
 * Usage:
 * ```javascript
 * const settingsRepo = new AppSettingsRepository();
 * const settings = await settingsRepo.getSettings();
 * await settingsRepo.updateSettings({ gamification: true, events: true });
 * ```
 */

import { BaseRepository } from './BaseRepository.js';

export class AppSettingsRepository extends BaseRepository {
  static SETTINGS_ID = 'app_settings';

  /**
   * Get Prisma model name
   * @returns {string} 'appSettings'
   */
  getModel() {
    return 'appSettings';
  }

  /**
   * Get application settings (singleton)
   * Auto-creates default settings if they don't exist
   *
   * @returns {Promise<Object>} Settings object with all feature flags
   */
  async getSettings() {
    let settings = await this.findUnique({ id: AppSettingsRepository.SETTINGS_ID });

    // Auto-create default settings if they don't exist
    if (!settings) {
      settings = await this.create({
        id: AppSettingsRepository.SETTINGS_ID,
        gamification: false,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
      });
      console.log('[AppSettingsRepository] Created default settings with all feature flags');
    }

    return settings;
  }

  /**
   * Update application settings
   *
   * @param {Object} updates - Fields to update (e.g., { gamifyMode: true })
   * @returns {Promise<Object>} Updated settings
   */
  async updateSettings(updates) {
    // Ensure settings exist first (creates if missing)
    const existingSettings = await this.getSettings();
    console.log('[AppSettingsRepository] Existing settings loaded:', existingSettings ? 'Found' : 'Created');

    // Use upsert to handle both create and update cases
    const updated = await this.prisma.appSettings.upsert({
      where: { id: AppSettingsRepository.SETTINGS_ID },
      update: updates,
      create: {
        id: AppSettingsRepository.SETTINGS_ID,
        gamification: false,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
        challenges: false,
        ...updates, // Apply updates to newly created record
      },
    });

    console.log(`[AppSettingsRepository] Updated settings:`, updates);
    return updated;
  }

  /**
   * Get a specific feature flag value
   *
   * @param {string} featureName - Feature flag name (e.g., 'gamification', 'events')
   * @returns {Promise<boolean>} Feature flag value
   */
  async getFeatureFlag(featureName) {
    const settings = await this.getSettings();
    return settings[featureName] || false;
  }

  /**
   * Set a specific feature flag value
   *
   * @param {string} featureName - Feature flag name
   * @param {boolean} value - New value
   * @returns {Promise<Object>} Updated settings
   */
  async setFeatureFlag(featureName, value) {
    return this.updateSettings({ [featureName]: value });
  }

  /**
   * Reset all feature flags to defaults (false)
   *
   * @returns {Promise<Object>} Updated settings
   */
  async resetFeatureFlags() {
    return this.updateSettings({
      gamification: false,
      events: false,
      faceDetection: false,
      photoLikes: false,
      bulkUpload: false,
    });
  }

  // Deprecated methods (for backward compatibility)

  /**
   * @deprecated Use getFeatureFlag('gamification') instead
   * @returns {Promise<boolean>} True if gamification is enabled
   */
  async isGamifyModeEnabled() {
    return this.getFeatureFlag('gamification');
  }

  /**
   * @deprecated Use setFeatureFlag('gamification', value) instead
   * @returns {Promise<Object>} Updated settings
   */
  async toggleGamifyMode() {
    const settings = await this.getSettings();
    const newValue = !settings.gamification;
    const updated = await this.updateSettings({ gamification: newValue });
    console.log(`[AppSettingsRepository] Toggled gamification: ${settings.gamification} → ${newValue}`);
    return updated;
  }
}
