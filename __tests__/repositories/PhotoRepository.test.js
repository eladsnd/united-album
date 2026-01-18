/**
 * PhotoRepository Tests (TDD)
 *
 * Tests for photo data access layer including:
 * - Serialization/deserialization of arrays (faceIds, faceBoxes)
 * - CRUD operations (save, find, update, delete)
 * - Photo-specific queries (by mainFaceId, poseId, containingFace)
 * - Error handling and edge cases
 */

import { prismaMock } from '../prismaMock.js';

// Mock Prisma client BEFORE importing repository
jest.mock('../../lib/prisma.js', () => ({
  __esModule: true,
  default: require('../prismaMock.js').prismaMock,
}));

import { PhotoRepository } from '../../lib/repositories/PhotoRepository.js';

describe('PhotoRepository', () => {
  let photoRepo;

  beforeEach(() => {
    photoRepo = new PhotoRepository();
    jest.clearAllMocks();
  });

  describe('getModel()', () => {
    it('should return "photo" as model name', () => {
      expect(photoRepo.getModel()).toBe('photo');
    });
  });

  describe('serialize()', () => {
    it('should convert faceIds array to JSON string', () => {
      const data = {
        name: 'test.jpg',
        driveId: 'abc123',
        faceIds: ['person_1', 'person_2'],
        faceBoxes: [],
      };

      const serialized = photoRepo.serialize(data);

      expect(serialized.faceIds).toBe('["person_1","person_2"]');
    });

    it('should convert faceBoxes array to JSON string', () => {
      const data = {
        name: 'test.jpg',
        driveId: 'abc123',
        faceIds: [],
        faceBoxes: [{ x: 100, y: 200, width: 50, height: 60 }],
      };

      const serialized = photoRepo.serialize(data);

      expect(serialized.faceBoxes).toBe('[{"x":100,"y":200,"width":50,"height":60}]');
    });

    it('should convert timestamp string to Date object', () => {
      const timestamp = '2025-01-18T12:00:00.000Z';
      const data = {
        name: 'test.jpg',
        driveId: 'abc123',
        faceIds: [],
        faceBoxes: [],
        timestamp,
      };

      const serialized = photoRepo.serialize(data);

      expect(serialized.timestamp).toBeInstanceOf(Date);
      expect(serialized.timestamp.toISOString()).toBe(timestamp);
    });

    it('should use current date if timestamp not provided', () => {
      const data = {
        name: 'test.jpg',
        driveId: 'abc123',
        faceIds: [],
        faceBoxes: [],
      };

      const beforeTime = new Date();
      const serialized = photoRepo.serialize(data);
      const afterTime = new Date();

      expect(serialized.timestamp).toBeInstanceOf(Date);
      expect(serialized.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(serialized.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should preserve string faceIds if already a string', () => {
      const data = {
        name: 'test.jpg',
        driveId: 'abc123',
        faceIds: '["person_1"]',
        faceBoxes: [],
      };

      const serialized = photoRepo.serialize(data);

      expect(serialized.faceIds).toBe('["person_1"]');
    });

    it('should use empty array JSON string for missing faceIds', () => {
      const data = {
        name: 'test.jpg',
        driveId: 'abc123',
        faceBoxes: [],
      };

      const serialized = photoRepo.serialize(data);

      expect(serialized.faceIds).toBe('[]');
    });
  });

  describe('deserialize()', () => {
    it('should parse faceIds JSON string to array', () => {
      const record = {
        id: 1,
        name: 'test.jpg',
        driveId: 'abc123',
        faceIds: '["person_1","person_2"]',
        faceBoxes: '[]',
        timestamp: new Date(),
      };

      const deserialized = photoRepo.deserialize(record);

      expect(Array.isArray(deserialized.faceIds)).toBe(true);
      expect(deserialized.faceIds).toEqual(['person_1', 'person_2']);
    });

    it('should parse faceBoxes JSON string to array', () => {
      const record = {
        id: 1,
        name: 'test.jpg',
        driveId: 'abc123',
        faceIds: '[]',
        faceBoxes: '[{"x":100,"y":200,"width":50,"height":60}]',
        timestamp: new Date(),
      };

      const deserialized = photoRepo.deserialize(record);

      expect(Array.isArray(deserialized.faceBoxes)).toBe(true);
      expect(deserialized.faceBoxes).toEqual([{ x: 100, y: 200, width: 50, height: 60 }]);
    });

    it('should handle empty string faceIds', () => {
      const record = {
        id: 1,
        name: 'test.jpg',
        driveId: 'abc123',
        faceIds: '',
        faceBoxes: '[]',
        timestamp: new Date(),
      };

      const deserialized = photoRepo.deserialize(record);

      expect(deserialized.faceIds).toEqual([]);
    });

    it('should handle null faceIds', () => {
      const record = {
        id: 1,
        name: 'test.jpg',
        driveId: 'abc123',
        faceIds: null,
        faceBoxes: '[]',
        timestamp: new Date(),
      };

      const deserialized = photoRepo.deserialize(record);

      expect(deserialized.faceIds).toEqual([]);
    });
  });

  describe('save()', () => {
    it('should upsert photo by driveId', async () => {
      const photo = {
        name: 'wedding.jpg',
        driveId: 'drive123',
        url: '/api/image/drive123',
        mainFaceId: 'person_1',
        faceIds: ['person_1', 'person_2'],
        faceBoxes: [{ x: 100, y: 200, width: 50, height: 60 }],
        poseId: 'dip',
        uploaderId: 'uploader_123',
        timestamp: new Date().toISOString(),
      };

      const mockSavedPhoto = {
        id: 1,
        ...photo,
        faceIds: JSON.stringify(photo.faceIds),
        faceBoxes: JSON.stringify(photo.faceBoxes),
        timestamp: new Date(photo.timestamp),
      };

      prismaMock.photo.upsert.mockResolvedValue(mockSavedPhoto);

      const result = await photoRepo.save(photo);

      expect(prismaMock.photo.upsert).toHaveBeenCalledWith({
        where: { driveId: 'drive123' },
        create: expect.objectContaining({
          driveId: 'drive123',
          name: 'wedding.jpg',
          mainFaceId: 'person_1',
          poseId: 'dip',
        }),
        update: expect.objectContaining({
          driveId: 'drive123',
          name: 'wedding.jpg',
          mainFaceId: 'person_1',
          poseId: 'dip',
        }),
      });

      expect(result.faceIds).toEqual(['person_1', 'person_2']); // Deserialized
      expect(result.faceBoxes).toEqual([{ x: 100, y: 200, width: 50, height: 60 }]);
    });

    it('should use default values for missing fields', async () => {
      const photo = {
        driveId: 'drive456',
      };

      const mockSavedPhoto = {
        id: 2,
        name: 'unknown.jpg',
        driveId: 'drive456',
        url: '/api/image/drive456',
        mainFaceId: 'unknown',
        faceIds: '[]',
        faceBoxes: '[]',
        poseId: 'unknown_pose',
        uploaderId: null,
        timestamp: new Date(),
      };

      prismaMock.photo.upsert.mockResolvedValue(mockSavedPhoto);

      const result = await photoRepo.save(photo);

      expect(prismaMock.photo.upsert).toHaveBeenCalledWith({
        where: { driveId: 'drive456' },
        create: expect.objectContaining({
          name: 'unknown.jpg',
          mainFaceId: 'unknown',
          poseId: 'unknown_pose',
          uploaderId: null,
        }),
        update: expect.objectContaining({
          name: 'unknown.jpg',
          mainFaceId: 'unknown',
          poseId: 'unknown_pose',
          uploaderId: null,
        }),
      });

      expect(result.faceIds).toEqual([]);
      expect(result.faceBoxes).toEqual([]);
    });
  });

  describe('findByDriveId()', () => {
    it('should find photo by driveId', async () => {
      const mockPhoto = {
        id: 1,
        name: 'test.jpg',
        driveId: 'drive789',
        faceIds: '["person_1"]',
        faceBoxes: '[{"x":10,"y":20,"width":30,"height":40}]',
        timestamp: new Date(),
      };

      prismaMock.photo.findUnique.mockResolvedValue(mockPhoto);

      const result = await photoRepo.findByDriveId('drive789');

      expect(prismaMock.photo.findUnique).toHaveBeenCalledWith({
        where: { driveId: 'drive789' },
      });

      expect(result.faceIds).toEqual(['person_1']);
      expect(result.faceBoxes).toEqual([{ x: 10, y: 20, width: 30, height: 40 }]);
    });

    it('should return null if photo not found', async () => {
      prismaMock.photo.findUnique.mockResolvedValue(null);

      const result = await photoRepo.findByDriveId('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findAll()', () => {
    it('should return all photos ordered by timestamp descending', async () => {
      const mockPhotos = [
        {
          id: 2,
          name: 'photo2.jpg',
          driveId: 'drive002',
          faceIds: '["person_2"]',
          faceBoxes: '[]',
          timestamp: new Date('2025-01-18T12:00:00.000Z'),
        },
        {
          id: 1,
          name: 'photo1.jpg',
          driveId: 'drive001',
          faceIds: '["person_1"]',
          faceBoxes: '[]',
          timestamp: new Date('2025-01-17T12:00:00.000Z'),
        },
      ];

      prismaMock.photo.findMany.mockResolvedValue(mockPhotos);

      const result = await photoRepo.findAll();

      expect(prismaMock.photo.findMany).toHaveBeenCalledWith({
        orderBy: { timestamp: 'desc' },
      });

      expect(result).toHaveLength(2);
      expect(result[0].driveId).toBe('drive002');
      expect(result[1].driveId).toBe('drive001');
    });

    it('should return empty array when no photos exist', async () => {
      prismaMock.photo.findMany.mockResolvedValue([]);

      const result = await photoRepo.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findByMainFaceId()', () => {
    it('should find photos by mainFaceId', async () => {
      const mockPhotos = [
        {
          id: 1,
          name: 'photo1.jpg',
          driveId: 'drive001',
          mainFaceId: 'person_1',
          faceIds: '["person_1"]',
          faceBoxes: '[]',
          timestamp: new Date(),
        },
        {
          id: 2,
          name: 'photo2.jpg',
          driveId: 'drive002',
          mainFaceId: 'person_1',
          faceIds: '["person_1","person_2"]',
          faceBoxes: '[]',
          timestamp: new Date(),
        },
      ];

      prismaMock.photo.findMany.mockResolvedValue(mockPhotos);

      const result = await photoRepo.findByMainFaceId('person_1');

      expect(prismaMock.photo.findMany).toHaveBeenCalledWith({
        where: { mainFaceId: 'person_1' },
        orderBy: { timestamp: 'desc' },
      });

      expect(result).toHaveLength(2);
    });
  });

  describe('findByPoseId()', () => {
    it('should find photos by poseId', async () => {
      const mockPhotos = [
        {
          id: 1,
          name: 'photo1.jpg',
          driveId: 'drive001',
          poseId: 'dip',
          faceIds: '[]',
          faceBoxes: '[]',
          timestamp: new Date(),
        },
      ];

      prismaMock.photo.findMany.mockResolvedValue(mockPhotos);

      const result = await photoRepo.findByPoseId('dip');

      expect(prismaMock.photo.findMany).toHaveBeenCalledWith({
        where: { poseId: 'dip' },
        orderBy: { timestamp: 'desc' },
      });

      expect(result).toHaveLength(1);
      expect(result[0].poseId).toBe('dip');
    });
  });

  describe('findByUploaderId()', () => {
    it('should find photos by uploaderId', async () => {
      const mockPhotos = [
        {
          id: 1,
          name: 'photo1.jpg',
          driveId: 'drive001',
          uploaderId: 'uploader_abc',
          faceIds: '[]',
          faceBoxes: '[]',
          timestamp: new Date(),
        },
      ];

      prismaMock.photo.findMany.mockResolvedValue(mockPhotos);

      const result = await photoRepo.findByUploaderId('uploader_abc');

      expect(prismaMock.photo.findMany).toHaveBeenCalledWith({
        where: { uploaderId: 'uploader_abc' },
        orderBy: { timestamp: 'desc' },
      });

      expect(result).toHaveLength(1);
    });
  });

  describe('findContainingFace()', () => {
    it('should find photos containing faceId in faceIds array', async () => {
      const mockPhotos = [
        {
          id: 1,
          name: 'photo1.jpg',
          driveId: 'drive001',
          mainFaceId: 'person_1',
          faceIds: '["person_1","person_2"]',
          faceBoxes: '[]',
          timestamp: new Date(),
        },
        {
          id: 2,
          name: 'photo2.jpg',
          driveId: 'drive002',
          mainFaceId: 'person_3',
          faceIds: '["person_2","person_3"]',
          faceBoxes: '[]',
          timestamp: new Date(),
        },
        {
          id: 3,
          name: 'photo3.jpg',
          driveId: 'drive003',
          mainFaceId: 'person_4',
          faceIds: '["person_4"]',
          faceBoxes: '[]',
          timestamp: new Date(),
        },
      ];

      prismaMock.photo.findMany.mockResolvedValue(mockPhotos);

      const result = await photoRepo.findContainingFace('person_2');

      // Should return photos 1 and 2 (both contain person_2 in faceIds)
      expect(result).toHaveLength(2);
      expect(result[0].driveId).toBe('drive001');
      expect(result[1].driveId).toBe('drive002');
    });

    it('should return empty array if no photos contain the face', async () => {
      const mockPhotos = [
        {
          id: 1,
          name: 'photo1.jpg',
          driveId: 'drive001',
          mainFaceId: 'person_1',
          faceIds: '["person_1"]',
          faceBoxes: '[]',
          timestamp: new Date(),
        },
      ];

      prismaMock.photo.findMany.mockResolvedValue(mockPhotos);

      const result = await photoRepo.findContainingFace('person_99');

      expect(result).toEqual([]);
    });
  });

  describe('updateById()', () => {
    it('should update photo by id', async () => {
      const updates = {
        mainFaceId: 'person_3',
        faceIds: ['person_3', 'person_4'],
        faceBoxes: [{ x: 50, y: 100, width: 40, height: 50 }],
      };

      const mockUpdatedPhoto = {
        id: 1,
        name: 'photo.jpg',
        driveId: 'drive123',
        mainFaceId: 'person_3',
        faceIds: '["person_3","person_4"]',
        faceBoxes: '[{"x":50,"y":100,"width":40,"height":50}]',
        timestamp: new Date(),
      };

      prismaMock.photo.update.mockResolvedValue(mockUpdatedPhoto);

      const result = await photoRepo.updateById(1, updates);

      expect(prismaMock.photo.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          mainFaceId: 'person_3',
          faceIds: '["person_3","person_4"]',
          faceBoxes: '[{"x":50,"y":100,"width":40,"height":50}]',
        }),
      });

      expect(result.faceIds).toEqual(['person_3', 'person_4']);
      expect(result.faceBoxes).toEqual([{ x: 50, y: 100, width: 40, height: 50 }]);
    });
  });

  describe('deleteByDriveId()', () => {
    it('should delete photo by driveId', async () => {
      const mockDeletedPhoto = {
        id: 1,
        name: 'deleted.jpg',
        driveId: 'drive999',
        faceIds: '[]',
        faceBoxes: '[]',
        timestamp: new Date(),
      };

      prismaMock.photo.delete.mockResolvedValue(mockDeletedPhoto);

      const result = await photoRepo.deleteByDriveId('drive999');

      expect(prismaMock.photo.delete).toHaveBeenCalledWith({
        where: { driveId: 'drive999' },
      });

      expect(result.driveId).toBe('drive999');
    });
  });

  describe('countAll()', () => {
    it('should return total photo count', async () => {
      prismaMock.photo.count.mockResolvedValue(42);

      const result = await photoRepo.countAll();

      expect(prismaMock.photo.count).toHaveBeenCalled();
      expect(result).toBe(42);
    });

    it('should return 0 when no photos exist', async () => {
      prismaMock.photo.count.mockResolvedValue(0);

      const result = await photoRepo.countAll();

      expect(result).toBe(0);
    });
  });
});
