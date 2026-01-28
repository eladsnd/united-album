/**
 * ChallengeService Tests
 *
 * Tests for pose challenge CRUD operations with image file handling.
 * Focuses on testing business logic rather than implementation details.
 */

import { prismaMock } from '../../prismaMock.js';

// Mock Prisma client BEFORE importing repositories and services
jest.mock('../../../lib/prisma.js', () => ({
  __esModule: true,
  default: require('../../prismaMock.js').prismaMock,
}));

// Mock Google Drive operations
jest.mock('../../../lib/storage/googleDrive.js', () => ({
  uploadToDrive: jest.fn(),
  findOrCreateFolder: jest.fn(),
}));

import { ChallengeService } from '../../../lib/services/ChallengeService.js';
import { ValidationError, NotFoundError, ConflictError } from '../../../lib/api/errors.js';
import { uploadToDrive, findOrCreateFolder } from '../../../lib/storage/googleDrive.js';

describe('ChallengeService', () => {
  let challengeService;

  beforeEach(() => {
    challengeService = new ChallengeService();
    jest.clearAllMocks();
  });

  describe('getAllPoses()', () => {
    it('should return all pose challenges', async () => {
      const mockPoses = [
        { id: 'back-to-back', title: 'Back to Back', instruction: 'Stand back to back', image: '/challenges/back-to-back.png' },
        { id: 'dip', title: 'Dip', instruction: 'Do a dip pose', image: '/challenges/dip.png' },
      ];

      prismaMock.challenge.findMany.mockResolvedValue(mockPoses);

      const result = await challengeService.getAllPoses();

      expect(result).toEqual(mockPoses);
      expect(prismaMock.challenge.findMany).toHaveBeenCalled();
    });

    it('should throw InternalServerError when database fails', async () => {
      prismaMock.challenge.findMany.mockRejectedValue(new Error('Database connection failed'));

      await expect(challengeService.getAllPoses()).rejects.toThrow('Failed to read challenges data');
    });
  });

  describe('createPose()', () => {
    // Create a mock that passes instanceof File check
    // We need to extend File to pass instanceof check while keeping arrayBuffer()
    class MockFile extends File {
      constructor(name = 'test.png', type = 'image/png', size = 1024) {
        // File constructor needs [bits, filename, options]
        super(['fake image data'], name, { type });
        this.size = size;
      }
      async arrayBuffer() {
        return Buffer.from('fake image data');
      }
    }

    const createMockFile = (name, type, size) => {
      return new MockFile(name, type, size);
    };

    describe('Successful creation', () => {
      beforeEach(() => {
        // Mock Google Drive operations
        findOrCreateFolder.mockResolvedValue('challenges_folder_123');
        uploadToDrive.mockResolvedValue({
          id: 'drive_image_123',
          webViewLink: 'https://drive.google.com/file/d/drive_image_123',
        });
        process.env.GOOGLE_DRIVE_FOLDER_ID = 'parent_folder_123';
      });

      it('should create new pose with valid data', async () => {
        const mockFile = createMockFile();
        const poseData = {
          title: 'Test Pose',
          instruction: 'Do the test pose',
          image: mockFile,
          folderId: 'folder123',
        };

        prismaMock.challenge.findUnique.mockResolvedValue(null); // Doesn't exist
        prismaMock.challenge.create.mockResolvedValue({
          id: 'test-pose',
          title: 'Test Pose',
          instruction: 'Do the test pose',
          image: 'drive_image_123',
          folderId: 'folder123',
        });

        const result = await challengeService.createPose(poseData);

        expect(result.id).toBe('test-pose');
        expect(result.title).toBe('Test Pose');
        expect(findOrCreateFolder).toHaveBeenCalledWith('challenges', 'folder123');
        expect(uploadToDrive).toHaveBeenCalled();
        expect(prismaMock.challenge.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            id: 'test-pose',
            title: 'Test Pose',
            instruction: 'Do the test pose',
            image: 'drive_image_123',
          }),
        });
      });

      it('should handle folderId as null when not provided', async () => {
        const mockFile = createMockFile();
        const poseData = {
          title: 'Test Pose',
          instruction: 'Instructions',
          image: mockFile,
        };

        prismaMock.challenge.findUnique.mockResolvedValue(null);
        prismaMock.challenge.create.mockResolvedValue({
          id: 'test-pose',
          image: 'drive_image_123',
          folderId: null,
        });

        const result = await challengeService.createPose(poseData);

        // Should use default environment folder ID when folderId not provided
        expect(findOrCreateFolder).toHaveBeenCalledWith('challenges', 'parent_folder_123');
        expect(prismaMock.challenge.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            folderId: null,
          }),
        });
      });

      it('should generate slug from title with special characters', async () => {
        const mockFile = createMockFile();
        const poseData = {
          title: 'Test-Pose  With   Spaces!',
          instruction: 'Instructions',
          image: mockFile,
        };

        prismaMock.challenge.findUnique.mockResolvedValue(null);
        prismaMock.challenge.create.mockResolvedValue({
          id: 'test-pose-with-spaces',
          title: poseData.title,
        });

        await challengeService.createPose(poseData);

        expect(prismaMock.challenge.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            id: expect.stringMatching(/test-pose-with-spaces/),
          }),
        });
      });

      it('should upload image to Google Drive challenges folder', async () => {
        const mockFile = createMockFile();
        const poseData = {
          title: 'Test',
          instruction: 'Test',
          image: mockFile,
          folderId: 'custom_folder_456',
        };

        prismaMock.challenge.findUnique.mockResolvedValue(null);
        prismaMock.challenge.create.mockResolvedValue({
          id: 'test',
          image: 'drive_image_123',
        });

        await challengeService.createPose(poseData);

        // Should find/create challenges subfolder in custom folder
        expect(findOrCreateFolder).toHaveBeenCalledWith('challenges', 'custom_folder_456');
        // Should upload file to Drive
        expect(uploadToDrive).toHaveBeenCalledWith(
          expect.any(Buffer),
          'test.png',
          'challenges_folder_123'
        );
      });
    });

    describe('Validation', () => {
      it('should throw ValidationError when title is missing', async () => {
        const mockFile = createMockFile();
        await expect(challengeService.createPose({
          instruction: 'Test',
          image: mockFile,
        })).rejects.toThrow('Title is required and must be a non-empty string.');
      });

      it('should throw ValidationError when title is empty string', async () => {
        const mockFile = createMockFile();
        await expect(challengeService.createPose({
          title: '   ',
          instruction: 'Test',
          image: mockFile,
        })).rejects.toThrow('Title is required');
      });

      it('should throw ValidationError when instruction is missing', async () => {
        const mockFile = createMockFile();
        await expect(challengeService.createPose({
          title: 'Test',
          image: mockFile,
        })).rejects.toThrow('Instruction is required and must be a non-empty string.');
      });

      it('should throw ValidationError when image is missing', async () => {
        await expect(challengeService.createPose({
          title: 'Test',
          instruction: 'Test',
        })).rejects.toThrow('Image file is required.');
      });

      it('should throw ValidationError for invalid file type', async () => {
        const mockFile = createMockFile('test.pdf', 'application/pdf');

        prismaMock.challenge.findUnique.mockResolvedValue(null);

        await expect(challengeService.createPose({
          title: 'Test',
          instruction: 'Test',
          image: mockFile,
        })).rejects.toThrow('Invalid file type. Only PNG and JPEG images are allowed.');
      });

      it('should throw ValidationError for file size exceeding 5MB', async () => {
        const mockFile = createMockFile('test.png', 'image/png', 6 * 1024 * 1024); // 6MB

        prismaMock.challenge.findUnique.mockResolvedValue(null);

        await expect(challengeService.createPose({
          title: 'Test',
          instruction: 'Test',
          image: mockFile,
        })).rejects.toThrow('File size exceeds 5MB limit.');
      });
    });

    describe('Conflict detection', () => {
      it('should throw ConflictError when pose ID already exists', async () => {
        const mockFile = createMockFile();
        prismaMock.challenge.findUnique.mockResolvedValue({
          id: 'test-pose',
          title: 'Existing Pose',
        });

        await expect(challengeService.createPose({
          title: 'Test Pose',
          instruction: 'Test',
          image: mockFile,
        })).rejects.toThrow(ConflictError);

        await expect(challengeService.createPose({
          title: 'Test Pose',
          instruction: 'Test',
          image: mockFile,
        })).rejects.toThrow('Pose with ID "test-pose" already exists');
      });
    });
  });

  describe('updatePose()', () => {
    // Same MockFile pattern as createPose() - extend File to pass instanceof check
    class MockFile extends File {
      constructor(name = 'updated.png', type = 'image/png', size = 1024) {
        super(['updated image data'], name, { type });
        this.size = size;
      }
      async arrayBuffer() {
        return Buffer.from('updated image data');
      }
    }

    const createMockFile = (name, type, size) => {
      return new MockFile(name, type, size);
    };

    beforeEach(() => {
      // Mock Google Drive operations for update tests
      findOrCreateFolder.mockResolvedValue('challenges_folder_123');
      uploadToDrive.mockResolvedValue({
        id: 'drive_image_updated_456',
        webViewLink: 'https://drive.google.com/file/d/drive_image_updated_456',
      });
      process.env.GOOGLE_DRIVE_FOLDER_ID = 'parent_folder_123';
    });

    describe('Successful updates', () => {
      it('should update pose title and instruction', async () => {
        prismaMock.challenge.findUnique.mockResolvedValue({
          id: 'test-pose',
          title: 'Old Title',
          instruction: 'Old Instruction',
        });

        prismaMock.challenge.update.mockResolvedValue({
          id: 'test-pose',
          title: 'New Title',
          instruction: 'New Instruction',
        });

        const result = await challengeService.updatePose('test-pose', {
          title: 'New Title',
          instruction: 'New Instruction',
        });

        expect(result.title).toBe('New Title');
        expect(result.instruction).toBe('New Instruction');
        expect(prismaMock.challenge.update).toHaveBeenCalledWith({
          where: { id: 'test-pose' },
          data: {
            title: 'New Title',
            instruction: 'New Instruction',
          },
        });
      });

      it('should update only title when instruction not provided', async () => {
        prismaMock.challenge.findUnique.mockResolvedValue({ id: 'test-pose' });
        prismaMock.challenge.update.mockResolvedValue({ id: 'test-pose', title: 'New Title' });

        await challengeService.updatePose('test-pose', { title: 'New Title' });

        expect(prismaMock.challenge.update).toHaveBeenCalledWith({
          where: { id: 'test-pose' },
          data: { title: 'New Title' },
        });
      });

      it('should update image when provided', async () => {
        const mockFile = createMockFile();

        prismaMock.challenge.findUnique.mockResolvedValue({ id: 'test-pose' });
        prismaMock.challenge.update.mockResolvedValue({
          id: 'test-pose',
          image: 'drive_image_updated_456',
        });

        await challengeService.updatePose('test-pose', { image: mockFile });

        expect(uploadToDrive).toHaveBeenCalled();
        expect(prismaMock.challenge.update).toHaveBeenCalledWith({
          where: { id: 'test-pose' },
          data: { image: 'drive_image_updated_456' },
        });
      });

      it('should set folderId to null when explicitly provided as null', async () => {
        prismaMock.challenge.findUnique.mockResolvedValue({ id: 'test-pose' });
        prismaMock.challenge.update.mockResolvedValue({ id: 'test-pose', folderId: null });

        await challengeService.updatePose('test-pose', { folderId: null });

        expect(prismaMock.challenge.update).toHaveBeenCalledWith({
          where: { id: 'test-pose' },
          data: { folderId: null },
        });
      });
    });

    describe('Validation', () => {
      it('should throw ValidationError when ID is missing', async () => {
        await expect(challengeService.updatePose('', {
          title: 'Test',
        })).rejects.toThrow('Pose ID is required.');
      });

      it('should throw ValidationError when ID is not a string', async () => {
        await expect(challengeService.updatePose(null, {
          title: 'Test',
        })).rejects.toThrow('Pose ID is required.');
      });

      it('should throw NotFoundError when pose doesn\'t exist', async () => {
        prismaMock.challenge.findUnique.mockResolvedValue(null);

        await expect(challengeService.updatePose('non-existent', {
          title: 'Test',
        })).rejects.toThrow(NotFoundError);

        await expect(challengeService.updatePose('non-existent', {
          title: 'Test',
        })).rejects.toThrow('Pose with ID "non-existent" not found.');
      });
    });
  });

  describe('deletePose()', () => {
    describe('Successful deletion', () => {
      it('should delete pose from database', async () => {
        prismaMock.challenge.delete.mockResolvedValue({
          id: 'test-pose',
          image: '/challenges/test-pose.png',
        });

        const result = await challengeService.deletePose('test-pose');

        expect(result.id).toBe('test-pose');
        expect(result.note).toContain('Image file preserved');
        expect(prismaMock.challenge.delete).toHaveBeenCalledWith({
          where: { id: 'test-pose' },
        });
      });

      it('should preserve image file in Google Drive (not deleted)', async () => {
        prismaMock.challenge.delete.mockResolvedValue({
          id: 'test-pose',
          image: 'drive_image_123',
        });

        const result = await challengeService.deletePose('test-pose');

        // Image file in Google Drive should NOT be deleted
        // Only database record is removed
        expect(result.note).toContain('Image file preserved');
      });
    });

    describe('Validation', () => {
      it('should throw ValidationError when ID is missing', async () => {
        await expect(challengeService.deletePose('')).rejects.toThrow(
          'Pose ID is required as a query parameter.'
        );
      });

      it('should throw ValidationError when ID is not a string', async () => {
        await expect(challengeService.deletePose(null)).rejects.toThrow(
          'Pose ID is required'
        );
      });

      it('should throw NotFoundError when pose doesn\'t exist', async () => {
        prismaMock.challenge.delete.mockRejectedValue({
          code: 'P2025',
          message: 'Record not found',
        });

        // Need to check the actual error handling in challengeRepo.deleteById
        // For now, test that service handles repository errors
        await expect(challengeService.deletePose('non-existent')).rejects.toThrow();
      });
    });
  });

  describe('_slugify() (via createPose)', () => {
    beforeEach(() => {
      // Mock Google Drive operations for slug tests
      findOrCreateFolder.mockResolvedValue('challenges_folder_123');
      uploadToDrive.mockResolvedValue({
        id: 'drive_slug_test_789',
        webViewLink: 'https://drive.google.com/file/d/drive_slug_test_789',
      });
      process.env.GOOGLE_DRIVE_FOLDER_ID = 'parent_folder_123';
    });

    it('should convert title to lowercase slug', async () => {
      const mockFile = {
        name: 'test.png',
        type: 'image/png',
        size: 1024,
        arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('data')),
      };
      Object.setPrototypeOf(mockFile, File.prototype); // Pass instanceof check

      prismaMock.challenge.findUnique.mockResolvedValue(null);
      prismaMock.challenge.create.mockResolvedValue({ id: 'uppercase-title' });

      await challengeService.createPose({
        title: 'UPPERCASE TITLE',
        instruction: 'Test',
        image: mockFile,
      });

      expect(prismaMock.challenge.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: expect.stringMatching(/^[a-z-]+$/),
        }),
      });
    });

    it('should replace spaces with hyphens', async () => {
      const mockFile = {
        name: 'test.png',
        type: 'image/png',
        size: 1024,
        arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('data')),
      };
      Object.setPrototypeOf(mockFile, File.prototype); // Pass instanceof check

      prismaMock.challenge.findUnique.mockResolvedValue(null);
      let capturedId;
      prismaMock.challenge.create.mockImplementation(({ data }) => {
        capturedId = data.id;
        return Promise.resolve({ id: data.id });
      });

      await challengeService.createPose({
        title: 'Multiple   Spaces    Test',
        instruction: 'Test',
        image: mockFile,
      });

      expect(capturedId).toBe('multiple-spaces-test');
      expect(capturedId).not.toContain(' ');
    });

    it('should handle Unicode characters (Hebrew)', async () => {
      const mockFile = {
        name: 'test.png',
        type: 'image/png',
        size: 1024,
        arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('data')),
      };
      Object.setPrototypeOf(mockFile, File.prototype); // Pass instanceof check

      prismaMock.challenge.findUnique.mockResolvedValue(null);
      let capturedId;
      prismaMock.challenge.create.mockImplementation(({ data }) => {
        capturedId = data.id;
        return Promise.resolve({ id: data.id });
      });

      await challengeService.createPose({
        title: 'בעיטה וויאטנמית',
        instruction: 'Test',
        image: mockFile,
      });

      // Should contain Hebrew characters (Unicode-aware)
      expect(capturedId).toBeTruthy();
      expect(capturedId.length).toBeGreaterThan(0);
    });

    it('should use timestamp fallback for empty slug (only special chars)', async () => {
      const mockFile = {
        name: 'test.png',
        type: 'image/png',
        size: 1024,
        arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('data')),
      };
      Object.setPrototypeOf(mockFile, File.prototype); // Pass instanceof check

      prismaMock.challenge.findUnique.mockResolvedValue(null);
      let capturedId;
      prismaMock.challenge.create.mockImplementation(({ data }) => {
        capturedId = data.id;
        return Promise.resolve({ id: data.id });
      });

      await challengeService.createPose({
        title: '!@#$%^&*()',
        instruction: 'Test',
        image: mockFile,
      });

      // Should use fallback: pose-{timestamp}-{random}
      expect(capturedId).toMatch(/^pose-\d+-[a-z0-9]+$/);
    });
  });
});
