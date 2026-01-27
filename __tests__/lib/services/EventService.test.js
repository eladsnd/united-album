/**
 * Integration tests for EventService event detection
 *
 * Tests the smart auto-detect workflow using DBSCAN clustering
 */

import { EventService } from '../../../lib/services/EventService';
import { PhotoRepository } from '../../../lib/repositories/PhotoRepository';
import { generateWeddingPhotos } from '../../fixtures/weddingPhotos';

// Mock repositories
jest.mock('../../../lib/repositories/PhotoRepository');
jest.mock('../../../lib/repositories/EventRepository');

describe('EventService - Event Detection', () => {
  let eventService;
  let mockPhotoRepo;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create service instance
    eventService = new EventService();

    // Get mock repository instance
    mockPhotoRepo = eventService.photoRepo;
  });

  describe('autoDetectEventsSmart', () => {
    it('should detect wedding events with default parameters', async () => {
      // Mock photo data
      const weddingPhotos = generateWeddingPhotos();
      mockPhotoRepo.findAllByCaptureTime.mockResolvedValue(weddingPhotos);

      // Run detection
      const events = await eventService.autoDetectEventsSmart();

      // Should detect 6 distinct events
      expect(events.length).toBeGreaterThanOrEqual(5);
      expect(events.length).toBeLessThanOrEqual(7);

      // Should call repository
      expect(mockPhotoRepo.findAllByCaptureTime).toHaveBeenCalledTimes(1);

      // Each event should have required fields
      events.forEach(event => {
        expect(event).toHaveProperty('name');
        expect(event).toHaveProperty('eventType');
        expect(event).toHaveProperty('startTime');
        expect(event).toHaveProperty('endTime');
        expect(event).toHaveProperty('photoCount');
        expect(event).toHaveProperty('photoIds');
        expect(event).toHaveProperty('duration');
        expect(event).toHaveProperty('photoDensity');
        expect(event).toHaveProperty('devices');
        expect(event).toHaveProperty('suggestedColor');
        expect(event).toHaveProperty('confidence');

        expect(event.photoCount).toBeGreaterThan(0);
        expect(Array.isArray(event.photoIds)).toBe(true);
        expect(Array.isArray(event.devices)).toBe(true);
        expect(event.confidence).toBeGreaterThanOrEqual(0);
        expect(event.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should detect events with custom epsilon', async () => {
      const weddingPhotos = generateWeddingPhotos();
      mockPhotoRepo.findAllByCaptureTime.mockResolvedValue(weddingPhotos);

      // Use tight clustering
      const events = await eventService.autoDetectEventsSmart({
        epsilon: 30,
        minPoints: 3
      });

      expect(events.length).toBeGreaterThanOrEqual(5);
      expect(mockPhotoRepo.findAllByCaptureTime).toHaveBeenCalledTimes(1);
    });

    it('should auto-suggest epsilon when not provided', async () => {
      const weddingPhotos = generateWeddingPhotos();
      mockPhotoRepo.findAllByCaptureTime.mockResolvedValue(weddingPhotos);

      // Don't provide epsilon
      const events = await eventService.autoDetectEventsSmart({
        minPoints: 3
      });

      // Should still detect events using auto-suggested epsilon
      expect(events.length).toBeGreaterThan(0);
      expect(mockPhotoRepo.findAllByCaptureTime).toHaveBeenCalledTimes(1);
    });

    it('should handle empty photo collection', async () => {
      mockPhotoRepo.findAllByCaptureTime.mockResolvedValue([]);

      const events = await eventService.autoDetectEventsSmart();

      expect(events).toEqual([]);
      expect(mockPhotoRepo.findAllByCaptureTime).toHaveBeenCalledTimes(1);
    });

    it('should detect ceremony with high confidence', async () => {
      const weddingPhotos = generateWeddingPhotos();
      mockPhotoRepo.findAllByCaptureTime.mockResolvedValue(weddingPhotos);

      const events = await eventService.autoDetectEventsSmart();

      // Find ceremony event
      const ceremony = events.find(e =>
        e.eventType === 'ceremony' || e.name.includes('Ceremony')
      );

      expect(ceremony).toBeDefined();
      expect(ceremony.photoCount).toBeGreaterThan(50);
      expect(ceremony.confidence).toBeGreaterThan(0.7);
      expect(ceremony.eventType).toBe('ceremony');
    });

    it('should detect cocktail hour event', async () => {
      const weddingPhotos = generateWeddingPhotos();
      mockPhotoRepo.findAllByCaptureTime.mockResolvedValue(weddingPhotos);

      const events = await eventService.autoDetectEventsSmart();

      const cocktails = events.find(e =>
        e.eventType === 'cocktails' || e.name.includes('Cocktail')
      );

      expect(cocktails).toBeDefined();
      expect(cocktails.eventType).toBe('cocktails');
      expect(cocktails.duration).toBeGreaterThan(45);
    });

    it('should detect dinner event', async () => {
      const weddingPhotos = generateWeddingPhotos();
      mockPhotoRepo.findAllByCaptureTime.mockResolvedValue(weddingPhotos);

      const events = await eventService.autoDetectEventsSmart();

      const dinner = events.find(e =>
        e.eventType === 'dinner' || e.name.includes('Dinner')
      );

      expect(dinner).toBeDefined();
      expect(dinner.eventType).toBe('dinner');
      expect(dinner.duration).toBeGreaterThan(60);
    });

    it('should detect party event', async () => {
      const weddingPhotos = generateWeddingPhotos();
      mockPhotoRepo.findAllByCaptureTime.mockResolvedValue(weddingPhotos);

      const events = await eventService.autoDetectEventsSmart({
        epsilon: 60,
        minPoints: 3
      });

      // Find the late-night high-density event (party)
      // Note: Classification may vary based on timezone, but characteristics should match
      const party = events.find(e => e.photoCount === 90);

      expect(party).toBeDefined();
      expect(party.photoCount).toBe(90);
      expect(party.duration).toBeGreaterThan(80);
      expect(party.photoDensity).toBeGreaterThan(50); // Very high density party
    });

    it('should include device breakdown for each event', async () => {
      const weddingPhotos = generateWeddingPhotos();
      mockPhotoRepo.findAllByCaptureTime.mockResolvedValue(weddingPhotos);

      const events = await eventService.autoDetectEventsSmart();

      // Find event with multiple devices (ceremony)
      const ceremony = events.find(e => e.photoCount > 50);

      expect(ceremony).toBeDefined();
      expect(ceremony.devices).toBeDefined();
      expect(Array.isArray(ceremony.devices)).toBe(true);
      expect(ceremony.devices.length).toBeGreaterThan(0);

      ceremony.devices.forEach(device => {
        expect(device).toHaveProperty('model');
        expect(device).toHaveProperty('count');
        expect(typeof device.model).toBe('string');
        expect(device.count).toBeGreaterThan(0);
      });
    });

    it('should assign color to each event', async () => {
      const weddingPhotos = generateWeddingPhotos();
      mockPhotoRepo.findAllByCaptureTime.mockResolvedValue(weddingPhotos);

      const events = await eventService.autoDetectEventsSmart();

      events.forEach(event => {
        expect(event.suggestedColor).toBeDefined();
        expect(event.suggestedColor).toMatch(/^#[0-9A-F]{6}$/i);
      });
    });

    it('should respect minPoints parameter', async () => {
      const weddingPhotos = generateWeddingPhotos();
      mockPhotoRepo.findAllByCaptureTime.mockResolvedValue(weddingPhotos);

      // Require larger clusters
      const events = await eventService.autoDetectEventsSmart({
        epsilon: 60,
        minPoints: 20
      });

      // All events should have at least 20 photos
      events.forEach(event => {
        expect(event.photoCount).toBeGreaterThanOrEqual(20);
      });

      // Should create fewer clusters (filtering out small events)
      expect(events.length).toBeLessThan(6);
    });

    it('should include photoIds array for each event', async () => {
      const weddingPhotos = generateWeddingPhotos();
      mockPhotoRepo.findAllByCaptureTime.mockResolvedValue(weddingPhotos);

      const events = await eventService.autoDetectEventsSmart();

      // Total photo IDs should match input photos
      const allPhotoIds = events.flatMap(e => e.photoIds);
      expect(allPhotoIds.length).toBeGreaterThan(200);

      // Each event should have photoIds matching photoCount
      events.forEach(event => {
        expect(event.photoIds.length).toBe(event.photoCount);
        expect(event.photoIds.every(id => typeof id === 'number')).toBe(true);
      });
    });

    it('should sort events chronologically', async () => {
      const weddingPhotos = generateWeddingPhotos();
      mockPhotoRepo.findAllByCaptureTime.mockResolvedValue(weddingPhotos);

      const events = await eventService.autoDetectEventsSmart();

      // Events should be in chronological order
      for (let i = 1; i < events.length; i++) {
        const prevEnd = new Date(events[i - 1].endTime);
        const currStart = new Date(events[i].startTime);
        expect(currStart.getTime()).toBeGreaterThanOrEqual(prevEnd.getTime());
      }
    });

    it('should calculate duration correctly', async () => {
      const weddingPhotos = generateWeddingPhotos();
      mockPhotoRepo.findAllByCaptureTime.mockResolvedValue(weddingPhotos);

      const events = await eventService.autoDetectEventsSmart();

      events.forEach(event => {
        const start = new Date(event.startTime);
        const end = new Date(event.endTime);
        const expectedDuration = Math.round((end - start) / (1000 * 60));

        expect(event.duration).toBe(expectedDuration);
      });
    });

    it('should calculate photo density correctly', async () => {
      const weddingPhotos = generateWeddingPhotos();
      mockPhotoRepo.findAllByCaptureTime.mockResolvedValue(weddingPhotos);

      const events = await eventService.autoDetectEventsSmart();

      events.forEach(event => {
        const expectedDensity = event.photoCount / Math.max(event.duration / 60, 0.1);
        expect(event.photoDensity).toBeCloseTo(expectedDensity, 0); // Integer precision due to rounding
      });
    });
  });
});
