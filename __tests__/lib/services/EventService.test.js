/**
 * EventService Tests
 *
 * Tests for event management business logic including:
 * - Event CRUD operations with validation
 * - Auto-detection of event boundaries from photo timeline
 * - Bulk photo assignment to events
 * - Timeline generation with device breakdown
 */

import { prismaMock } from '../../prismaMock.js';

// Mock Prisma client BEFORE importing services
jest.mock('../../../lib/prisma.js', () => ({
  __esModule: true,
  default: require('../../prismaMock.js').prismaMock,
}));

import { EventService } from '../../../lib/services/EventService.js';
import { ValidationError, NotFoundError } from '../../../lib/api/errors.js';

describe('EventService', () => {
  let eventService;

  beforeEach(() => {
    eventService = new EventService();
    jest.clearAllMocks();
  });

  describe('createEvent()', () => {
    it('should create event with valid data', async () => {
      const eventData = {
        name: 'Ceremony',
        description: 'Wedding ceremony',
        startTime: '2024-06-15T14:00:00Z',
        endTime: '2024-06-15T15:30:00Z',
        color: '#3B82F6',
        order: 0,
      };

      const mockCreatedEvent = {
        id: 'evt_1',
        ...eventData,
        startTime: new Date(eventData.startTime),
        endTime: new Date(eventData.endTime),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.event.findMany.mockResolvedValue([]); // No overlapping events
      prismaMock.event.create.mockResolvedValue(mockCreatedEvent);

      const result = await eventService.createEvent(eventData);

      expect(result.name).toBe('Ceremony');
      expect(result.id).toBe('evt_1');
    });

    it('should use default color if not provided', async () => {
      const eventData = {
        name: 'Reception',
        startTime: '2024-06-15T18:00:00Z',
        endTime: '2024-06-15T23:00:00Z',
      };

      prismaMock.event.findMany.mockResolvedValue([]);
      prismaMock.event.create.mockResolvedValue({
        id: 'evt_2',
        name: 'Reception',
        color: '#3B82F6',
        startTime: new Date(eventData.startTime),
        endTime: new Date(eventData.endTime),
      });

      const result = await eventService.createEvent(eventData);

      expect(result.color).toBe('#3B82F6');
    });

    it('should throw ValidationError if name is missing', async () => {
      const eventData = {
        startTime: '2024-06-15T14:00:00Z',
        endTime: '2024-06-15T15:30:00Z',
      };

      await expect(eventService.createEvent(eventData)).rejects.toThrow(ValidationError);
      await expect(eventService.createEvent(eventData)).rejects.toThrow(
        'Event name, startTime, and endTime are required'
      );
    });

    it('should throw ValidationError if startTime is missing', async () => {
      const eventData = {
        name: 'Ceremony',
        endTime: '2024-06-15T15:30:00Z',
      };

      await expect(eventService.createEvent(eventData)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if endTime is missing', async () => {
      const eventData = {
        name: 'Ceremony',
        startTime: '2024-06-15T14:00:00Z',
      };

      await expect(eventService.createEvent(eventData)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if date format is invalid', async () => {
      const eventData = {
        name: 'Ceremony',
        startTime: 'invalid-date',
        endTime: '2024-06-15T15:30:00Z',
      };

      await expect(eventService.createEvent(eventData)).rejects.toThrow(ValidationError);
      await expect(eventService.createEvent(eventData)).rejects.toThrow(
        'Invalid date format'
      );
    });

    it('should throw ValidationError if endTime is before startTime', async () => {
      const eventData = {
        name: 'Ceremony',
        startTime: '2024-06-15T15:30:00Z',
        endTime: '2024-06-15T14:00:00Z',
      };

      await expect(eventService.createEvent(eventData)).rejects.toThrow(ValidationError);
      await expect(eventService.createEvent(eventData)).rejects.toThrow(
        'endTime must be after startTime'
      );
    });

    it('should warn but allow overlapping events', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const eventData = {
        name: 'Overlapping Event',
        startTime: '2024-06-15T14:30:00Z',
        endTime: '2024-06-15T15:00:00Z',
      };

      const mockOverlappingEvent = {
        id: 'evt_existing',
        name: 'Existing Event',
        startTime: new Date('2024-06-15T14:00:00Z'),
        endTime: new Date('2024-06-15T15:30:00Z'),
      };

      prismaMock.event.findMany.mockResolvedValue([mockOverlappingEvent]);
      prismaMock.event.create.mockResolvedValue({
        id: 'evt_new',
        ...eventData,
        startTime: new Date(eventData.startTime),
        endTime: new Date(eventData.endTime),
      });

      await eventService.createEvent(eventData);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('overlaps with 1 existing event')
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('updateEvent()', () => {
    it('should update event with valid data', async () => {
      const mockEvent = {
        id: 'evt_1',
        name: 'Ceremony',
        startTime: new Date('2024-06-15T14:00:00Z'),
        endTime: new Date('2024-06-15T15:30:00Z'),
      };

      const updates = {
        name: 'Updated Ceremony',
        description: 'Updated description',
      };

      prismaMock.event.findUnique.mockResolvedValue(mockEvent);
      prismaMock.event.update.mockResolvedValue({
        ...mockEvent,
        ...updates,
      });

      const result = await eventService.updateEvent('evt_1', updates);

      expect(result.name).toBe('Updated Ceremony');
      expect(result.description).toBe('Updated description');
    });

    it('should throw NotFoundError if event does not exist', async () => {
      prismaMock.event.findUnique.mockResolvedValue(null);

      await expect(eventService.updateEvent('nonexistent', { name: 'Test' })).rejects.toThrow(
        NotFoundError
      );
    });

    it('should validate time range when updating times', async () => {
      const mockEvent = {
        id: 'evt_1',
        name: 'Ceremony',
        startTime: new Date('2024-06-15T14:00:00Z'),
        endTime: new Date('2024-06-15T15:30:00Z'),
      };

      prismaMock.event.findUnique.mockResolvedValue(mockEvent);

      const updates = {
        startTime: '2024-06-15T16:00:00Z',
        endTime: '2024-06-15T15:00:00Z', // Before start
      };

      await expect(eventService.updateEvent('evt_1', updates)).rejects.toThrow(ValidationError);
    });
  });

  describe('deleteEvent()', () => {
    it('should delete event and unassign photos', async () => {
      const mockEvent = {
        id: 'evt_1',
        name: 'Ceremony',
      };

      const mockPhotos = [
        { id: 1, eventId: 'evt_1' },
        { id: 2, eventId: 'evt_1' },
      ];

      prismaMock.event.findUnique.mockResolvedValue(mockEvent);
      prismaMock.photo.findMany.mockResolvedValue(mockPhotos);
      prismaMock.photo.updateMany.mockResolvedValue({ count: 2 });
      prismaMock.event.delete.mockResolvedValue(mockEvent);

      const result = await eventService.deleteEvent('evt_1');

      expect(prismaMock.photo.updateMany).toHaveBeenCalled();
      expect(prismaMock.event.delete).toHaveBeenCalledWith({ where: { id: 'evt_1' } });
      expect(result.id).toBe('evt_1');
    });

    it('should throw NotFoundError if event does not exist', async () => {
      prismaMock.event.findUnique.mockResolvedValue(null);

      await expect(eventService.deleteEvent('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should delete event even if no photos assigned', async () => {
      const mockEvent = {
        id: 'evt_1',
        name: 'Ceremony',
      };

      prismaMock.event.findUnique.mockResolvedValue(mockEvent);
      prismaMock.photo.findMany.mockResolvedValue([]);
      prismaMock.event.delete.mockResolvedValue(mockEvent);

      const result = await eventService.deleteEvent('evt_1');

      expect(result.id).toBe('evt_1');
    });
  });

  describe('autoDetectEventGaps()', () => {
    it('should detect single event when no gaps', async () => {
      const mockPhotos = [
        {
          id: 1,
          capturedAt: new Date('2024-06-15T14:00:00Z'),
          deviceMake: 'Apple',
          deviceModel: 'iPhone 13',
        },
        {
          id: 2,
          capturedAt: new Date('2024-06-15T14:30:00Z'),
          deviceMake: 'Apple',
          deviceModel: 'iPhone 13',
        },
        {
          id: 3,
          capturedAt: new Date('2024-06-15T15:00:00Z'),
          deviceMake: 'Samsung',
          deviceModel: 'Galaxy S21',
        },
      ];

      prismaMock.photo.findMany.mockResolvedValue(mockPhotos);

      const result = await eventService.autoDetectEventGaps(2);

      expect(result).toHaveLength(1);
      expect(result[0].photoCount).toBe(3);
      expect(result[0].devices).toHaveLength(2);
    });

    it('should detect multiple events with gaps', async () => {
      const mockPhotos = [
        { id: 1, capturedAt: new Date('2024-06-15T14:00:00Z'), deviceModel: 'iPhone 13' },
        { id: 2, capturedAt: new Date('2024-06-15T14:30:00Z'), deviceModel: 'iPhone 13' },
        // 3-hour gap
        { id: 3, capturedAt: new Date('2024-06-15T17:30:00Z'), deviceModel: 'Galaxy S21' },
        { id: 4, capturedAt: new Date('2024-06-15T18:00:00Z'), deviceModel: 'Galaxy S21' },
      ];

      prismaMock.photo.findMany.mockResolvedValue(mockPhotos);

      const result = await eventService.autoDetectEventGaps(2);

      expect(result).toHaveLength(2);
      expect(result[0].photoCount).toBe(2);
      expect(result[1].photoCount).toBe(2);
      expect(result[0].startTime).toEqual(new Date('2024-06-15T14:00:00Z'));
      expect(result[1].startTime).toEqual(new Date('2024-06-15T17:30:00Z'));
    });

    it('should return empty array if no photos', async () => {
      prismaMock.photo.findMany.mockResolvedValue([]);

      const result = await eventService.autoDetectEventGaps(2);

      expect(result).toEqual([]);
    });

    it('should use custom gap threshold', async () => {
      const mockPhotos = [
        { id: 1, capturedAt: new Date('2024-06-15T14:00:00Z'), deviceModel: 'iPhone 13' },
        { id: 2, capturedAt: new Date('2024-06-15T14:20:00Z'), deviceModel: 'iPhone 13' },
        // 45-minute gap (should split with 0.5hr threshold, not with 1hr)
        { id: 3, capturedAt: new Date('2024-06-15T15:05:00Z'), deviceModel: 'Galaxy S21' },
      ];

      prismaMock.photo.findMany.mockResolvedValue(mockPhotos);

      const resultWith30Min = await eventService.autoDetectEventGaps(0.5);
      expect(resultWith30Min).toHaveLength(2); // Split detected

      const resultWith1Hr = await eventService.autoDetectEventGaps(1);
      expect(resultWith1Hr).toHaveLength(1); // No split
    });

    it('should generate different colors for each event', async () => {
      const mockPhotos = [
        { id: 1, capturedAt: new Date('2024-06-15T10:00:00Z') },
        { id: 2, capturedAt: new Date('2024-06-15T14:00:00Z') }, // 4hr gap
        { id: 3, capturedAt: new Date('2024-06-15T18:00:00Z') }, // 4hr gap
      ];

      prismaMock.photo.findMany.mockResolvedValue(mockPhotos);

      const result = await eventService.autoDetectEventGaps(2);

      expect(result).toHaveLength(3);
      expect(result[0].suggestedColor).toBeDefined();
      expect(result[1].suggestedColor).toBeDefined();
      expect(result[2].suggestedColor).toBeDefined();
      // Colors should be different
      expect(result[0].suggestedColor).not.toBe(result[1].suggestedColor);
    });
  });

  describe('assignPhotosToEvent()', () => {
    it('should assign photos to event', async () => {
      const mockEvent = { id: 'evt_1', name: 'Ceremony' };

      prismaMock.event.findUnique.mockResolvedValue(mockEvent);
      prismaMock.photo.updateMany.mockResolvedValue({ count: 5 });

      const result = await eventService.assignPhotosToEvent('evt_1', [1, 2, 3, 4, 5]);

      expect(prismaMock.photo.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2, 3, 4, 5] } },
        data: { eventId: 'evt_1' },
      });

      expect(result.count).toBe(5);
    });

    it('should throw NotFoundError if event does not exist', async () => {
      prismaMock.event.findUnique.mockResolvedValue(null);

      await expect(eventService.assignPhotosToEvent('nonexistent', [1, 2])).rejects.toThrow(
        NotFoundError
      );
    });

    it('should allow unassigning photos (eventId = null)', async () => {
      prismaMock.photo.updateMany.mockResolvedValue({ count: 3 });

      const result = await eventService.assignPhotosToEvent(null, [1, 2, 3]);

      expect(prismaMock.photo.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2, 3] } },
        data: { eventId: null },
      });

      expect(result.count).toBe(3);
    });

    it('should throw ValidationError if photoIds is empty', async () => {
      await expect(eventService.assignPhotosToEvent('evt_1', [])).rejects.toThrow(
        ValidationError
      );
    });

    it('should throw ValidationError if photoIds is not an array', async () => {
      await expect(eventService.assignPhotosToEvent('evt_1', 'not-array')).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('getEventTimeline()', () => {
    it('should return events with photo counts and device breakdown', async () => {
      const mockEvents = [
        {
          id: 'evt_1',
          name: 'Ceremony',
          _count: { photos: 2 },
          photoCount: 2,
        },
      ];

      const mockPhotos = [
        { id: 1, eventId: 'evt_1', deviceMake: 'Apple', deviceModel: 'iPhone 13' },
        { id: 2, eventId: 'evt_1', deviceMake: 'Samsung', deviceModel: 'Galaxy S21' },
      ];

      prismaMock.event.findMany.mockResolvedValue(mockEvents);
      prismaMock.photo.findMany.mockResolvedValue(mockPhotos);

      const result = await eventService.getEventTimeline();

      expect(result).toHaveLength(1);
      expect(result[0].photoCount).toBe(2);
      expect(result[0].devices).toHaveLength(2);
      expect(result[0].devices[0].model).toBe('Apple iPhone 13');
      expect(result[0].devices[0].count).toBe(1);
    });
  });

  describe('getUnassignedPhotos()', () => {
    it('should return photos without eventId', async () => {
      const mockPhotos = [
        { id: 1, eventId: null },
        { id: 2, eventId: null },
      ];

      prismaMock.photo.findMany.mockResolvedValue(mockPhotos);

      const result = await eventService.getUnassignedPhotos();

      expect(result).toHaveLength(2);
    });
  });
});
