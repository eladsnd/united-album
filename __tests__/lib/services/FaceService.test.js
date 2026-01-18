/**
 * FaceService Tests
 *
 * Tests for face detection metadata updates with thumbnail uploads.
 * Focuses on testing business logic rather than implementation details.
 */

import { prismaMock } from '../../prismaMock.js';

// Mock Prisma client BEFORE importing repositories and services
jest.mock('../../../lib/prisma.js', () => ({
  __esModule: true,
  default: require('../../prismaMock.js').prismaMock,
}));

import { FaceService } from '../../../lib/services/FaceService.js';
import { uploadToDrive, findOrCreateFolder } from '../../../lib/googleDrive.js';

// Mock Google Drive operations
jest.mock('../../../lib/googleDrive.js', () => ({
  uploadToDrive: jest.fn(),
  findOrCreateFolder: jest.fn(),
}));

describe('FaceService', () => {
  let faceService;

  beforeEach(() => {
    faceService = new FaceService();
    jest.clearAllMocks();
    process.env.GOOGLE_DRIVE_FOLDER_ID = 'folder123';
  });

  describe('updatePhotoFaces()', () => {
    // Create a proper FormData mock with entries() support
    const createMockFormData = (data) => {
      const entries = Object.entries(data);
      return {
        get: (key) => {
          const entry = entries.find(([k]) => k === key);
          return entry ? entry[1] : null;
        },
        entries: function* () {
          for (const [key, value] of entries) {
            yield [key, value];
          }
        },
      };
    };

    describe('Validation', () => {
      it('should throw ValidationError for invalid photoId', async () => {
        const formData = createMockFormData({
          photoId: 'abc',
          driveId: 'drive123',
          faceIds: '',
          mainFaceId: 'unknown',
          faceBoxes: '[]',
        });

        await expect(faceService.updatePhotoFaces(formData)).rejects.toThrow(
          'Invalid photo ID: "abc". Must be a positive integer.'
        );
      });

      it('should throw ValidationError for negative photoId', async () => {
        const formData = createMockFormData({
          photoId: -1,
          driveId: 'drive123',
          faceIds: '',
          mainFaceId: 'unknown',
          faceBoxes: '[]',
        });

        await expect(faceService.updatePhotoFaces(formData)).rejects.toThrow(
          'Invalid photo ID: "-1". Must be a positive integer.'
        );
      });

      it('should throw ValidationError for invalid faceBoxes JSON', async () => {
        const formData = createMockFormData({
          photoId: 1,
          driveId: 'drive123',
          faceIds: 'person_1',
          mainFaceId: 'person_1',
          faceBoxes: 'not-valid-json',
        });

        await expect(faceService.updatePhotoFaces(formData)).rejects.toThrow(
          'Invalid face boxes JSON'
        );
      });

      it('should throw ValidationError when face IDs and boxes count mismatch', async () => {
        const formData = createMockFormData({
          photoId: 1,
          driveId: 'drive123',
          faceIds: 'person_1,person_2',
          mainFaceId: 'person_1',
          faceBoxes: JSON.stringify([{ x: 10, y: 20, width: 30, height: 40 }]), // Only 1 box for 2 IDs
        });

        await expect(faceService.updatePhotoFaces(formData)).rejects.toThrow(
          'Face data mismatch: 2 face IDs but 1 face boxes'
        );
      });
    });

    describe('Successful updates', () => {
      it('should update photo with face data (no thumbnails)', async () => {
        const formData = createMockFormData({
          photoId: 1,
          driveId: 'drive123',
          faceIds: 'person_1,person_2',
          mainFaceId: 'person_1',
          faceBoxes: JSON.stringify([
            { x: 10, y: 20, width: 30, height: 40 },
            { x: 50, y: 60, width: 70, height: 80 },
          ]),
        });

        // Mock the Prisma update to return deserialized data
        prismaMock.photo.update.mockResolvedValue({
          id: 1,
          driveId: 'drive123',
          mainFaceId: 'person_1',
          faceIds: JSON.stringify(['person_1', 'person_2']),
          faceBoxes: JSON.stringify([
            { x: 10, y: 20, width: 30, height: 40 },
            { x: 50, y: 60, width: 70, height: 80 },
          ]),
          timestamp: new Date(),
        });

        const result = await faceService.updatePhotoFaces(formData);

        expect(result.success).toBe(true);
        expect(result.photo).toBeDefined();
        expect(result.photo.faceIds).toEqual(['person_1', 'person_2']); // Deserialized
        expect(result.thumbnailsUploaded).toBe(0);
      });

      it('should upload thumbnails and update photo', async () => {
        const thumbnailBlob = {
          arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('fake image data')),
          type: 'image/jpeg',
        };

        const formData = createMockFormData({
          photoId: 1,
          driveId: 'drive123',
          faceIds: 'person_1',
          mainFaceId: 'person_1',
          faceBoxes: JSON.stringify([{ x: 10, y: 20, width: 30, height: 40 }]),
          faceThumbnail_person_1: thumbnailBlob,
        });

        findOrCreateFolder.mockResolvedValue('faces_folder_123');
        uploadToDrive.mockResolvedValue({ id: 'thumb123', webViewLink: 'http://example.com' });
        prismaMock.face.findUnique.mockResolvedValue({
          faceId: 'person_1',
          descriptor: JSON.stringify([0.1, 0.2, 0.3]),
          descriptors: JSON.stringify([[0.1, 0.2, 0.3]]),
          metadata: JSON.stringify({ thumbnailDriveId: 'thumb123' }),
        });
        prismaMock.face.upsert.mockResolvedValue({
          faceId: 'person_1',
          descriptor: JSON.stringify([0.1, 0.2, 0.3]),
          descriptors: JSON.stringify([[0.1, 0.2, 0.3]]),
          metadata: JSON.stringify({ thumbnailDriveId: 'thumb123' }),
        });
        prismaMock.photo.update.mockResolvedValue({
          id: 1,
          driveId: 'drive123',
          mainFaceId: 'person_1',
          faceIds: JSON.stringify(['person_1']),
          faceBoxes: JSON.stringify([{ x: 10, y: 20, width: 30, height: 40 }]),
          timestamp: new Date(),
        });

        const result = await faceService.updatePhotoFaces(formData);

        expect(result.success).toBe(true);
        expect(result.thumbnailsUploaded).toBe(1);
        expect(findOrCreateFolder).toHaveBeenCalledWith('faces', 'folder123');
        expect(uploadToDrive).toHaveBeenCalled();
      });
    });

    describe('Error handling', () => {
      it('should throw NotFoundError when photo does not exist', async () => {
        const formData = createMockFormData({
          photoId: 999,
          driveId: 'drive123',
          faceIds: '',
          mainFaceId: 'unknown',
          faceBoxes: '[]',
        });

        // Mock Prisma to return null (photo not found)
        prismaMock.photo.update.mockResolvedValue(null);

        await expect(faceService.updatePhotoFaces(formData)).rejects.toThrow('Photo 999 not found');
      });

      it('should throw InternalServerError when thumbnail upload fails', async () => {
        const thumbnailBlob = {
          arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('fake image data')),
          type: 'image/jpeg',
        };

        const formData = createMockFormData({
          photoId: 1,
          driveId: 'drive123',
          faceIds: 'person_1',
          mainFaceId: 'person_1',
          faceBoxes: JSON.stringify([{ x: 10, y: 20, width: 30, height: 40 }]),
          faceThumbnail_person_1: thumbnailBlob,
        });

        findOrCreateFolder.mockRejectedValue(new Error('Drive API error'));

        await expect(faceService.updatePhotoFaces(formData)).rejects.toThrow(
          'Failed to upload thumbnails: Drive API error'
        );
      });

      it('should throw InternalServerError when photo update fails', async () => {
        const formData = createMockFormData({
          photoId: 1,
          driveId: 'drive123',
          faceIds: 'person_1',
          mainFaceId: 'person_1',
          faceBoxes: JSON.stringify([{ x: 10, y: 20, width: 30, height: 40 }]),
        });

        prismaMock.photo.update.mockRejectedValue(new Error('Database error'));

        await expect(faceService.updatePhotoFaces(formData)).rejects.toThrow(
          'Failed to update photo: Database error'
        );
      });
    });

    describe('Edge cases', () => {
      it('should handle photo with no faces', async () => {
        const formData = createMockFormData({
          photoId: 1,
          driveId: 'drive123',
          faceIds: '',
          mainFaceId: 'unknown',
          faceBoxes: '[]',
        });

        prismaMock.photo.update.mockResolvedValue({
          id: 1,
          driveId: 'drive123',
          mainFaceId: 'unknown',
          faceIds: JSON.stringify([]),
          faceBoxes: JSON.stringify([]),
          timestamp: new Date(),
        });

        const result = await faceService.updatePhotoFaces(formData);

        expect(result.success).toBe(true);
        expect(result.photo.faceIds).toEqual([]);
        expect(result.thumbnailsUploaded).toBe(0);
      });

      it('should handle empty faceIds string correctly', async () => {
        const formData = createMockFormData({
          photoId: 1,
          driveId: 'drive123',
          faceIds: '   ,  ,  ', // Whitespace and empty values
          mainFaceId: 'unknown',
          faceBoxes: '[]',
        });

        prismaMock.photo.update.mockResolvedValue({
          id: 1,
          driveId: 'drive123',
          mainFaceId: 'unknown',
          faceIds: JSON.stringify([]),
          faceBoxes: JSON.stringify([]),
          timestamp: new Date(),
        });

        const result = await faceService.updatePhotoFaces(formData);

        expect(result.success).toBe(true);
        expect(result.photo.faceIds).toEqual([]);
      });
    });
  });
});
