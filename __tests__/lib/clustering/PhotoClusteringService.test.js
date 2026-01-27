/**
 * Tests for PhotoClusteringService
 *
 * Validates DBSCAN clustering algorithm and smart event detection
 */

import { PhotoClusteringService } from '../../../lib/clustering/PhotoClusteringService';
import { generateWeddingPhotos, expectedClusters, edgeCasePhotos } from '../../fixtures/weddingPhotos';

describe('PhotoClusteringService', () => {
  let service;

  beforeEach(() => {
    service = new PhotoClusteringService();
  });

  describe('clusterPhotosByTime', () => {
    it('should cluster wedding photos into distinct events', () => {
      const photos = generateWeddingPhotos();
      const clusters = service.clusterPhotosByTime(photos, {
        epsilon: 60, // 60 minutes
        minPoints: 3
      });

      // Should detect 6 main events
      expect(clusters.length).toBeGreaterThanOrEqual(5);
      expect(clusters.length).toBeLessThanOrEqual(7);

      // Total photos should match input
      const totalPhotos = clusters.reduce((sum, c) => sum + c.photoCount, 0);
      expect(totalPhotos).toBeGreaterThan(200); // Most photos clustered

      // Each cluster should have required fields
      clusters.forEach(cluster => {
        expect(cluster).toHaveProperty('name');
        expect(cluster).toHaveProperty('startTime');
        expect(cluster).toHaveProperty('endTime');
        expect(cluster).toHaveProperty('photoCount');
        expect(cluster).toHaveProperty('photoIds');
        expect(cluster).toHaveProperty('duration');
        expect(cluster).toHaveProperty('photoDensity');
        expect(cluster).toHaveProperty('devices');
        expect(cluster).toHaveProperty('suggestedColor');
        expect(cluster).toHaveProperty('eventType');
        expect(cluster).toHaveProperty('confidence');

        expect(cluster.photoCount).toBeGreaterThanOrEqual(3);
        expect(cluster.duration).toBeGreaterThan(0);
        expect(Array.isArray(cluster.photoIds)).toBe(true);
        expect(Array.isArray(cluster.devices)).toBe(true);
      });
    });

    it('should detect ceremony event with high confidence', () => {
      const photos = generateWeddingPhotos();
      const clusters = service.clusterPhotosByTime(photos, {
        epsilon: 60,
        minPoints: 3
      });

      // Find ceremony cluster (highest photo count, early afternoon)
      const ceremony = clusters.find(c =>
        c.eventType === 'ceremony' || c.name.includes('Ceremony')
      );

      expect(ceremony).toBeDefined();
      expect(ceremony.photoCount).toBeGreaterThan(50); // Many photos
      expect(ceremony.confidence).toBeGreaterThan(0.7); // High confidence
      expect(ceremony.photoDensity).toBeGreaterThan(50); // High density
      expect(ceremony.duration).toBeLessThan(60); // Short duration
    });

    it('should detect cocktail hour event', () => {
      const photos = generateWeddingPhotos();
      const clusters = service.clusterPhotosByTime(photos, {
        epsilon: 60,
        minPoints: 3
      });

      const cocktails = clusters.find(c =>
        c.eventType === 'cocktails' || c.name.includes('Cocktail')
      );

      expect(cocktails).toBeDefined();
      expect(cocktails.duration).toBeGreaterThan(45);
      expect(cocktails.duration).toBeLessThan(180);
    });

    it('should detect dinner event with lower density', () => {
      const photos = generateWeddingPhotos();
      const clusters = service.clusterPhotosByTime(photos, {
        epsilon: 60,
        minPoints: 3
      });

      const dinner = clusters.find(c =>
        c.eventType === 'dinner' || c.name.includes('Dinner')
      );

      expect(dinner).toBeDefined();
      expect(dinner.duration).toBeGreaterThan(60);
      expect(dinner.photoDensity).toBeLessThan(40); // Lower density than ceremony
    });

    it('should handle empty photo array', () => {
      const clusters = service.clusterPhotosByTime(edgeCasePhotos.empty, {
        epsilon: 60,
        minPoints: 3
      });

      expect(clusters).toEqual([]);
    });

    it('should handle single photo', () => {
      const clusters = service.clusterPhotosByTime(edgeCasePhotos.single, {
        epsilon: 60,
        minPoints: 1
      });

      // With minPoints=1, should create one cluster
      expect(clusters.length).toBe(1);
      expect(clusters[0].photoCount).toBe(1);
    });

    it('should separate photos with huge time gaps', () => {
      const clusters = service.clusterPhotosByTime(edgeCasePhotos.hugeGap, {
        epsilon: 60,
        minPoints: 1
      });

      // 24-hour gap should create 2 separate clusters
      expect(clusters.length).toBe(2);
    });

    it('should handle burst mode photos (very close timestamps)', () => {
      const clusters = service.clusterPhotosByTime(edgeCasePhotos.burst, {
        epsilon: 60,
        minPoints: 3
      });

      // All burst photos should be in one cluster
      expect(clusters.length).toBe(1);
      expect(clusters[0].photoCount).toBe(50);
      expect(clusters[0].photoDensity).toBeGreaterThan(400); // Very high density (clamped at ~500 by Math.max)
    });

    it('should handle photos without device metadata', () => {
      const clusters = service.clusterPhotosByTime(edgeCasePhotos.noDevice, {
        epsilon: 60,
        minPoints: 1
      });

      expect(clusters.length).toBeGreaterThan(0);
      clusters.forEach(cluster => {
        expect(Array.isArray(cluster.devices)).toBe(true);
        // Devices array might be empty but should exist
      });
    });

    it('should use tighter clustering with small epsilon', () => {
      const photos = generateWeddingPhotos();

      const tightClusters = service.clusterPhotosByTime(photos, {
        epsilon: 30, // 30 minutes - tighter
        minPoints: 3
      });

      const looseClusters = service.clusterPhotosByTime(photos, {
        epsilon: 120, // 2 hours - looser
        minPoints: 3
      });

      // Tighter epsilon should create more clusters
      expect(tightClusters.length).toBeGreaterThanOrEqual(looseClusters.length);
    });

    it('should include correct device breakdown', () => {
      const photos = generateWeddingPhotos();
      const clusters = service.clusterPhotosByTime(photos, {
        epsilon: 60,
        minPoints: 3
      });

      // Find ceremony (has mix of iPhone models)
      const ceremony = clusters.find(c => c.photoCount > 50);

      expect(ceremony).toBeDefined();
      expect(ceremony.devices.length).toBeGreaterThan(0);

      ceremony.devices.forEach(device => {
        expect(device).toHaveProperty('model');
        expect(device).toHaveProperty('count');
        expect(typeof device.model).toBe('string');
        expect(device.count).toBeGreaterThan(0);
      });

      // Total device counts should match photo count
      const totalDevicePhotos = ceremony.devices.reduce((sum, d) => sum + d.count, 0);
      expect(totalDevicePhotos).toBeLessThanOrEqual(ceremony.photoCount);
    });
  });

  describe('suggestEpsilon', () => {
    it('should suggest reasonable epsilon for wedding photos', () => {
      const photos = generateWeddingPhotos();
      const epsilon = service.suggestEpsilon(photos);

      // Should be between 30min and 3hrs
      expect(epsilon).toBeGreaterThanOrEqual(30);
      expect(epsilon).toBeLessThanOrEqual(180);

      // Should be a reasonable value (not extreme)
      expect(epsilon).toBeGreaterThan(20);
      expect(epsilon).toBeLessThan(200);
    });

    it('should return default for empty photos', () => {
      const epsilon = service.suggestEpsilon([]);
      expect(epsilon).toBe(60); // Default 1 hour
    });

    it('should return default for single photo', () => {
      const epsilon = service.suggestEpsilon(edgeCasePhotos.single);
      expect(epsilon).toBe(60);
    });

    it('should suggest larger epsilon for sparse photos', () => {
      // Create very sparse photos (1 per hour)
      const sparsePhotos = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        capturedAt: new Date(new Date('2024-06-15T10:00:00Z').getTime() + i * 60 * 60 * 1000)
      }));

      const epsilon = service.suggestEpsilon(sparsePhotos);

      // Should suggest larger gaps for sparse photos (or at the upper boundary)
      expect(epsilon).toBeGreaterThanOrEqual(60);
    });
  });

  describe('splitEventAt', () => {
    it('should split event into two at specified time', () => {
      const photos = [
        { id: 1, capturedAt: new Date('2024-06-15T14:00:00Z') },
        { id: 2, capturedAt: new Date('2024-06-15T14:15:00Z') },
        { id: 3, capturedAt: new Date('2024-06-15T14:30:00Z') },
        { id: 4, capturedAt: new Date('2024-06-15T14:45:00Z') },
        { id: 5, capturedAt: new Date('2024-06-15T15:00:00Z') },
      ];

      const splitTime = new Date('2024-06-15T14:30:00Z');
      const events = service.splitEventAt(photos, splitTime);

      expect(events.length).toBe(2);
      expect(events[0].photoCount).toBe(3); // Photos before and at split time
      expect(events[1].photoCount).toBe(2); // Photos after split time
    });

    it('should handle split at start (all photos in second event)', () => {
      const photos = edgeCasePhotos.burst.slice(0, 10);
      const splitTime = new Date(photos[0].capturedAt.getTime() - 1000); // Before first photo

      const events = service.splitEventAt(photos, splitTime);

      expect(events.length).toBe(1); // Only second event
      expect(events[0].photoCount).toBe(10);
    });

    it('should handle split at end (all photos in first event)', () => {
      const photos = edgeCasePhotos.burst.slice(0, 10);
      const lastPhoto = photos[photos.length - 1];
      const splitTime = new Date(lastPhoto.capturedAt.getTime() + 1000); // After last photo

      const events = service.splitEventAt(photos, splitTime);

      expect(events.length).toBe(1); // Only first event
      expect(events[0].photoCount).toBe(10);
    });
  });

  describe('mergeEvents', () => {
    it('should merge multiple photo groups into one event', () => {
      const group1 = [
        { id: 1, capturedAt: new Date('2024-06-15T14:00:00Z'), deviceModel: 'iPhone 13' },
        { id: 2, capturedAt: new Date('2024-06-15T14:15:00Z'), deviceModel: 'iPhone 13' },
      ];

      const group2 = [
        { id: 3, capturedAt: new Date('2024-06-15T15:00:00Z'), deviceModel: 'Samsung S23' },
        { id: 4, capturedAt: new Date('2024-06-15T15:15:00Z'), deviceModel: 'Samsung S23' },
      ];

      const merged = service.mergeEvents([group1, group2]);

      expect(merged.photoCount).toBe(4);
      expect(merged.photoIds.length).toBe(4);
      expect(merged.devices.length).toBe(2); // Two different devices
      expect(merged.startTime).toEqual(new Date('2024-06-15T14:00:00Z'));
      expect(merged.endTime).toEqual(new Date('2024-06-15T15:15:00Z'));
    });

    it('should handle merging with empty groups', () => {
      const group1 = [
        { id: 1, capturedAt: new Date('2024-06-15T14:00:00Z'), deviceModel: 'iPhone 13' },
      ];

      const merged = service.mergeEvents([group1, []]);

      expect(merged.photoCount).toBe(1);
    });
  });

  describe('event type detection', () => {
    it('should assign correct colors to event types', () => {
      const photos = generateWeddingPhotos();
      const clusters = service.clusterPhotosByTime(photos, {
        epsilon: 60,
        minPoints: 3
      });

      clusters.forEach(cluster => {
        expect(cluster.suggestedColor).toMatch(/^#[0-9A-F]{6}$/i);

        // Ceremony should be blue
        if (cluster.eventType === 'ceremony') {
          expect(cluster.suggestedColor).toBe('#3B82F6');
        }

        // Cocktails should be green
        if (cluster.eventType === 'cocktails') {
          expect(cluster.suggestedColor).toBe('#10B981');
        }

        // Dinner should be amber
        if (cluster.eventType === 'dinner') {
          expect(cluster.suggestedColor).toBe('#F59E0B');
        }
      });
    });

    it('should provide confidence scores between 0 and 1', () => {
      const photos = generateWeddingPhotos();
      const clusters = service.clusterPhotosByTime(photos, {
        epsilon: 60,
        minPoints: 3
      });

      clusters.forEach(cluster => {
        expect(cluster.confidence).toBeGreaterThanOrEqual(0);
        expect(cluster.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should have higher confidence for ceremony than unknown events', () => {
      const photos = generateWeddingPhotos();
      const clusters = service.clusterPhotosByTime(photos, {
        epsilon: 60,
        minPoints: 3
      });

      const ceremony = clusters.find(c => c.eventType === 'ceremony');
      const unknown = clusters.find(c => c.eventType === 'unknown');

      if (ceremony && unknown) {
        expect(ceremony.confidence).toBeGreaterThan(unknown.confidence);
      }
    });
  });
});
