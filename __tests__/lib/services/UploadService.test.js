/**
 * UploadService Tests
 *
 * Tests for photo upload workflow with validation, Drive upload, and metadata persistence.
 * Focuses on testing business logic rather than implementation details.
 */

import { prismaMock } from '../../prismaMock.js';

// Mock Prisma client BEFORE importing repositories and services
jest.mock('../../../lib/prisma.js', () => ({
  __esModule: true,
  default: require('../../prismaMock.js').prismaMock,
}));

import { UploadService } from '../../../lib/services/UploadService';
import { ValidationError, InternalServerError } from '../../../lib/api/errors';
import { uploadToDrive } from '../../../lib/googleDrive';

// Mock Google Drive operations
jest.mock('../../../lib/googleDrive', () => ({
  uploadToDrive: jest.fn(),
}));

describe('UploadService', () => {
  let uploadService;
  let mockFile;
  let mockFormData;

  beforeEach(() => {
    jest.clearAllMocks();
    uploadService = new UploadService();

    // Create mock file
    mockFile = {
      name: 'test-photo.jpg',
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1024)),
    };

    // Create mock FormData
    mockFormData = {
      get: jest.fn((key) => {
        const data = {
          file: mockFile,
          folderId: 'test-folder-id',
          poseId: 'test-pose',
          uploaderId: 'uploader_123',
        };
        return data[key];
      }),
    };
  });

  describe('processUpload', () => {
    it('should successfully upload photo and save metadata', async () => {
      // Mock successful Drive upload
      uploadToDrive.mockResolvedValue({
        id: 'drive_123',
        webViewLink: 'https://drive.google.com/file/d/drive_123',
      });

      // Mock successful metadata save via Prisma
      prismaMock.photo.upsert.mockResolvedValue({
        id: 1,
        driveId: 'drive_123',
        name: 'test-photo.jpg',
        url: '/api/image/drive_123',
        mainFaceId: 'unknown',
        faceIds: JSON.stringify([]),
        faceBoxes: JSON.stringify([]),
        poseId: 'test-pose',
        uploaderId: 'uploader_123',
        timestamp: new Date(),
      });

      const result = await uploadService.processUpload(mockFormData);

      expect(result.success).toBe(true);
      expect(result.photo).toBeDefined();
      expect(result.photo.driveId).toBe('drive_123');
      expect(result.photo.faceIds).toEqual([]); // Deserialized by repository

      // Verify Drive upload was called with correct params
      expect(uploadToDrive).toHaveBeenCalledWith(
        expect.any(Buffer),
        'test-photo.jpg',
        'test-folder-id'
      );

      // Verify photo was saved via Prisma
      expect(prismaMock.photo.upsert).toHaveBeenCalled();
    });

    it('should throw ValidationError when no file is provided', async () => {
      mockFormData.get.mockReturnValue(null);

      await expect(uploadService.processUpload(mockFormData))
        .rejects
        .toThrow(ValidationError);

      await expect(uploadService.processUpload(mockFormData))
        .rejects
        .toThrow('No file uploaded');

      // Should not attempt Drive upload or metadata save
      expect(uploadToDrive).not.toHaveBeenCalled();
      expect(prismaMock.photo.upsert).not.toHaveBeenCalled();
    });

    it('should use default folder ID from env when not provided', async () => {
      process.env.GOOGLE_DRIVE_FOLDER_ID = 'default-folder';
      mockFormData.get.mockImplementation((key) => {
        if (key === 'file') return mockFile;
        if (key === 'folderId') return null; // No folder ID provided
        if (key === 'poseId') return 'test-pose';
        return null;
      });

      uploadToDrive.mockResolvedValue({ id: 'drive_123' });
      prismaMock.photo.upsert.mockResolvedValue({
        id: 1,
        driveId: 'drive_123',
        faceIds: JSON.stringify([]),
        faceBoxes: JSON.stringify([]),
        timestamp: new Date(),
      });

      await uploadService.processUpload(mockFormData);

      expect(uploadToDrive).toHaveBeenCalledWith(
        expect.any(Buffer),
        'test-photo.jpg',
        'default-folder'
      );
    });

    it('should use "unknown_pose" as default when pose ID not provided', async () => {
      mockFormData.get.mockImplementation((key) => {
        if (key === 'file') return mockFile;
        if (key === 'folderId') return 'test-folder';
        if (key === 'poseId') return null; // No pose ID
        if (key === 'uploaderId') return 'uploader_123';
        return null;
      });

      uploadToDrive.mockResolvedValue({ id: 'drive_123' });
      prismaMock.photo.upsert.mockResolvedValue({
        id: 1,
        poseId: 'unknown_pose',
        faceIds: JSON.stringify([]),
        faceBoxes: JSON.stringify([]),
        timestamp: new Date(),
      });

      const result = await uploadService.processUpload(mockFormData);

      expect(result.photo.poseId).toBe('unknown_pose');
    });

    it('should allow null uploaderId (anonymous uploads)', async () => {
      mockFormData.get.mockImplementation((key) => {
        if (key === 'file') return mockFile;
        if (key === 'folderId') return 'test-folder';
        if (key === 'poseId') return 'test-pose';
        if (key === 'uploaderId') return null; // No uploader ID
        return null;
      });

      uploadToDrive.mockResolvedValue({ id: 'drive_123' });
      prismaMock.photo.upsert.mockResolvedValue({
        id: 1,
        uploaderId: null,
        faceIds: JSON.stringify([]),
        faceBoxes: JSON.stringify([]),
        timestamp: new Date(),
      });

      const result = await uploadService.processUpload(mockFormData);

      expect(result.photo.uploaderId).toBeNull();
    });

    it('should throw error when Drive upload fails', async () => {
      uploadToDrive.mockRejectedValue(
        new Error('Drive API quota exceeded')
      );

      await expect(uploadService.processUpload(mockFormData))
        .rejects
        .toThrow(InternalServerError);

      await expect(uploadService.processUpload(mockFormData))
        .rejects
        .toThrow('Drive upload failed: Drive API quota exceeded');

      // Should not attempt to save metadata if upload fails
      expect(prismaMock.photo.upsert).not.toHaveBeenCalled();
    });

    it('should throw error when metadata save fails', async () => {
      uploadToDrive.mockResolvedValue({ id: 'drive_123' });
      prismaMock.photo.upsert.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(uploadService.processUpload(mockFormData))
        .rejects
        .toThrow(InternalServerError);

      // BaseRepository wraps the error message
      await expect(uploadService.processUpload(mockFormData))
        .rejects
        .toThrow('Failed to save photo metadata');
    });

    it('should create photo with timestamp', async () => {
      const beforeTime = new Date();

      uploadToDrive.mockResolvedValue({ id: 'drive_123' });
      prismaMock.photo.upsert.mockResolvedValue({
        id: 1,
        driveId: 'drive_123',
        faceIds: JSON.stringify([]),
        faceBoxes: JSON.stringify([]),
        timestamp: new Date(),
      });

      const result = await uploadService.processUpload(mockFormData);

      const afterTime = new Date();

      expect(result.photo.timestamp).toBeDefined();
      expect(result.photo.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(result.photo.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should return photo with database-generated ID', async () => {
      uploadToDrive.mockResolvedValue({ id: 'drive_123' });
      prismaMock.photo.upsert.mockResolvedValue({
        id: 42, // Database auto-generated ID
        driveId: 'drive_123',
        faceIds: JSON.stringify([]),
        faceBoxes: JSON.stringify([]),
        timestamp: new Date(),
      });

      const result = await uploadService.processUpload(mockFormData);

      // ID is generated by database (Prisma), not by service
      expect(result.photo.id).toBe(42);
      expect(typeof result.photo.id).toBe('number');
    });

    it('should create proxy URL for photo', async () => {
      uploadToDrive.mockResolvedValue({ id: 'drive_456' });
      prismaMock.photo.upsert.mockResolvedValue({
        id: 1,
        driveId: 'drive_456',
        url: '/api/image/drive_456',
        faceIds: JSON.stringify([]),
        faceBoxes: JSON.stringify([]),
        timestamp: new Date(),
      });

      const result = await uploadService.processUpload(mockFormData);

      expect(result.photo.url).toBe('/api/image/drive_456');
    });

    it('should initialize photo with empty face data', async () => {
      uploadToDrive.mockResolvedValue({ id: 'drive_123' });
      prismaMock.photo.upsert.mockResolvedValue({
        id: 1,
        mainFaceId: 'unknown',
        faceIds: JSON.stringify([]),
        faceBoxes: JSON.stringify([]),
        timestamp: new Date(),
      });

      const result = await uploadService.processUpload(mockFormData);

      expect(result.photo.mainFaceId).toBe('unknown');
      expect(result.photo.faceIds).toEqual([]);
      expect(result.photo.faceBoxes).toEqual([]);
    });
  });

  describe('validateCredentials', () => {
    it('should return true when credentials are present', () => {
      process.env.GOOGLE_CLIENT_ID = 'test_client_id';
      process.env.GOOGLE_REFRESH_TOKEN = 'test_refresh_token';

      const result = uploadService.validateCredentials();

      expect(result).toBe(true);
    });

    it('should return false when GOOGLE_CLIENT_ID is missing', () => {
      delete process.env.GOOGLE_CLIENT_ID;
      process.env.GOOGLE_REFRESH_TOKEN = 'test_refresh_token';

      const result = uploadService.validateCredentials();

      expect(result).toBe(false);
    });

    it('should return false when GOOGLE_REFRESH_TOKEN is missing', () => {
      process.env.GOOGLE_CLIENT_ID = 'test_client_id';
      delete process.env.GOOGLE_REFRESH_TOKEN;

      const result = uploadService.validateCredentials();

      expect(result).toBe(false);
    });

    it('should return false when both credentials are missing', () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_REFRESH_TOKEN;

      const result = uploadService.validateCredentials();

      expect(result).toBe(false);
    });
  });
});
