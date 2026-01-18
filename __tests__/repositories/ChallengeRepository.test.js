/**
 * ChallengeRepository Tests (TDD)
 *
 * Tests for challenge/pose data access layer including:
 * - CRUD operations (create, findAll, findById, update, delete)
 * - Existence checks
 * - No special serialization needed (only string fields)
 * - Error handling and edge cases
 */

import { prismaMock } from '../prismaMock.js';

// Mock Prisma client BEFORE importing repository
jest.mock('../../lib/prisma.js', () => ({
  __esModule: true,
  default: require('../prismaMock.js').prismaMock,
}));

import { ChallengeRepository } from '../../lib/repositories/ChallengeRepository.js';

describe('ChallengeRepository', () => {
  let challengeRepo;

  beforeEach(() => {
    challengeRepo = new ChallengeRepository();
    jest.clearAllMocks();
  });

  describe('getModel()', () => {
    it('should return "challenge" as model name', () => {
      expect(challengeRepo.getModel()).toBe('challenge');
    });
  });

  describe('findAll()', () => {
    it('should return all challenges ordered by createdAt ascending', async () => {
      const mockChallenges = [
        {
          id: 'dip',
          title: 'Dip',
          instruction: 'Classic dip pose',
          image: '/challenges/dip.png',
          folderId: null,
          createdAt: new Date('2025-01-01'),
        },
        {
          id: 'whisper',
          title: 'Whisper',
          instruction: 'Whisper something sweet',
          image: '/challenges/whisper.png',
          folderId: null,
          createdAt: new Date('2025-01-02'),
        },
      ];

      prismaMock.challenge.findMany.mockResolvedValue(mockChallenges);

      const result = await challengeRepo.findAll();

      expect(prismaMock.challenge.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'asc' },
      });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('dip');
      expect(result[1].id).toBe('whisper');
    });

    it('should return empty array when no challenges exist', async () => {
      prismaMock.challenge.findMany.mockResolvedValue([]);

      const result = await challengeRepo.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById()', () => {
    it('should find challenge by id', async () => {
      const mockChallenge = {
        id: 'dip',
        title: 'Dip',
        instruction: 'Classic dip pose',
        image: '/challenges/dip.png',
        folderId: null,
        createdAt: new Date(),
      };

      prismaMock.challenge.findUnique.mockResolvedValue(mockChallenge);

      const result = await challengeRepo.findById('dip');

      expect(prismaMock.challenge.findUnique).toHaveBeenCalledWith({
        where: { id: 'dip' },
      });

      expect(result.id).toBe('dip');
      expect(result.title).toBe('Dip');
    });

    it('should return null if challenge not found', async () => {
      prismaMock.challenge.findUnique.mockResolvedValue(null);

      const result = await challengeRepo.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('create()', () => {
    it('should create new challenge', async () => {
      const newChallenge = {
        id: 'back-to-back',
        title: 'Back to Back',
        instruction: 'Stand back to back',
        image: '/challenges/back-to-back.png',
        folderId: null,
      };

      const mockCreatedChallenge = {
        ...newChallenge,
        createdAt: new Date(),
      };

      prismaMock.challenge.create.mockResolvedValue(mockCreatedChallenge);

      const result = await challengeRepo.create(newChallenge);

      expect(prismaMock.challenge.create).toHaveBeenCalledWith({
        data: newChallenge,
      });

      expect(result.id).toBe('back-to-back');
      expect(result.title).toBe('Back to Back');
    });

    it('should create challenge with folderId', async () => {
      const newChallenge = {
        id: 'kiss',
        title: 'Kiss',
        instruction: 'Kiss on the cheek',
        image: '/challenges/kiss.png',
        folderId: 'folder_123',
      };

      const mockCreatedChallenge = {
        ...newChallenge,
        createdAt: new Date(),
      };

      prismaMock.challenge.create.mockResolvedValue(mockCreatedChallenge);

      const result = await challengeRepo.create(newChallenge);

      expect(result.folderId).toBe('folder_123');
    });
  });

  describe('update()', () => {
    it('should update challenge by id', async () => {
      const updates = {
        title: 'Updated Dip',
        instruction: 'Updated instruction',
      };

      const mockUpdatedChallenge = {
        id: 'dip',
        title: 'Updated Dip',
        instruction: 'Updated instruction',
        image: '/challenges/dip.png',
        folderId: null,
        createdAt: new Date(),
      };

      prismaMock.challenge.update.mockResolvedValue(mockUpdatedChallenge);

      const result = await challengeRepo.update({ id: 'dip' }, updates);

      expect(prismaMock.challenge.update).toHaveBeenCalledWith({
        where: { id: 'dip' },
        data: updates,
      });

      expect(result.title).toBe('Updated Dip');
      expect(result.instruction).toBe('Updated instruction');
    });

    it('should update only image field', async () => {
      const updates = {
        image: '/challenges/dip-new.png',
      };

      const mockUpdatedChallenge = {
        id: 'dip',
        title: 'Dip',
        instruction: 'Classic dip pose',
        image: '/challenges/dip-new.png',
        folderId: null,
        createdAt: new Date(),
      };

      prismaMock.challenge.update.mockResolvedValue(mockUpdatedChallenge);

      const result = await challengeRepo.update({ id: 'dip' }, updates);

      expect(result.image).toBe('/challenges/dip-new.png');
    });

    it('should update folderId to null', async () => {
      const updates = {
        folderId: null,
      };

      const mockUpdatedChallenge = {
        id: 'dip',
        title: 'Dip',
        instruction: 'Classic dip pose',
        image: '/challenges/dip.png',
        folderId: null,
        createdAt: new Date(),
      };

      prismaMock.challenge.update.mockResolvedValue(mockUpdatedChallenge);

      const result = await challengeRepo.update({ id: 'dip' }, updates);

      expect(result.folderId).toBeNull();
    });
  });

  describe('deleteById()', () => {
    it('should delete challenge by id', async () => {
      const mockDeletedChallenge = {
        id: 'dip',
        title: 'Dip',
        instruction: 'Classic dip pose',
        image: '/challenges/dip.png',
        folderId: null,
        createdAt: new Date(),
      };

      prismaMock.challenge.delete.mockResolvedValue(mockDeletedChallenge);

      // Mock console.log to verify logging
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await challengeRepo.deleteById('dip');

      expect(prismaMock.challenge.delete).toHaveBeenCalledWith({
        where: { id: 'dip' },
      });

      expect(result.id).toBe('dip');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ChallengeRepository] Deleted challenge: dip'
      );

      consoleSpy.mockRestore();
    });

    it('should throw NotFoundError if challenge does not exist', async () => {
      // Prisma throws PrismaClientKnownRequestError with code P2025
      const prismaError = new Error('Record not found');
      prismaError.code = 'P2025';

      prismaMock.challenge.delete.mockRejectedValue(prismaError);

      await expect(challengeRepo.deleteById('nonexistent')).rejects.toThrow();
    });
  });

  describe('exists()', () => {
    it('should return true if challenge exists', async () => {
      const mockChallenge = {
        id: 'dip',
        title: 'Dip',
        instruction: 'Classic dip pose',
        image: '/challenges/dip.png',
        folderId: null,
        createdAt: new Date(),
      };

      prismaMock.challenge.findUnique.mockResolvedValue(mockChallenge);

      const result = await challengeRepo.exists('dip');

      expect(prismaMock.challenge.findUnique).toHaveBeenCalledWith({
        where: { id: 'dip' },
      });

      expect(result).toBe(true);
    });

    it('should return false if challenge does not exist', async () => {
      prismaMock.challenge.findUnique.mockResolvedValue(null);

      const result = await challengeRepo.exists('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('Integration scenarios', () => {
    it('should create and then find challenge', async () => {
      const newChallenge = {
        id: 'jump',
        title: 'Jump',
        instruction: 'Jump together',
        image: '/challenges/jump.png',
        folderId: null,
      };

      const mockCreatedChallenge = {
        ...newChallenge,
        createdAt: new Date(),
      };

      prismaMock.challenge.create.mockResolvedValue(mockCreatedChallenge);
      prismaMock.challenge.findUnique.mockResolvedValue(mockCreatedChallenge);

      // Create
      const created = await challengeRepo.create(newChallenge);
      expect(created.id).toBe('jump');

      // Find
      const found = await challengeRepo.findById('jump');
      expect(found.id).toBe('jump');
      expect(found.title).toBe('Jump');
    });

    it('should check existence before creating', async () => {
      const newChallenge = {
        id: 'dip',
        title: 'Dip',
        instruction: 'Classic dip pose',
        image: '/challenges/dip.png',
        folderId: null,
      };

      // Check if exists (returns true - already exists)
      prismaMock.challenge.findUnique.mockResolvedValue({
        ...newChallenge,
        createdAt: new Date(),
      });

      const exists = await challengeRepo.exists('dip');
      expect(exists).toBe(true);

      // Should NOT create if already exists
      expect(prismaMock.challenge.create).not.toHaveBeenCalled();
    });

    it('should update challenge and verify changes', async () => {
      const originalChallenge = {
        id: 'dip',
        title: 'Dip',
        instruction: 'Classic dip pose',
        image: '/challenges/dip.png',
        folderId: null,
        createdAt: new Date(),
      };

      const updatedChallenge = {
        ...originalChallenge,
        title: 'Romantic Dip',
        instruction: 'Romantic dip pose for couples',
      };

      prismaMock.challenge.update.mockResolvedValue(updatedChallenge);
      prismaMock.challenge.findUnique.mockResolvedValue(updatedChallenge);

      // Update
      const updated = await challengeRepo.update(
        { id: 'dip' },
        { title: 'Romantic Dip', instruction: 'Romantic dip pose for couples' }
      );

      expect(updated.title).toBe('Romantic Dip');

      // Verify
      const verified = await challengeRepo.findById('dip');
      expect(verified.title).toBe('Romantic Dip');
    });

    it('should list all challenges in creation order', async () => {
      const mockChallenges = [
        {
          id: 'dip',
          title: 'Dip',
          instruction: 'Classic dip',
          image: '/challenges/dip.png',
          folderId: null,
          createdAt: new Date('2025-01-01T10:00:00'),
        },
        {
          id: 'whisper',
          title: 'Whisper',
          instruction: 'Whisper sweet',
          image: '/challenges/whisper.png',
          folderId: null,
          createdAt: new Date('2025-01-01T11:00:00'),
        },
        {
          id: 'back-to-back',
          title: 'Back to Back',
          instruction: 'Stand back to back',
          image: '/challenges/back-to-back.png',
          folderId: null,
          createdAt: new Date('2025-01-01T12:00:00'),
        },
      ];

      prismaMock.challenge.findMany.mockResolvedValue(mockChallenges);

      const all = await challengeRepo.findAll();

      expect(all).toHaveLength(3);
      expect(all[0].id).toBe('dip'); // Created first
      expect(all[1].id).toBe('whisper'); // Created second
      expect(all[2].id).toBe('back-to-back'); // Created third
    });
  });
});
