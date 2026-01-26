/**
 * AppSettings Repository (Repository Pattern + Singleton Pattern)
 *
 * Manages global application settings with singleton pattern.
 * Only one AppSettings record ever exists (id: "app_settings").
 *
 * Design Pattern: Repository Pattern + Singleton Pattern
 * - Extends BaseRepository for consistent CRUD operations
 * - Singleton: Always returns/updates same record
 * - Auto-creates settings on first access
 *
 * Usage:
 * ```javascript
 * const settingsRepo = new AppSettingsRepository();
 * const settings = await settingsRepo.getSettings();
 * await settingsRepo.updateSettings({ gamifyMode: true });
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
   * @returns {Promise<Object>} Settings object { id, gamifyMode, createdAt, updatedAt }
   */
  async getSettings() {
    let settings = await this.findUnique({ id: AppSettingsRepository.SETTINGS_ID });

    // Auto-create default settings if they don't exist
    if (!settings) {
      settings = await this.create({
        id: AppSettingsRepository.SETTINGS_ID,
        gamifyMode: false,
      });
      console.log('[AppSettingsRepository] Created default settings');
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
    // Ensure settings exist first
    await this.getSettings();

    const updated = await this.update(
      { id: AppSettingsRepository.SETTINGS_ID },
      updates
    );

    console.log(`[AppSettingsRepository] Updated settings:`, updates);
    return updated;
  }

  /**
   * Get gamify mode status
   *
   * @returns {Promise<boolean>} True if gamify mode is enabled
   */
  async isGamifyModeEnabled() {
    const settings = await this.getSettings();
    return settings.gamifyMode;
  }

  /**
   * Toggle gamify mode
   *
   * @returns {Promise<Object>} Updated settings with new gamifyMode value
   */
  async toggleGamifyMode() {
    const settings = await this.getSettings();
    const newValue = !settings.gamifyMode;

    const updated = await this.updateSettings({ gamifyMode: newValue });
    console.log(`[AppSettingsRepository] Toggled gamify mode: ${settings.gamifyMode} → ${newValue}`);

    return updated;
  }
}
