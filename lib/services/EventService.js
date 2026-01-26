/**
 * Event Service (Service Layer Pattern)
 *
 * Handles business logic for event management and photo-to-event assignment.
 *
 * Responsibilities:
 * - Event CRUD operations
 * - Auto-detection of event boundaries from photo timeline
 * - Bulk photo assignment to events
 * - Timeline generation with photo counts and device breakdown
 *
 * REFACTORED with Repository Pattern:
 * - Uses EventRepository and PhotoRepository for data access
 * - Clean separation between business logic and data access
 */

import { EventRepository } from '../repositories/EventRepository.js';
import { PhotoRepository } from '../repositories/PhotoRepository.js';
import { ValidationError, NotFoundError, InternalServerError } from '../api/errors';

export class EventService {
  constructor() {
    this.eventRepo = new EventRepository();
    this.photoRepo = new PhotoRepository();
  }

  /**
   * Create a new event
   *
   * @param {Object} data - Event data
   * @param {string} data.name - Event name (required)
   * @param {Date|string} data.startTime - Event start time (required)
   * @param {Date|string} data.endTime - Event end time (required)
   * @param {string} data.description - Event description (optional)
   * @param {string} data.color - Event color hex code (optional, default: #3B82F6)
   * @param {number} data.order - Display order (optional, default: 0)
   * @returns {Promise<Object>} Created event
   * @throws {ValidationError} When required fields are missing or invalid
   */
  async createEvent(data) {
    // Validate required fields
    if (!data.name || !data.startTime || !data.endTime) {
      throw new ValidationError('Event name, startTime, and endTime are required');
    }

    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);

