/**
 * UploadService Test Suite (TDD)
 *
 * Tests for the Upload business logic service.
 * Service layer pattern - isolates business logic from HTTP/routing concerns.
 */

import { UploadService } from '../../../lib/services/UploadService';
import { ValidationError, InternalServerError } from '../../../lib/api/errors';
import * as googleDrive from '../../../lib/googleDrive';
import * as photoStorage from '../../../lib/photoStorage';

// Mock dependencies
jest.mock('../../../lib/googleDrive');
jest.mock('../../../lib/photoStorage');

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
      googleDrive.uploadToDrive.mockResolvedValue({
        id: 'drive_123',
        webViewLink: 'https://drive.google.com/file/d/drive_123',
      });

      // Mock successful metadata save
      const savedPhoto = {
        id: 12345,
        driveId: 'drive_123',
        name: 'test-photo.jpg',
      };
      photoStorage.savePhoto.mockResolvedValue(savedPhoto);

      const result = await uploadService.processUpload(mockFormData);

      expect(result).toEqual({
        success: true,
        photo: savedPhoto,
      });

      // Verify Drive upload was called with correct params
      expect(googleDrive.uploadToDrive).toHaveBeenCalledWith(
        expect.any(Buffer),
        'test-photo.jpg',
        'test-folder-id'
      );

      // Verify photo metadata was saved
      expect(photoStorage.savePhoto).toHaveBeenCalledWith({
        id: expect.any(Number),
        name: 'test-photo.jpg',
        driveId: 'drive_123',
        url: '/api/image/drive_123',
        mainFaceId: 'unknown',
        faceIds: [],
        faceBoxes: [],
        poseId: 'test-pose',
        uploaderId: 'uploader_123',
        timestamp: expect.any(String),
      });
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
      expect(googleDrive.uploadToDrive).not.toHaveBeenCalled();
      expect(photoStorage.savePhoto).not.toHaveBeenCalled();
    });

    it('should use default folder ID from env when not provided', async () => {
      process.env.GOOGLE_DRIVE_FOLDER_ID = 'default-folder';
      mockFormData.get.mockImplementation((key) => {
        if (key === 'file') return mockFile;
        if (key === 'folderId') return null; // No folder ID provided
        if (key === 'poseId') return 'test-pose';
        return null;
      });

      googleDrive.uploadToDrive.mockResolvedValue({ id: 'drive_123' });
      photoStorage.savePhoto.mockResolvedValue({ id: 1, driveId: 'drive_123' });

      await uploadService.processUpload(mockFormData);

      expect(googleDrive.uploadToDrive).toHaveBeenCalledWith(
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

      googleDrive.uploadToDrive.mockResolvedValue({ id: 'drive_123' });
      photoStorage.savePhoto.mockResolvedValue({ id: 1 });

      await uploadService.processUpload(mockFormData);

      expect(photoStorage.savePhoto).toHaveBeenCalledWith(
        expect.objectContaining({
          poseId: 'unknown_pose',
        })
      );
    });

    it('should allow null uploaderId (anonymous uploads)', async () => {
      mockFormData.get.mockImplementation((key) => {
        if (key === 'file') return mockFile;
        if (key === 'folderId') return 'test-folder';
        if (key === 'poseId') return 'test-pose';
        if (key === 'uploaderId') return null; // No uploader ID
        return null;
      });

      googleDrive.uploadToDrive.mockResolvedValue({ id: 'drive_123' });
      photoStorage.savePhoto.mockResolvedValue({ id: 1 });

      await uploadService.processUpload(mockFormData);

      expect(photoStorage.savePhoto).toHaveBeenCalledWith(
        expect.objectContaining({
          uploaderId: null,
        })
      );
    });

    it('should throw error when Drive upload fails', async () => {
      googleDrive.uploadToDrive.mockRejectedValue(
        new Error('Drive API quota exceeded')
      );

      await expect(uploadService.processUpload(mockFormData))
        .rejects
        .toThrow(InternalServerError);

      await expect(uploadService.processUpload(mockFormData))
        .rejects
        .toThrow('Drive upload failed: Drive API quota exceeded');

      // Should not attempt to save metadata if upload fails
      expect(photoStorage.savePhoto).not.toHaveBeenCalled();
    });

    it('should throw error when metadata save fails', async () => {
      googleDrive.uploadToDrive.mockResolvedValue({ id: 'drive_123' });
      photoStorage.savePhoto.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(uploadService.processUpload(mockFormData))
        .rejects
        .toThrow(InternalServerError);

      await expect(uploadService.processUpload(mockFormData))
        .rejects
        .toThrow('Failed to save photo metadata: Database connection failed');
    });

    it('should create photo with timestamp', async () => {
      const beforeTime = new Date().toISOString();

      googleDrive.uploadToDrive.mockResolvedValue({ id: 'drive_123' });
      photoStorage.savePhoto.mockResolvedValue({ id: 1 });

      await uploadService.processUpload(mockFormData);

      const afterTime = new Date().toISOString();
      const savedPhoto = photoStorage.savePhoto.mock.calls[0][0];

      expect(savedPhoto.timestamp).toBeDefined();
      expect(savedPhoto.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO format
      expect(savedPhoto.timestamp >= beforeTime).toBe(true);
      expect(savedPhoto.timestamp <= afterTime).toBe(true);
    });

    it('should create photo with auto-generated ID', async () => {
      googleDrive.uploadToDrive.mockResolvedValue({ id: 'drive_123' });
      photoStorage.savePhoto.mockResolvedValue({ id: 1 });

      await uploadService.processUpload(mockFormData);

      const savedPhoto = photoStorage.savePhoto.mock.calls[0][0];

      expect(savedPhoto.id).toBeDefined();
      expect(typeof savedPhoto.id).toBe('number');
      expect(savedPhoto.id).toBeGreaterThan(0);
    });

    it('should create proxy URL for photo', async () => {
      googleDrive.uploadToDrive.mockResolvedValue({ id: 'drive_456' });
      photoStorage.savePhoto.mockResolvedValue({ id: 1 });

      await uploadService.processUpload(mockFormData);

      const savedPhoto = photoStorage.savePhoto.mock.calls[0][0];

      expect(savedPhoto.url).toBe('/api/image/drive_456');
    });

    it('should initialize photo with empty face data', async () => {
      googleDrive.uploadToDrive.mockResolvedValue({ id: 'drive_123' });
      photoStorage.savePhoto.mockResolvedValue({ id: 1 });

      await uploadService.processUpload(mockFormData);

      const savedPhoto = photoStorage.savePhoto.mock.calls[0][0];

      expect(savedPhoto.mainFaceId).toBe('unknown');
      expect(savedPhoto.faceIds).toEqual([]);
      expect(savedPhoto.faceBoxes).toEqual([]);
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
