/**
 * Database Tests: Face Model
 *
 * Tests all CRUD operations for the Face table using Prisma.
 * Face records store face recognition descriptors (128D vectors).
 */

import prisma from '../../lib/prisma';

describe('Face Database Operations', () => {
  // Clean up database before each test
  beforeEach(async () => {
    await prisma.face.deleteMany();
  });

  // Close database connection after all tests
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('CREATE operations', () => {
    it('should create a face with required fields', async () => {
      const face = await prisma.face.create({
        data: {
          faceId: 'person_1',
        },
      });

      expect(face.faceId).toBe('person_1');
      expect(face.descriptors).toBe('[]'); // default empty array
      expect(face.descriptor).toBe('[]'); // default empty array
      expect(face.metadata).toBe('{}'); // default empty object
      expect(face.thumbnailDriveId).toBeNull(); // nullable
      expect(face.lastSeen).toBeInstanceOf(Date);
      expect(face.photoCount).toBe(0); // default
      expect(face.sampleCount).toBe(0); // default
      expect(face.createdAt).toBeInstanceOf(Date);
      expect(face.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a face with descriptor data', async () => {
      // Simulate a 128-dimensional face descriptor (shortened for test)
      const descriptor = JSON.stringify([0.1, 0.2, 0.3, 0.4, 0.5]);
      const descriptors = JSON.stringify([
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ]);

      const face = await prisma.face.create({
        data: {
          faceId: 'person_2',
          descriptors,
          descriptor,
          metadata: '{"confidence": 0.95}',
          photoCount: 1,
          sampleCount: 2,
        },
      });

      expect(face.faceId).toBe('person_2');
      expect(face.descriptors).toBe(descriptors);
      expect(face.descriptor).toBe(descriptor);
      expect(face.metadata).toBe('{"confidence": 0.95}');
      expect(face.photoCount).toBe(1);
      expect(face.sampleCount).toBe(2);
    });

    it('should create a face with thumbnail', async () => {
      const face = await prisma.face.create({
        data: {
          faceId: 'person_3',
          thumbnailDriveId: 'thumb_xyz789',
        },
      });

      expect(face.faceId).toBe('person_3');
      expect(face.thumbnailDriveId).toBe('thumb_xyz789');
    });

    it('should enforce unique faceId constraint', async () => {
      await prisma.face.create({
        data: { faceId: 'person_duplicate' },
      });

      // Attempting to create another face with same faceId should fail
      await expect(
        prisma.face.create({
          data: { faceId: 'person_duplicate' },
        })
      ).rejects.toThrow();
    });
  });

  describe('READ operations', () => {
    beforeEach(async () => {
      // Create test faces
      await prisma.face.createMany({
        data: [
          {
            faceId: 'person_1',
            photoCount: 5,
            sampleCount: 3,
            lastSeen: new Date('2026-01-18T10:00:00Z'),
            thumbnailDriveId: 'thumb1',
          },
          {
            faceId: 'person_2',
            photoCount: 10,
            sampleCount: 5,
            lastSeen: new Date('2026-01-18T11:00:00Z'),
            thumbnailDriveId: 'thumb2',
          },
          {
            faceId: 'person_3',
            photoCount: 2,
            sampleCount: 1,
            lastSeen: new Date('2026-01-18T09:00:00Z'),
          },
        ],
      });
    });

    it('should find face by faceId', async () => {
      const face = await prisma.face.findUnique({
        where: { faceId: 'person_2' },
      });

      expect(face).not.toBeNull();
      expect(face.photoCount).toBe(10);
      expect(face.sampleCount).toBe(5);
    });

    it('should return null for non-existent faceId', async () => {
      const face = await prisma.face.findUnique({
        where: { faceId: 'person_999' },
      });

      expect(face).toBeNull();
    });

    it('should filter faces by photoCount', async () => {
      const faces = await prisma.face.findMany({
        where: {
          photoCount: {
            gte: 5, // Greater than or equal to 5
          },
        },
      });

      expect(faces).toHaveLength(2);
      expect(faces.every(f => f.photoCount >= 5)).toBe(true);
    });

    it('should find faces with thumbnails', async () => {
      const faces = await prisma.face.findMany({
        where: {
          thumbnailDriveId: {
            not: null,
          },
        },
      });

      expect(faces).toHaveLength(2);
      expect(faces.every(f => f.thumbnailDriveId !== null)).toBe(true);
    });

    it('should find faces without thumbnails', async () => {
      const faces = await prisma.face.findMany({
        where: {
          thumbnailDriveId: null,
        },
      });

      expect(faces).toHaveLength(1);
      expect(faces[0].faceId).toBe('person_3');
    });

    it('should order faces by photoCount descending', async () => {
      const faces = await prisma.face.findMany({
        orderBy: { photoCount: 'desc' },
      });

      expect(faces).toHaveLength(3);
      expect(faces[0].faceId).toBe('person_2'); // 10 photos
      expect(faces[1].faceId).toBe('person_1'); // 5 photos
      expect(faces[2].faceId).toBe('person_3'); // 2 photos
    });

    it('should order faces by lastSeen descending', async () => {
      const faces = await prisma.face.findMany({
        orderBy: { lastSeen: 'desc' },
      });

      expect(faces).toHaveLength(3);
      expect(faces[0].faceId).toBe('person_2'); // Most recent
      expect(faces[1].faceId).toBe('person_1');
      expect(faces[2].faceId).toBe('person_3'); // Oldest
    });
  });

  describe('UPDATE operations', () => {
    let testFace;

    beforeEach(async () => {
      testFace = await prisma.face.create({
        data: {
          faceId: 'person_test',
          descriptors: '[]',
          descriptor: '[]',
          photoCount: 1,
          sampleCount: 0,
        },
      });
    });

    it('should increment photoCount', async () => {
      const updated = await prisma.face.update({
        where: { faceId: 'person_test' },
        data: {
          photoCount: {
            increment: 1,
          },
        },
      });

      expect(updated.photoCount).toBe(2);
    });

    it('should decrement photoCount', async () => {
      // Set initial count to 5
      await prisma.face.update({
        where: { faceId: 'person_test' },
        data: { photoCount: 5 },
      });

      const updated = await prisma.face.update({
        where: { faceId: 'person_test' },
        data: {
          photoCount: {
            decrement: 1,
          },
        },
      });

      expect(updated.photoCount).toBe(4);
    });

    it('should update descriptors array', async () => {
      const newDescriptors = JSON.stringify([
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
        [0.7, 0.8, 0.9],
      ]);

      const updated = await prisma.face.update({
        where: { faceId: 'person_test' },
        data: {
          descriptors: newDescriptors,
          sampleCount: 3,
        },
      });

      expect(updated.descriptors).toBe(newDescriptors);
      expect(updated.sampleCount).toBe(3);

      // Verify we can parse the JSON
      const parsed = JSON.parse(updated.descriptors);
      expect(parsed).toHaveLength(3);
    });

    it('should update average descriptor', async () => {
      const avgDescriptor = JSON.stringify([0.5, 0.5, 0.5]);

      const updated = await prisma.face.update({
        where: { faceId: 'person_test' },
        data: { descriptor: avgDescriptor },
      });

      expect(updated.descriptor).toBe(avgDescriptor);
    });

    it('should update thumbnailDriveId', async () => {
      const updated = await prisma.face.update({
        where: { faceId: 'person_test' },
        data: { thumbnailDriveId: 'new_thumb_123' },
      });

      expect(updated.thumbnailDriveId).toBe('new_thumb_123');
    });

    it('should update lastSeen timestamp', async () => {
      const newTime = new Date('2026-01-20T15:30:00Z');

      const updated = await prisma.face.update({
        where: { faceId: 'person_test' },
        data: { lastSeen: newTime },
      });

      expect(updated.lastSeen).toEqual(newTime);
    });

    it('should update metadata', async () => {
      const metadata = JSON.stringify({
        confidence: 0.98,
        detectionMethod: 'ssd',
      });

      const updated = await prisma.face.update({
        where: { faceId: 'person_test' },
        data: { metadata },
      });

      expect(updated.metadata).toBe(metadata);

      const parsed = JSON.parse(updated.metadata);
      expect(parsed.confidence).toBe(0.98);
      expect(parsed.detectionMethod).toBe('ssd');
    });
  });

  describe('DELETE operations', () => {
    beforeEach(async () => {
      await prisma.face.createMany({
        data: [
          { faceId: 'person_1', photoCount: 5 },
          { faceId: 'person_2', photoCount: 10 },
          { faceId: 'person_3', photoCount: 0 }, // Orphaned face
        ],
      });
    });

    it('should delete face by faceId', async () => {
      const deleted = await prisma.face.delete({
        where: { faceId: 'person_1' },
      });

      expect(deleted.faceId).toBe('person_1');

      const remaining = await prisma.face.findMany();
      expect(remaining).toHaveLength(2);
    });

    it('should delete orphaned faces (photoCount = 0)', async () => {
      const result = await prisma.face.deleteMany({
        where: { photoCount: 0 },
      });

      expect(result.count).toBe(1);

      const remaining = await prisma.face.findMany();
      expect(remaining).toHaveLength(2);
      expect(remaining.every(f => f.photoCount > 0)).toBe(true);
    });

    it('should throw error when deleting non-existent face', async () => {
      await expect(
        prisma.face.delete({
          where: { faceId: 'person_999' },
        })
      ).rejects.toThrow();
    });
  });

  describe('UPSERT operations', () => {
    it('should insert when face does not exist', async () => {
      const descriptor = JSON.stringify([0.1, 0.2, 0.3]);

      const face = await prisma.face.upsert({
        where: { faceId: 'person_new' },
        update: {},
        create: {
          faceId: 'person_new',
          descriptor,
          photoCount: 1,
          sampleCount: 1,
        },
      });

      expect(face.faceId).toBe('person_new');
      expect(face.descriptor).toBe(descriptor);
      expect(face.photoCount).toBe(1);

      const count = await prisma.face.count();
      expect(count).toBe(1);
    });

    it('should update when face exists', async () => {
      // Create initial face
      await prisma.face.create({
        data: {
          faceId: 'person_existing',
          descriptor: '[]',
          photoCount: 1,
        },
      });

      // Upsert should update
      const newDescriptor = JSON.stringify([0.5, 0.5, 0.5]);

      const face = await prisma.face.upsert({
        where: { faceId: 'person_existing' },
        update: {
          descriptor: newDescriptor,
          photoCount: { increment: 1 },
        },
        create: {
          faceId: 'person_existing',
          descriptor: newDescriptor,
          photoCount: 1,
        },
      });

      expect(face.descriptor).toBe(newDescriptor);
      expect(face.photoCount).toBe(2); // Incremented

      const count = await prisma.face.count();
      expect(count).toBe(1); // Still only 1 record
    });

    it('should handle adding new descriptor sample', async () => {
      // Create face with 1 sample
      const sample1 = [0.1, 0.2, 0.3];
      await prisma.face.create({
        data: {
          faceId: 'person_samples',
          descriptors: JSON.stringify([sample1]),
          sampleCount: 1,
        },
      });

      // Add second sample
      const sample2 = [0.4, 0.5, 0.6];
      const existingFace = await prisma.face.findUnique({
        where: { faceId: 'person_samples' },
      });
      const existingDescriptors = JSON.parse(existingFace.descriptors);
      const updatedDescriptors = [...existingDescriptors, sample2];

      const face = await prisma.face.update({
        where: { faceId: 'person_samples' },
        data: {
          descriptors: JSON.stringify(updatedDescriptors),
          sampleCount: { increment: 1 },
        },
      });

      const parsed = JSON.parse(face.descriptors);
      expect(parsed).toHaveLength(2);
      expect(face.sampleCount).toBe(2);
    });
  });

  describe('COUNT and aggregation', () => {
    beforeEach(async () => {
      await prisma.face.createMany({
        data: [
          { faceId: 'person_1', photoCount: 5, sampleCount: 3 },
          { faceId: 'person_2', photoCount: 10, sampleCount: 5 },
          { faceId: 'person_3', photoCount: 2, sampleCount: 1 },
          { faceId: 'person_4', photoCount: 0, sampleCount: 0 }, // Orphaned
          { faceId: 'person_5', photoCount: 7, sampleCount: 4 },
        ],
      });
    });

    it('should count all faces', async () => {
      const count = await prisma.face.count();
      expect(count).toBe(5);
    });

    it('should count faces with photos', async () => {
      const count = await prisma.face.count({
        where: {
          photoCount: {
            gt: 0,
          },
        },
      });
      expect(count).toBe(4);
    });

    it('should count orphaned faces', async () => {
      const count = await prisma.face.count({
        where: { photoCount: 0 },
      });
      expect(count).toBe(1);
    });

    it('should find face with most photos', async () => {
      const face = await prisma.face.findFirst({
        orderBy: { photoCount: 'desc' },
      });

      expect(face.faceId).toBe('person_2');
      expect(face.photoCount).toBe(10);
    });
  });

  describe('Data integrity', () => {
    it('should preserve descriptor arrays in JSON format', async () => {
      // Simulate multiple 128D face descriptors (shortened for test)
      const descriptors = JSON.stringify([
        [0.1, 0.2, 0.3, 0.4, 0.5],
        [0.6, 0.7, 0.8, 0.9, 1.0],
        [1.1, 1.2, 1.3, 1.4, 1.5],
      ]);

      const avgDescriptor = JSON.stringify([0.6, 0.7, 0.8, 0.9, 1.0]);

      const face = await prisma.face.create({
        data: {
          faceId: 'person_json_test',
          descriptors,
          descriptor: avgDescriptor,
          sampleCount: 3,
        },
      });

      const retrieved = await prisma.face.findUnique({
        where: { faceId: 'person_json_test' },
      });

      expect(retrieved.descriptors).toBe(descriptors);
      expect(retrieved.descriptor).toBe(avgDescriptor);

      // Verify parsing works
      const parsedDescriptors = JSON.parse(retrieved.descriptors);
      expect(parsedDescriptors).toHaveLength(3);
      expect(parsedDescriptors[0][0]).toBe(0.1);

      const parsedAvg = JSON.parse(retrieved.descriptor);
      expect(parsedAvg).toHaveLength(5);
      expect(parsedAvg[0]).toBe(0.6);
    });

    it('should handle empty descriptors correctly', async () => {
      const face = await prisma.face.create({
        data: { faceId: 'person_empty' },
      });

      expect(face.descriptors).toBe('[]');
      expect(face.descriptor).toBe('[]');

      const parsedDescriptors = JSON.parse(face.descriptors);
      const parsedAvg = JSON.parse(face.descriptor);

      expect(parsedDescriptors).toEqual([]);
      expect(parsedAvg).toEqual([]);
    });

    it('should handle complex metadata JSON', async () => {
      const metadata = JSON.stringify({
        confidence: 0.95,
        detectionMethod: 'ssd_mobilenetv1',
        timestamp: '2026-01-18T12:00:00Z',
        boundingBox: { x: 100, y: 200, width: 50, height: 70 },
        landmarks: [
          { type: 'leftEye', x: 110, y: 220 },
          { type: 'rightEye', x: 140, y: 220 },
        ],
      });

      const face = await prisma.face.create({
        data: {
          faceId: 'person_metadata_test',
          metadata,
        },
      });

      const retrieved = await prisma.face.findUnique({
        where: { faceId: 'person_metadata_test' },
      });

      expect(retrieved.metadata).toBe(metadata);

      const parsed = JSON.parse(retrieved.metadata);
      expect(parsed.confidence).toBe(0.95);
      expect(parsed.boundingBox.width).toBe(50);
      expect(parsed.landmarks).toHaveLength(2);
    });
  });
});
