/**
 * EventSettings Repository (Repository Pattern)
 *
 * Manages per-event feature flags and settings.
 * Each event has its own independent feature flag configuration.
 *
 * Pattern: Repository pattern extending BaseRepository
 *
 * Usage:
 * ```javascript
 * const settingsRepo = new EventSettingsRepository();
 * const settings = await settingsRepo.getByEventId('event-123');
 * await settingsRepo.updateSettings('event-123', { gamification: true });
 * ```
 */

import { BaseRepository } from './BaseRepository.js';

export class EventSettingsRepository extends BaseRepository {
  /**
   * Get Prisma model name
   * @returns {string} 'eventSettings'
   */
  getModel() {
    return 'eventSettings';
  }

  /**
   * Get event settings by event ID
   * Auto-creates default settings if they don't exist
   *
   * @param {string} eventId - Event ID
   * @returns {Promise<Object>} Event settings with all feature flags
   *
   * @example
   * const settings = await settingsRepo.getByEventId('event-123');
   * console.log('Gamification enabled:', settings.gamification);
   */
  async getByEventId(eventId) {
    if (!eventId || typeof eventId !== 'string') {
      throw new Error('EventId must be a non-empty string');
    }

    try {
      let settings = await this.findUnique({ eventId });

      // Auto-create default settings if they don't exist
      if (!settings) {
        console.log(`[EventSettingsRepository] Creating default settings for event: ${eventId}`);
        settings = await this.createDefaultSettings(eventId);
      }

      return settings;
    } catch (error) {
      console.error(`[EventSettingsRepository] Error fetching settings for event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Create default settings for an event
   *
   * @param {string} eventId - Event ID
   * @returns {Promise<Object>} Created settings
   *
   * @example
   * const settings = await settingsRepo.createDefaultSettings('event-123');
   */
  async createDefaultSettings(eventId) {
    try {
      const settings = await this.create({
        eventId,
        gamification: false,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
        challenges: false,
        allowGuestUploads: true,
        requireModeration: false,
      });

      console.log(`[EventSettingsRepository] Default settings created for event: ${eventId}`);
      return settings;
    } catch (error) {
      // Handle race condition - another request may have created settings simultaneously
      if (error.code === 'P2002') {
        console.log(`[EventSettingsRepository] Settings already exist (race condition), fetching...`);
        return await this.findUnique({ eventId });
      }

      console.error(`[EventSettingsRepository] Error creating default settings:`, error);
      throw error;
    }
  }

  /**
   * Update event settings
   *
   * @param {string} eventId - Event ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated settings
   *
   * @example
   * await settingsRepo.updateSettings('event-123', {
   *   gamification: true,
   *   challenges: true
   * });
   */
  async updateSettings(eventId, updates) {
    if (!eventId || typeof eventId !== 'string') {
      throw new Error('EventId must be a non-empty string');
    }

    if (!updates || typeof updates !== 'object') {
      throw new Error('Updates must be an object');
    }

    try {
      // Ensure settings exist first (creates if missing)
      await this.getByEventId(eventId);

      // Use upsert to handle both create and update cases atomically
      const updated = await this.upsert(
        { eventId },
        {
          // Create data (if record doesn't exist)
          eventId,
          gamification: false,
          events: false,
          faceDetection: false,
          photoLikes: false,
          bulkUpload: false,
          challenges: false,
          allowGuestUploads: true,
          requireModeration: false,
          ...updates, // Apply updates to newly created record
        },
        updates // Update data (if record exists)
      );

      console.log(`[EventSettingsRepository] Settings updated for event ${eventId}:`, updates);
      return updated;
    } catch (error) {
      console.error(`[EventSettingsRepository] Error updating settings for event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific feature flag value for an event
   *
   * @param {string} eventId - Event ID
   * @param {string} featureName - Feature flag name
   * @returns {Promise<boolean>} Feature flag value
   *
   * @example
   * const isEnabled = await settingsRepo.getFeatureFlag('event-123', 'gamification');
   */
  async getFeatureFlag(eventId, featureName) {
    const settings = await this.getByEventId(eventId);
    return settings[featureName] || false;
  }

  /**
   * Set a specific feature flag value for an event
   *
   * @param {string} eventId - Event ID
   * @param {string} featureName - Feature flag name
   * @param {boolean} value - New value
   * @returns {Promise<Object>} Updated settings
   *
   * @example
   * await settingsRepo.setFeatureFlag('event-123', 'gamification', true);
   */
  async setFeatureFlag(eventId, featureName, value) {
    return this.updateSettings(eventId, { [featureName]: value });
  }

  /**
   * Reset all feature flags to defaults for an event
   *
   * @param {string} eventId - Event ID
   * @returns {Promise<Object>} Updated settings
   *
   * @example
   * await settingsRepo.resetFeatureFlags('event-123');
   */
  async resetFeatureFlags(eventId) {
    return this.updateSettings(eventId, {
      gamification: false,
      events: false,
      faceDetection: false,
      photoLikes: false,
      bulkUpload: false,
      challenges: false,
    });
  }

  /**
   * Delete event settings (cleanup when event is deleted)
   *
   * @param {string} eventId - Event ID
   * @returns {Promise<void>}
   *
   * @example
   * await settingsRepo.deleteByEventId('event-123');
   */
  async deleteByEventId(eventId) {
    try {
      await this.prisma.eventSettings.delete({
        where: { eventId },
      });

      console.log(`[EventSettingsRepository] Settings deleted for event: ${eventId}`);
    } catch (error) {
      // Ignore if settings don't exist
      if (error.code === 'P2025') {
        console.log(`[EventSettingsRepository] No settings to delete for event: ${eventId}`);
        return;
      }

      console.error(`[EventSettingsRepository] Error deleting settings for event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Get all events with a specific feature enabled
   *
   * @param {string} featureName - Feature flag name
   * @returns {Promise<Array>} List of eventIds with feature enabled
   *
   * @example
   * const eventsWithGamification = await settingsRepo.getEventsWithFeature('gamification');
   */
  async getEventsWithFeature(featureName) {
    try {
      const settings = await this.findMany({
        where: { [featureName]: true },
        select: { eventId: true },
      });

      return settings.map(s => s.eventId);
    } catch (error) {
      console.error(`[EventSettingsRepository] Error fetching events with feature ${featureName}:`, error);
      throw error;
    }
  }
}
