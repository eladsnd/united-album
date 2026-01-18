/**
 * Database Tests: Photo Model
 *
 * Tests all CRUD operations for the Photo table using Prisma.
 * Uses SQLite in-memory database for fast, isolated tests.
 */

import prisma from '../../lib/prisma';

describe('Photo Database Operations', () => {
  // Clean up database before each test
  beforeEach(async () => {
    await prisma.photo.deleteMany();
  });

  // Close database connection after all tests
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('CREATE operations', () => {
    it('should create a photo with required fields', async () => {
      const photo = await prisma.photo.create({
        data: {
          name: 'test-photo.jpg',
          driveId: 'abc123',
          url: '/api/image/abc123',
        },
      });

      expect(photo.id).toBeDefined();
      expect(photo.name).toBe('test-photo.jpg');
      expect(photo.driveId).toBe('abc123');
      expect(photo.url).toBe('/api/image/abc123');
      expect(photo.mainFaceId).toBe('unknown'); // default value
      expect(photo.faceIds).toBe('[]'); // default JSON array as string
      expect(photo.faceBoxes).toBe('[]'); // default JSON array as string
      expect(photo.poseId).toBe('unknown_pose'); // default value
      expect(photo.uploaderId).toBeNull(); // nullable field
      expect(photo.timestamp).toBeInstanceOf(Date);
      expect(photo.createdAt).toBeInstanceOf(Date);
      expect(photo.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a photo with all optional fields', async () => {
      const photo = await prisma.photo.create({
        data: {
          name: 'wedding-photo.jpg',
          driveId: 'xyz789',
          url: '/api/image/xyz789',
          mainFaceId: 'person_1',
          faceIds: '["person_1", "person_2", "person_3"]',
          faceBoxes: '[{"x":100,"y":200,"width":50,"height":70}]',
          poseId: 'dip',
          uploaderId: 'uploader_123_abc',
          timestamp: new Date('2026-01-18T12:00:00Z'),
        },
      });

      expect(photo.driveId).toBe('xyz789');
      expect(photo.mainFaceId).toBe('person_1');
      expect(photo.faceIds).toBe('["person_1", "person_2", "person_3"]');
      expect(photo.faceBoxes).toBe('[{"x":100,"y":200,"width":50,"height":70}]');
      expect(photo.poseId).toBe('dip');
      expect(photo.uploaderId).toBe('uploader_123_abc');
      expect(photo.timestamp).toEqual(new Date('2026-01-18T12:00:00Z'));
    });

    it('should enforce unique driveId constraint', async () => {
      await prisma.photo.create({
        data: {
          name: 'photo1.jpg',
          driveId: 'duplicate123',
          url: '/api/image/duplicate123',
        },
      });

      // Attempting to create another photo with same driveId should fail
      await expect(
        prisma.photo.create({
          data: {
            name: 'photo2.jpg',
            driveId: 'duplicate123', // Same driveId
            url: '/api/image/duplicate123',
          },
        })
      ).rejects.toThrow();
    });

    it('should auto-increment photo IDs', async () => {
      const photo1 = await prisma.photo.create({
        data: {
          name: 'photo1.jpg',
          driveId: 'drive1',
          url: '/api/image/drive1',
        },
      });

      const photo2 = await prisma.photo.create({
        data: {
          name: 'photo2.jpg',
          driveId: 'drive2',
          url: '/api/image/drive2',
        },
      });

      expect(photo2.id).toBe(photo1.id + 1);
    });
  });

  describe('READ operations', () => {
    beforeEach(async () => {
      // Create test photos
      await prisma.photo.createMany({
        data: [
          {
            name: 'photo1.jpg',
            driveId: 'drive1',
            url: '/api/image/drive1',
            mainFaceId: 'person_1',
            faceIds: '["person_1", "person_2"]',
            poseId: 'dip',
            uploaderId: 'uploader_123',
          },
          {
            name: 'photo2.jpg',
            driveId: 'drive2',
            url: '/api/image/drive2',
            mainFaceId: 'person_2',
            faceIds: '["person_2", "person_3"]',
            poseId: 'back-to-back',
            uploaderId: 'uploader_123',
          },
          {
            name: 'photo3.jpg',
            driveId: 'drive3',
            url: '/api/image/drive3',
            mainFaceId: 'person_1',
            faceIds: '["person_1"]',
            poseId: 'dip',
            uploaderId: 'uploader_456',
          },
        ],
      });
    });

    it('should find photo by driveId', async () => {
      const photo = await prisma.photo.findUnique({
        where: { driveId: 'drive2' },
      });

      expect(photo).not.toBeNull();
      expect(photo.name).toBe('photo2.jpg');
      expect(photo.mainFaceId).toBe('person_2');
    });

    it('should return null for non-existent driveId', async () => {
      const photo = await prisma.photo.findUnique({
        where: { driveId: 'nonexistent' },
      });

      expect(photo).toBeNull();
    });

    it('should filter photos by mainFaceId', async () => {
      const photos = await prisma.photo.findMany({
        where: { mainFaceId: 'person_1' },
      });

      expect(photos).toHaveLength(2);
      expect(photos[0].driveId).toBe('drive1');
      expect(photos[1].driveId).toBe('drive3');
    });

    it('should filter photos by poseId', async () => {
      const photos = await prisma.photo.findMany({
        where: { poseId: 'dip' },
      });

      expect(photos).toHaveLength(2);
      expect(photos.every(p => p.poseId === 'dip')).toBe(true);
    });

    it('should filter photos by uploaderId', async () => {
      const photos = await prisma.photo.findMany({
        where: { uploaderId: 'uploader_123' },
      });

      expect(photos).toHaveLength(2);
      expect(photos.every(p => p.uploaderId === 'uploader_123')).toBe(true);
    });

    it('should retrieve all photos ordered by timestamp', async () => {
      const photos = await prisma.photo.findMany({
        orderBy: { timestamp: 'desc' },
      });

      expect(photos).toHaveLength(3);
      // Most recent first
      expect(photos[0].timestamp.getTime()).toBeGreaterThanOrEqual(
        photos[1].timestamp.getTime()
      );
    });

    it('should support complex filtering (mainFaceId + poseId)', async () => {
      const photos = await prisma.photo.findMany({
        where: {
          mainFaceId: 'person_1',
          poseId: 'dip',
        },
      });

      expect(photos).toHaveLength(2);
      expect(photos.every(p => p.mainFaceId === 'person_1' && p.poseId === 'dip')).toBe(true);
    });
  });

  describe('UPDATE operations', () => {
    let testPhoto;

    beforeEach(async () => {
      testPhoto = await prisma.photo.create({
        data: {
          name: 'test.jpg',
          driveId: 'test123',
          url: '/api/image/test123',
          mainFaceId: 'unknown',
          faceIds: '[]',
          faceBoxes: '[]',
        },
      });
    });

    it('should update mainFaceId', async () => {
      const updated = await prisma.photo.update({
        where: { id: testPhoto.id },
        data: { mainFaceId: 'person_5' },
      });

      expect(updated.mainFaceId).toBe('person_5');
      expect(updated.updatedAt.getTime()).toBeGreaterThan(testPhoto.updatedAt.getTime());
    });

    it('should update faceIds array', async () => {
      const updated = await prisma.photo.update({
        where: { driveId: 'test123' },
        data: { faceIds: '["person_1", "person_2", "person_3"]' },
      });

      expect(updated.faceIds).toBe('["person_1", "person_2", "person_3"]');
    });

    it('should update faceBoxes data', async () => {
      const boxes = '[{"x":10,"y":20,"width":30,"height":40}]';
      const updated = await prisma.photo.update({
        where: { driveId: 'test123' },
        data: { faceBoxes: boxes },
      });

      expect(updated.faceBoxes).toBe(boxes);
    });

    it('should update multiple fields at once', async () => {
      const updated = await prisma.photo.update({
        where: { driveId: 'test123' },
        data: {
          mainFaceId: 'person_7',
          faceIds: '["person_7", "person_8"]',
          faceBoxes: '[{"x":100,"y":200,"width":50,"height":70}]',
          poseId: 'jump',
        },
      });

      expect(updated.mainFaceId).toBe('person_7');
      expect(updated.faceIds).toBe('["person_7", "person_8"]');
      expect(updated.faceBoxes).toBe('[{"x":100,"y":200,"width":50,"height":70}]');
      expect(updated.poseId).toBe('jump');
    });

    it('should throw error when updating non-existent photo', async () => {
      await expect(
        prisma.photo.update({
          where: { id: 99999 },
          data: { mainFaceId: 'person_1' },
        })
      ).rejects.toThrow();
    });
  });

  describe('DELETE operations', () => {
    let testPhoto1, testPhoto2;

    beforeEach(async () => {
      testPhoto1 = await prisma.photo.create({
        data: {
          name: 'photo1.jpg',
          driveId: 'delete1',
          url: '/api/image/delete1',
        },
      });

      testPhoto2 = await prisma.photo.create({
        data: {
          name: 'photo2.jpg',
          driveId: 'delete2',
          url: '/api/image/delete2',
        },
      });
    });

    it('should delete photo by ID', async () => {
      const deleted = await prisma.photo.delete({
        where: { id: testPhoto1.id },
      });

      expect(deleted.id).toBe(testPhoto1.id);

      const found = await prisma.photo.findUnique({
        where: { id: testPhoto1.id },
      });
      expect(found).toBeNull();
    });

    it('should delete photo by driveId', async () => {
      await prisma.photo.delete({
        where: { driveId: 'delete2' },
      });

      const remaining = await prisma.photo.findMany();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].driveId).toBe('delete1');
    });

    it('should throw error when deleting non-existent photo', async () => {
      await expect(
        prisma.photo.delete({
          where: { id: 99999 },
        })
      ).rejects.toThrow();
    });

    it('should delete multiple photos by criteria', async () => {
      // Add more test photos
      await prisma.photo.createMany({
        data: [
          {
            name: 'photo3.jpg',
            driveId: 'delete3',
            url: '/api/image/delete3',
            poseId: 'to-delete',
          },
          {
            name: 'photo4.jpg',
            driveId: 'delete4',
            url: '/api/image/delete4',
            poseId: 'to-delete',
          },
        ],
      });

      const result = await prisma.photo.deleteMany({
        where: { poseId: 'to-delete' },
      });

      expect(result.count).toBe(2);

      const remaining = await prisma.photo.findMany();
      expect(remaining).toHaveLength(2); // Only testPhoto1 and testPhoto2 remain
    });
  });

  describe('UPSERT operations', () => {
    it('should insert when record does not exist', async () => {
      const photo = await prisma.photo.upsert({
        where: { driveId: 'new123' },
        update: {},
        create: {
          name: 'new-photo.jpg',
          driveId: 'new123',
          url: '/api/image/new123',
        },
      });

      expect(photo.driveId).toBe('new123');
      expect(photo.name).toBe('new-photo.jpg');

      const count = await prisma.photo.count();
      expect(count).toBe(1);
    });

    it('should update when record exists', async () => {
      // Create initial photo
      await prisma.photo.create({
        data: {
          name: 'original.jpg',
          driveId: 'existing123',
          url: '/api/image/existing123',
          mainFaceId: 'unknown',
        },
      });

      // Upsert should update
      const photo = await prisma.photo.upsert({
        where: { driveId: 'existing123' },
        update: { mainFaceId: 'person_10' },
        create: {
          name: 'should-not-create.jpg',
          driveId: 'existing123',
          url: '/api/image/existing123',
        },
      });

      expect(photo.name).toBe('original.jpg'); // Not changed
      expect(photo.mainFaceId).toBe('person_10'); // Updated

      const count = await prisma.photo.count();
      expect(count).toBe(1); // Still only 1 record
    });
  });

  describe('COUNT and aggregation', () => {
    beforeEach(async () => {
      await prisma.photo.createMany({
        data: [
          { name: 'p1.jpg', driveId: 'd1', url: '/api/image/d1', poseId: 'dip' },
          { name: 'p2.jpg', driveId: 'd2', url: '/api/image/d2', poseId: 'dip' },
          { name: 'p3.jpg', driveId: 'd3', url: '/api/image/d3', poseId: 'jump' },
          { name: 'p4.jpg', driveId: 'd4', url: '/api/image/d4', uploaderId: 'user1' },
          { name: 'p5.jpg', driveId: 'd5', url: '/api/image/d5', uploaderId: 'user1' },
        ],
      });
    });

    it('should count all photos', async () => {
      const count = await prisma.photo.count();
      expect(count).toBe(5);
    });

    it('should count photos by poseId', async () => {
      const count = await prisma.photo.count({
        where: { poseId: 'dip' },
      });
      expect(count).toBe(2);
    });

    it('should count photos by uploaderId', async () => {
      const count = await prisma.photo.count({
        where: { uploaderId: 'user1' },
      });
      expect(count).toBe(2);
    });
  });

  describe('Data integrity', () => {
    it('should preserve JSON data in string fields', async () => {
      const faceIds = '["person_1", "person_2", "person_3"]';
      const faceBoxes = '[{"x":10,"y":20,"width":30,"height":40},{"x":50,"y":60,"width":70,"height":80}]';

      const photo = await prisma.photo.create({
        data: {
          name: 'test.jpg',
          driveId: 'json-test',
          url: '/api/image/json-test',
          faceIds,
          faceBoxes,
        },
      });

      // Retrieve and verify JSON is preserved
      const retrieved = await prisma.photo.findUnique({
        where: { driveId: 'json-test' },
      });

      expect(retrieved.faceIds).toBe(faceIds);
      expect(retrieved.faceBoxes).toBe(faceBoxes);

      // Verify we can parse the JSON
      const parsedIds = JSON.parse(retrieved.faceIds);
      expect(parsedIds).toHaveLength(3);
      expect(parsedIds[0]).toBe('person_1');

      const parsedBoxes = JSON.parse(retrieved.faceBoxes);
      expect(parsedBoxes).toHaveLength(2);
      expect(parsedBoxes[0].x).toBe(10);
    });

    it('should handle empty JSON arrays correctly', async () => {
      const photo = await prisma.photo.create({
        data: {
          name: 'empty.jpg',
          driveId: 'empty-json',
          url: '/api/image/empty-json',
        },
      });

      expect(photo.faceIds).toBe('[]');
      expect(photo.faceBoxes).toBe('[]');

      const parsed = JSON.parse(photo.faceIds);
      expect(parsed).toEqual([]);
    });
  });
});