    // Validate dates
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new ValidationError('Invalid date format for startTime or endTime');
    }

    if (endTime <= startTime) {
      throw new ValidationError('endTime must be after startTime');
    }

    // Check for overlapping events
    const overlapping = await this.eventRepo.findOverlapping(startTime, endTime);
    if (overlapping.length > 0) {
      console.warn(`[EventService] Warning: New event "${data.name}" overlaps with ${overlapping.length} existing event(s)`);
    }

    const eventData = {
      name: data.name,
      description: data.description || null,
      startTime,
      endTime,
      color: data.color || '#3B82F6',
      order: data.order || 0,
    };

    const event = await this.eventRepo.create(eventData);
    console.log(`[EventService] Created event: ${event.name} (${event.id})`);
    return event;
  }

  /**
   * Update an existing event
   *
   * @param {string} id - Event ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated event
   * @throws {NotFoundError} When event doesn't exist
   * @throws {ValidationError} When updates are invalid
   */
  async updateEvent(id, updates) {
    const event = await this.eventRepo.findById(id);
    if (!event) {
      throw new NotFoundError(`Event with ID ${id} not found`);
    }

    // Validate time range if being updated
    if (updates.startTime || updates.endTime) {
      const startTime = updates.startTime ? new Date(updates.startTime) : event.startTime;
      const endTime = updates.endTime ? new Date(updates.endTime) : event.endTime;

      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        throw new ValidationError('Invalid date format');
      }

      if (endTime <= startTime) {
        throw new ValidationError('endTime must be after startTime');
      }

      updates.startTime = startTime;
      updates.endTime = endTime;
    }

    const updated = await this.eventRepo.update({ id }, updates);
    console.log(`[EventService] Updated event: ${id}`);
    return updated;
  }

  /**
   * Delete an event
   * Note: Photos assigned to this event will have eventId set to null
   *
   * @param {string} id - Event ID
   * @returns {Promise<Object>} Deleted event
   * @throws {NotFoundError} When event doesn't exist
   */
  async deleteEvent(id) {
    const event = await this.eventRepo.findById(id);
    if (!event) {
      throw new NotFoundError(`Event with ID ${id} not found`);
    }

    // Unassign all photos from this event
    const photos = await this.photoRepo.findByEventId(id);
    if (photos.length > 0) {
      const photoIds = photos.map(p => p.id);
      await this.photoRepo.updateEventId(photoIds, null);
      console.log(`[EventService] Unassigned ${photos.length} photos from event ${id}`);
    }

    const deleted = await this.eventRepo.deleteById(id);
    console.log(`[EventService] Deleted event: ${id}`);
    return deleted;
  }

  /**
   * Get all events with photo counts and device breakdown
   *
   * @returns {Promise<Array>} Events with metadata
   */
  async getEventTimeline() {
    const events = await this.eventRepo.findAllWithPhotoCounts();

    // Enrich with device breakdown for each event
    const enrichedEvents = await Promise.all(
      events.map(async (event) => {
        const photos = await this.photoRepo.findByEventId(event.id);

        // Build device breakdown
        const devices = {};
        photos.forEach(photo => {
          if (photo.deviceModel) {
            const key = photo.deviceMake
              ? `${photo.deviceMake} ${photo.deviceModel}`
              : photo.deviceModel;
            devices[key] = (devices[key] || 0) + 1;
          }
        });

        return {
          ...event,
          devices: Object.entries(devices).map(([model, count]) => ({ model, count }))
        };
      })
    );

    return enrichedEvents;
  }

  /**
   * Auto-detect event boundaries from photo timeline
   * Identifies time gaps between photos and suggests event splits
   *
   * @param {number} minGapHours - Minimum gap (in hours) to consider as event boundary (default: 2)
   * @returns {Promise<Array>} Suggested event splits with photo counts
   */
  async autoDetectEventGaps(minGapHours = 2) {
    // Get all photos with capture time, ordered chronologically
    const photos = await this.photoRepo.findAllByCaptureTime();

    if (photos.length === 0) {
      return [];
    }

    const minGapMs = minGapHours * 60 * 60 * 1000; // Convert hours to milliseconds
    const suggestions = [];
    let currentGroup = {
      startTime: photos[0].capturedAt,
      endTime: photos[0].capturedAt,
      photoIds: [photos[0].id],
      photos: [photos[0]]
    };

    for (let i = 1; i < photos.length; i++) {
      const photo = photos[i];
      const prevPhoto = photos[i - 1];

      const gap = new Date(photo.capturedAt) - new Date(prevPhoto.capturedAt);

      if (gap >= minGapMs) {
        // Gap detected - finalize current group
        suggestions.push({
          name: `Event ${suggestions.length + 1}`,
          startTime: currentGroup.startTime,
          endTime: currentGroup.endTime,
          photoCount: currentGroup.photoIds.length,
          photoIds: currentGroup.photoIds,
          devices: this._extractDevices(currentGroup.photos),
          suggestedColor: this._generateColor(suggestions.length)
        });

        // Start new group
        currentGroup = {
          startTime: photo.capturedAt,
          endTime: photo.capturedAt,
          photoIds: [photo.id],
          photos: [photo]
        };
      } else {
        // Add to current group
        currentGroup.endTime = photo.capturedAt;
        currentGroup.photoIds.push(photo.id);
        currentGroup.photos.push(photo);
      }
    }

    // Add final group
    suggestions.push({
      name: `Event ${suggestions.length + 1}`,
      startTime: currentGroup.startTime,
      endTime: currentGroup.endTime,
      photoCount: currentGroup.photoIds.length,
      photoIds: currentGroup.photoIds,
      devices: this._extractDevices(currentGroup.photos),
      suggestedColor: this._generateColor(suggestions.length)
    });

    console.log(`[EventService] Auto-detected ${suggestions.length} event(s) with ${minGapHours}h gap threshold`);
    return suggestions;
  }

  /**
   * Assign multiple photos to an event
   *
   * @param {string} eventId - Event ID (or null to unassign)
   * @param {Array<number>} photoIds - Photo database IDs
   * @returns {Promise<{count: number}>} Number of assigned photos
   * @throws {NotFoundError} When event doesn't exist
   */
  async assignPhotosToEvent(eventId, photoIds) {
    // Validate photoIds first
    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      throw new ValidationError('photoIds must be a non-empty array');
    }

    // Then check if event exists (if not null)
    if (eventId !== null) {
      const event = await this.eventRepo.findById(eventId);
      if (!event) {
        throw new NotFoundError(`Event with ID ${eventId} not found`);
      }
    }

    const result = await this.photoRepo.updateEventId(photoIds, eventId);
    console.log(`[EventService] Assigned ${result.count} photos to event: ${eventId || 'unassigned'}`);
    return result;
  }

  /**
   * Get photos not assigned to any event
   *
   * @returns {Promise<Array>} Unassigned photos
   */
  async getUnassignedPhotos() {
    return await this.photoRepo.findUnassigned();
  }

  /**
   * Extract unique devices from photos
   * @private
   */
  _extractDevices(photos) {
    const devices = {};
    photos.forEach(photo => {
      if (photo.deviceModel) {
        const key = photo.deviceMake
          ? `${photo.deviceMake} ${photo.deviceModel}`
          : photo.deviceModel;
        devices[key] = (devices[key] || 0) + 1;
      }
    });
    return Object.entries(devices).map(([model, count]) => ({ model, count }));
  }

  /**
   * Generate color for event based on index
   * @private
   */
  _generateColor(index) {
    const colors = [
      '#3B82F6', // Blue
      '#10B981', // Green
      '#F59E0B', // Amber
      '#EF4444', // Red
      '#8B5CF6', // Purple
      '#EC4899', // Pink
      '#14B8A6', // Teal
      '#F97316', // Orange
    ];
    return colors[index % colors.length];
  }
}
