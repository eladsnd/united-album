/**
 * EventRepository Tests
 *
 * Tests for event data access layer including:
 * - CRUD operations (create, findAll, findById, update, delete)
 * - Date range queries (findOverlapping, findByDateRange)
 * - Photo count aggregation
 * - Error handling and edge cases
 */

import { prismaMock } from '../prismaMock.js';

// Mock Prisma client BEFORE importing repository
jest.mock('../../lib/prisma.js', () => ({
  __esModule: true,
  default: require('../prismaMock.js').prismaMock,
}));

import { EventRepository } from '../../lib/repositories/EventRepository.js';

describe('EventRepository', () => {
  let eventRepo;

  beforeEach(() => {
    eventRepo = new EventRepository();
    jest.clearAllMocks();
  });

  describe('getModel()', () => {
    it('should return "event" as model name', () => {
      expect(eventRepo.getModel()).toBe('event');
    });
  });

  describe('findAll()', () => {
    it('should return all events ordered by startTime and order', async () => {
      const mockEvents = [
        {
          id: 'evt_1',
          name: 'Ceremony',
          description: 'Wedding ceremony',
          startTime: new Date('2024-06-15T14:00:00Z'),
          endTime: new Date('2024-06-15T15:30:00Z'),
          color: '#3B82F6',
          order: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'evt_2',
          name: 'Reception',
          description: 'Wedding reception',
          startTime: new Date('2024-06-15T18:00:00Z'),
          endTime: new Date('2024-06-15T23:00:00Z'),
          color: '#10B981',
          order: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prismaMock.event.findMany.mockResolvedValue(mockEvents);

      const result = await eventRepo.findAll();

      expect(prismaMock.event.findMany).toHaveBeenCalledWith({
        orderBy: [
          { startTime: 'asc' },
          { order: 'asc' }
        ],
      });

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Ceremony');
      expect(result[1].name).toBe('Reception');
    });

    it('should return empty array when no events exist', async () => {
      prismaMock.event.findMany.mockResolvedValue([]);

      const result = await eventRepo.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findAllWithPhotoCounts()', () => {
    it('should return events with photo counts', async () => {
      const mockEventsWithCounts = [
        {
          id: 'evt_1',
          name: 'Ceremony',
          startTime: new Date('2024-06-15T14:00:00Z'),
          endTime: new Date('2024-06-15T15:30:00Z'),
          color: '#3B82F6',
          order: 0,
          _count: { photos: 45 },
        },
        {
          id: 'evt_2',
          name: 'Reception',
          startTime: new Date('2024-06-15T18:00:00Z'),
          endTime: new Date('2024-06-15T23:00:00Z'),
          color: '#10B981',
          order: 1,
          _count: { photos: 120 },
        },
      ];

      prismaMock.event.findMany.mockResolvedValue(mockEventsWithCounts);

      const result = await eventRepo.findAllWithPhotoCounts();

      expect(result).toHaveLength(2);
      expect(result[0].photoCount).toBe(45);
      expect(result[1].photoCount).toBe(120);
    });
  });

  describe('findById()', () => {
    it('should find event by id', async () => {
      const mockEvent = {
        id: 'evt_1',
        name: 'Ceremony',
        description: 'Wedding ceremony',
        startTime: new Date('2024-06-15T14:00:00Z'),
        endTime: new Date('2024-06-15T15:30:00Z'),
        color: '#3B82F6',
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.event.findUnique.mockResolvedValue(mockEvent);

      const result = await eventRepo.findById('evt_1');

      expect(prismaMock.event.findUnique).toHaveBeenCalledWith({
        where: { id: 'evt_1' },
      });

      expect(result.id).toBe('evt_1');
      expect(result.name).toBe('Ceremony');
    });

    it('should return null if event not found', async () => {
      prismaMock.event.findUnique.mockResolvedValue(null);

      const result = await eventRepo.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findOverlapping()', () => {
    it('should find events that overlap with time range', async () => {
      const startTime = new Date('2024-06-15T14:00:00Z');
      const endTime = new Date('2024-06-15T16:00:00Z');

      const mockOverlappingEvents = [
        {
          id: 'evt_1',
          name: 'Ceremony',
          startTime: new Date('2024-06-15T14:00:00Z'),
          endTime: new Date('2024-06-15T15:30:00Z'),
          color: '#3B82F6',
          order: 0,
        },
      ];

      prismaMock.event.findMany.mockResolvedValue(mockOverlappingEvents);

      const result = await eventRepo.findOverlapping(startTime, endTime);

      expect(prismaMock.event.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            {
              startTime: {
                gte: new Date(startTime),
                lte: new Date(endTime)
              }
            },
            {
              endTime: {
                gte: new Date(startTime),
                lte: new Date(endTime)
              }
            },
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

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Ceremony');
    });

    it('should accept string dates and convert to Date objects', async () => {
      prismaMock.event.findMany.mockResolvedValue([]);

      await eventRepo.findOverlapping('2024-06-15T14:00:00Z', '2024-06-15T16:00:00Z');

      const call = prismaMock.event.findMany.mock.calls[0][0];
      expect(call.where.OR[0].startTime.gte).toBeInstanceOf(Date);
      expect(call.where.OR[0].startTime.lte).toBeInstanceOf(Date);
    });

    it('should return empty array if no overlaps', async () => {
      prismaMock.event.findMany.mockResolvedValue([]);

      const result = await eventRepo.findOverlapping(
        new Date('2024-06-16T00:00:00Z'),
        new Date('2024-06-16T12:00:00Z')
      );

      expect(result).toEqual([]);
    });
  });

  describe('findByDateRange()', () => {
    it('should find events within date range', async () => {
      const start = new Date('2024-06-15T00:00:00Z');
      const end = new Date('2024-06-15T23:59:59Z');

      const mockEvents = [
        {
          id: 'evt_1',
          name: 'Ceremony',
          startTime: new Date('2024-06-15T14:00:00Z'),
          endTime: new Date('2024-06-15T15:30:00Z'),
        },
      ];

      prismaMock.event.findMany.mockResolvedValue(mockEvents);

      const result = await eventRepo.findByDateRange(start, end);

      expect(prismaMock.event.findMany).toHaveBeenCalledWith({
        where: {
          startTime: {
            gte: new Date(start),
            lte: new Date(end)
          }
        },
        orderBy: { startTime: 'asc' }
      });

      expect(result).toHaveLength(1);
    });
  });

  describe('deleteById()', () => {
    it('should delete event by id', async () => {
      const mockEvent = {
        id: 'evt_1',
        name: 'Ceremony',
        startTime: new Date(),
        endTime: new Date(),
      };

      prismaMock.event.delete.mockResolvedValue(mockEvent);

      const result = await eventRepo.deleteById('evt_1');

      expect(prismaMock.event.delete).toHaveBeenCalledWith({
        where: { id: 'evt_1' },
      });

      expect(result.id).toBe('evt_1');
    });
  });

  describe('exists()', () => {
    it('should return true if event exists', async () => {
      prismaMock.event.findUnique.mockResolvedValue({
        id: 'evt_1',
        name: 'Ceremony',
      });

      const result = await eventRepo.exists('evt_1');

      expect(result).toBe(true);
    });

    it('should return false if event does not exist', async () => {
      prismaMock.event.findUnique.mockResolvedValue(null);

      const result = await eventRepo.exists('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('updateOrder()', () => {
    it('should update event order', async () => {
      const mockEvent = {
        id: 'evt_1',
        name: 'Ceremony',
        order: 5,
      };

      prismaMock.event.update.mockResolvedValue(mockEvent);

      const result = await eventRepo.updateOrder('evt_1', 5);

      expect(prismaMock.event.update).toHaveBeenCalledWith({
        where: { id: 'evt_1' },
        data: { order: 5 },
      });

      expect(result.order).toBe(5);
    });
  });
});
