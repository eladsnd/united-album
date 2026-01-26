/**
 * Event Repository (Repository Pattern)
 *
 * Extends BaseRepository to provide event-specific data access operations.
 *
 * Design Pattern: Repository Pattern + Template Method Pattern
 * - Inherits all CRUD operations from BaseRepository
 * - No special serialization needed (Event model has only primitive fields)
 * - Adds event-specific query methods
 *
 * Benefits:
 * - Consistent interface with other repositories
 * - Automatic error handling via BaseRepository
 * - Clean separation of data access from business logic
 *
 * Usage:
 * ```javascript
 * const eventRepo = new EventRepository();
 * const event = await eventRepo.create({ name: 'Ceremony', startTime, endTime });
 * const events = await eventRepo.findAll();
 * const overlapping = await eventRepo.findOverlapping(startTime, endTime);
 * ```
 */

import { BaseRepository } from './BaseRepository.js';

export class EventRepository extends BaseRepository {
  /**
   * Get Prisma model name
   * @returns {string} 'event'
   */
  getModel() {
    return 'event';
  }

  /**
   * Get all events ordered by start time (then custom order field)
   *
   * @returns {Promise<Array>} All event records
   */
  async findAll() {
    return await this.findMany({
      orderBy: [
        { startTime: 'asc' },
        { order: 'asc' }
      ],
    });
  }

  /**
   * Get all events with photo counts
   * Uses Prisma's include to fetch related photos
   *
   * @returns {Promise<Array>} Events with photo counts and device lists
   */
  async findAllWithPhotoCounts() {
    try {
      const client = this._getClient();
      const events = await client.findMany({
        include: {
          _count: {
            select: { photos: true }
          }
        },
        orderBy: [
          { startTime: 'asc' },
          { order: 'asc' }
        ]
      });

      return events.map(event => ({
        ...event,
        photoCount: event._count.photos
      }));
    } catch (error) {
      console.error(`[${this.constructor.name}] FindAllWithPhotoCounts failed:`, error);
      throw error;
    }
  }

  /**
   * Get event by ID
   *
   * @param {string} id - Event ID
   * @returns {Promise<Object|null>} Event or null if not found
   */
  async findById(id) {
    return await this.findUnique({ id });
  }

  /**
   * Find events that overlap with a given time range
   * An event overlaps if its time range intersects with [startTime, endTime]
   *
   * @param {Date|string} startTime - Range start time
   * @param {Date|string} endTime - Range end time
   * @returns {Promise<Array>} Overlapping events
   */
  async findOverlapping(startTime, endTime) {
    return await this.findMany({
      where: {
        OR: [
          // Event starts within the range
          {
            startTime: {
              gte: new Date(startTime),
              lte: new Date(endTime)
            }
          },
          // Event ends within the range
          {
            endTime: {
              gte: new Date(startTime),
              lte: new Date(endTime)
            }
          },
          // Event completely encompasses the range
          {
            AND: [
              { startTime: { lte: new Date(startTime) } },
              { endTime: { gte: new Date(endTime) } }
            ]
          }
        ]
      },
      orderBy: { startTime: 'asc' }
    });
  }

  /**
   * Find events within a date range
   * Returns events where startTime is within [start, end]
   *
   * @param {Date|string} start - Range start date
   * @param {Date|string} end - Range end date
   * @returns {Promise<Array>} Events in range
   */
  async findByDateRange(start, end) {
    return await this.findMany({
      where: {
        startTime: {
          gte: new Date(start),
          lte: new Date(end)
        }
      },
      orderBy: { startTime: 'asc' }
    });
  }

  /**
   * Delete event by ID
   *
   * @param {string} id - Event ID
   * @returns {Promise<Object>} Deleted event record
   */
  async deleteById(id) {
    const deletedEvent = await this.delete({ id });
    console.log(`[EventRepository] Deleted event: ${id}`);
    return deletedEvent;
  }

  /**
   * Check if event exists
   *
   * @param {string} id - Event ID
   * @returns {Promise<boolean>} True if exists, false otherwise
   */
  async exists(id) {
    const event = await this.findUnique({ id });
    return event !== null;
  }

  /**
   * Update event order
   *
   * @param {string} id - Event ID
   * @param {number} order - New order value
   * @returns {Promise<Object>} Updated event
   */
  async updateOrder(id, order) {
    return await this.update({ id }, { order });
  }
}
