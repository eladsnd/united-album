/**
 * PhotoService Tests
 *
 * Tests for photo deletion service with permission checks and orphaned face cleanup.
 * Tests the actual PhotoService implementation which takes photoId (number).
 */

import { prismaMock } from '../../prismaMock.js';

// Mock Prisma client BEFORE importing repositories and services
jest.mock('../../../lib/prisma.js', () => ({
  __esModule: true,
  default: require('../../prismaMock.js').prismaMock,
}));

import { PhotoService } from '../../../lib/services/PhotoService.js';
import { deleteFromDrive } from '../../../lib/googleDrive.js';

// Mock Google Drive operations
jest.mock('../../../lib/googleDrive.js', () => ({
  deleteFromDrive: jest.fn(),
  findOrCreateFolder: jest.fn(),
}));

describe('PhotoService', () => {
  let photoService;

  beforeEach(() => {
    photoService = new PhotoService();
    jest.clearAllMocks();
  });

  describe('deletePhoto()', () => {
    const mockPhoto = {
      id: 1,
      driveId: 'drive123',
      faceIds: '["person_1","person_2"]', // JSON string (as stored in SQLite)
      faceBoxes: '[]',
      mainFaceId: 'person_1',
      poseId: 'dip',
      uploaderId: 'uploader_123',
      timestamp: new Date('2025-01-15'),
    };

    describe('Admin permissions', () => {
      it('should allow admin to delete any photo', async () => {
        prismaMock.photo.findMany.mockResolvedValueOnce([mockPhoto]); // findAll()
        prismaMock.photo.delete.mockResolvedValue(mockPhoto);
        prismaMock.photo.findMany.mockResolvedValueOnce([]); // After deletion
        deleteFromDrive.mockResolvedValue(true);

        const result = await photoService.deletePhoto(1, null, true);

        expect(result.success).toBe(true);
        expect(prismaMock.photo.delete).toHaveBeenCalledWith({ where: { driveId: 'drive123' } });
      });
    });

    describe('Owner permissions', () => {
      it('should allow owner to delete their own photo', async () => {
        prismaMock.photo.findMany.mockResolvedValueOnce([mockPhoto]);
        prismaMock.photo.delete.mockResolvedValue(mockPhoto);
        prismaMock.photo.findMany.mockResolvedValueOnce([]);
        deleteFromDrive.mockResolvedValue(true);

        const result = await photoService.deletePhoto(1, 'uploader_123', false);

        expect(result.success).toBe(true);
        expect(prismaMock.photo.delete).toHaveBeenCalled();
      });

      it('should prevent non-owner from deleting others photos', async () => {
        prismaMock.photo.findMany.mockResolvedValue([mockPhoto]);

        await expect(photoService.deletePhoto(1, 'different_uploader', false)).rejects.toThrow(
          'You can only delete photos you uploaded'
        );
      });
    });

    describe('Orphaned face cleanup', () => {
      it('should delete face when last photo containing it is deleted', async () => {
        const mockFace = {
          id: 1,
          faceId: 'person_1',
          thumbnailDriveId: 'thumb_person_1',
          descriptors: '[]',
          descriptor: '[]',
          metadata: '{}',
        };

        prismaMock.photo.findMany
          .mockResolvedValueOnce([mockPhoto]) // findAll() before delete
          .mockResolvedValueOnce([]); // findAll() after delete - no photos with person_1

        prismaMock.photo.delete.mockResolvedValue(mockPhoto);
        prismaMock.face.findUnique.mockResolvedValue(mockFace);
        prismaMock.face.delete.mockResolvedValue(mockFace);
        deleteFromDrive.mockResolvedValue(true);

        const result = await photoService.deletePhoto(1, 'uploader_123', false);

        expect(result.success).toBe(true);
        expect(result.orphanedFacesDeleted).toContain('person_1');
        expect(prismaMock.face.delete).toHaveBeenCalledWith({ where: { faceId: 'person_1' } });
        expect(deleteFromDrive).toHaveBeenCalledWith('thumb_person_1');
      });

      it('should not delete face that still appears in other photos', async () => {
        const otherPhoto = {
          id: 2,
          driveId: 'drive456',
          faceIds: '["person_1"]',
          faceBoxes: '[]',
        };

        prismaMock.photo.findMany
          .mockResolvedValueOnce([mockPhoto])
          .mockResolvedValueOnce([otherPhoto]); // person_1 still in other photo

        prismaMock.photo.delete.mockResolvedValue(mockPhoto);
        deleteFromDrive.mockResolvedValue(true);

        const result = await photoService.deletePhoto(1, 'uploader_123', false);

        expect(result.success).toBe(true);
        expect(result.orphanedFacesDeleted).toEqual([]);
        expect(prismaMock.face.delete).not.toHaveBeenCalled();
      });
    });

    describe('Error handling', () => {
      it('should throw NotFoundError when photo does not exist', async () => {
        prismaMock.photo.findMany.mockResolvedValue([]); // No photos

        await expect(photoService.deletePhoto(999, 'uploader_123', false)).rejects.toThrow(
          'Photo 999 not found'
        );
      });

      it('should throw ValidationError for invalid photoId', async () => {
        await expect(photoService.deletePhoto(null, 'uploader_123', false)).rejects.toThrow(
          'photoId is required and must be a number'
        );

        await expect(photoService.deletePhoto('abc', 'uploader_123', false)).rejects.toThrow(
          'photoId is required and must be a number'
        );
      });

      it('should handle Drive deletion failures gracefully', async () => {
        prismaMock.photo.findMany.mockResolvedValue([mockPhoto]);
        deleteFromDrive.mockRejectedValue(new Error('Drive API error'));

        await expect(photoService.deletePhoto(1, 'uploader_123', false)).rejects.toThrow(
          'Failed to delete photo from Drive'
        );

        // Database should not be modified if Drive deletion fails
        expect(prismaMock.photo.delete).not.toHaveBeenCalled();
      });
    });

    describe('Edge cases', () => {
      it('should handle photo with no faces', async () => {
        const photoNoFaces = {
          ...mockPhoto,
          faceIds: '[]',
          mainFaceId: null,
        };

        prismaMock.photo.findMany
          .mockResolvedValueOnce([photoNoFaces])
          .mockResolvedValueOnce([]); // After deletion

        prismaMock.photo.delete.mockResolvedValue(photoNoFaces);
        deleteFromDrive.mockResolvedValue(true);

        const result = await photoService.deletePhoto(1, 'uploader_123', false);

        expect(result.success).toBe(true);
        expect(result.orphanedFacesDeleted || []).toEqual([]);
      });
    });
  });
});
