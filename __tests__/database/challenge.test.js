/**
 * Database Tests: Challenge Model
 *
 * Tests all CRUD operations for the Challenge table using Prisma.
 * Challenges store pose challenge definitions for the wedding.
 */

import prisma from '../../lib/prisma';

describe('Challenge Database Operations', () => {
  // Clean up database before each test
  beforeEach(async () => {
    await prisma.challenge.deleteMany();
  });

  // Close database connection after all tests
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('CREATE operations', () => {
    it('should create a challenge with required fields', async () => {
      const challenge = await prisma.challenge.create({
        data: {
          id: 'dip',
          title: 'The Dip',
          instruction: 'Take a photo of someone doing a dramatic dip!',
          image: '/challenges/dip.jpg',
        },
      });

      expect(challenge.id).toBe('dip');
      expect(challenge.title).toBe('The Dip');
      expect(challenge.instruction).toBe('Take a photo of someone doing a dramatic dip!');
      expect(challenge.image).toBe('/challenges/dip.jpg');
      expect(challenge.folderId).toBeNull(); // nullable
      expect(challenge.createdAt).toBeInstanceOf(Date);
      expect(challenge.updatedAt).toBeInstanceOf(Date);
    });

    it('should create a challenge with folderId', async () => {
      const challenge = await prisma.challenge.create({
        data: {
          id: 'jump',
          title: 'Jump Photo',
          instruction: 'Everyone jump at the same time!',
          image: '/challenges/jump.jpg',
          folderId: 'folder_abc123',
        },
      });

      expect(challenge.id).toBe('jump');
      expect(challenge.folderId).toBe('folder_abc123');
    });

    it('should enforce unique id constraint', async () => {
      await prisma.challenge.create({
        data: {
          id: 'duplicate',
          title: 'First',
          instruction: 'First challenge',
          image: '/challenges/first.jpg',
        },
      });

      // Attempting to create another challenge with same id should fail
      await expect(
        prisma.challenge.create({
          data: {
            id: 'duplicate',
            title: 'Second',
            instruction: 'Second challenge',
            image: '/challenges/second.jpg',
          },
        })
      ).rejects.toThrow();
    });

    it('should create multiple challenges', async () => {
      await prisma.challenge.createMany({
        data: [
          {
            id: 'dip',
            title: 'The Dip',
            instruction: 'Dramatic dip pose',
            image: '/challenges/dip.jpg',
          },
          {
            id: 'back-to-back',
            title: 'Back to Back',
            instruction: 'Stand back to back',
            image: '/challenges/back-to-back.jpg',
          },
          {
            id: 'jump',
            title: 'Jump',
            instruction: 'Jump together!',
            image: '/challenges/jump.jpg',
          },
        ],
      });

      const count = await prisma.challenge.count();
      expect(count).toBe(3);
    });
  });

  describe('READ operations', () => {
    beforeEach(async () => {
      // Create test challenges
      await prisma.challenge.createMany({
        data: [
          {
            id: 'dip',
            title: 'The Dip',
            instruction: 'Take a photo of someone doing a dramatic dip!',
            image: '/challenges/dip.jpg',
            folderId: 'folder_dip',
          },
          {
            id: 'back-to-back',
            title: 'Back to Back',
            instruction: 'Stand back to back and strike a pose!',
            image: '/challenges/back-to-back.jpg',
            folderId: 'folder_b2b',
          },
          {
            id: 'jump',
            title: 'Jump Photo',
            instruction: 'Everyone jump at the same time!',
            image: '/challenges/jump.jpg',
          },
          {
            id: 'group-hug',
            title: 'Group Hug',
            instruction: 'Big group hug!',
            image: '/challenges/group-hug.jpg',
          },
        ],
      });
    });

    it('should find challenge by id', async () => {
      const challenge = await prisma.challenge.findUnique({
        where: { id: 'dip' },
      });

      expect(challenge).not.toBeNull();
      expect(challenge.title).toBe('The Dip');
      expect(challenge.folderId).toBe('folder_dip');
    });

    it('should return null for non-existent id', async () => {
      const challenge = await prisma.challenge.findUnique({
        where: { id: 'nonexistent' },
      });

      expect(challenge).toBeNull();
    });

    it('should retrieve all challenges', async () => {
      const challenges = await prisma.challenge.findMany();

      expect(challenges).toHaveLength(4);
    });

    it('should filter challenges by title pattern', async () => {
      const challenges = await prisma.challenge.findMany({
        where: {
          title: {
            contains: 'Back',
          },
        },
      });

      expect(challenges).toHaveLength(1);
      expect(challenges[0].id).toBe('back-to-back');
    });

    it('should find challenges with folderId', async () => {
      const challenges = await prisma.challenge.findMany({
        where: {
          folderId: {
            not: null,
          },
        },
      });

      expect(challenges).toHaveLength(2);
      expect(challenges.every(c => c.folderId !== null)).toBe(true);
    });

    it('should find challenges without folderId', async () => {
      const challenges = await prisma.challenge.findMany({
        where: {
          folderId: null,
        },
      });

      expect(challenges).toHaveLength(2);
      expect(challenges.map(c => c.id).sort()).toEqual(['group-hug', 'jump']);
    });

    it('should order challenges by title', async () => {
      const challenges = await prisma.challenge.findMany({
        orderBy: { title: 'asc' },
      });

      expect(challenges).toHaveLength(4);
      expect(challenges[0].title).toBe('Back to Back');
      expect(challenges[1].title).toBe('Group Hug');
      expect(challenges[2].title).toBe('Jump Photo');
      expect(challenges[3].title).toBe('The Dip');
    });

    it('should order challenges by createdAt', async () => {
      const challenges = await prisma.challenge.findMany({
        orderBy: { createdAt: 'desc' },
      });

      expect(challenges).toHaveLength(4);
      // Most recently created first
      expect(challenges[0].createdAt.getTime()).toBeGreaterThanOrEqual(
        challenges[challenges.length - 1].createdAt.getTime()
      );
    });
  });

  describe('UPDATE operations', () => {
    let testChallenge;

    beforeEach(async () => {
      testChallenge = await prisma.challenge.create({
        data: {
          id: 'test-challenge',
          title: 'Test Challenge',
          instruction: 'Original instruction',
          image: '/challenges/test.jpg',
        },
      });
    });

    it('should update title', async () => {
      const updated = await prisma.challenge.update({
        where: { id: 'test-challenge' },
        data: { title: 'Updated Title' },
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.updatedAt.getTime()).toBeGreaterThan(testChallenge.updatedAt.getTime());
    });

    it('should update instruction', async () => {
      const updated = await prisma.challenge.update({
        where: { id: 'test-challenge' },
        data: { instruction: 'New instruction with more details!' },
      });

      expect(updated.instruction).toBe('New instruction with more details!');
    });

    it('should update image path', async () => {
      const updated = await prisma.challenge.update({
        where: { id: 'test-challenge' },
        data: { image: '/challenges/new-image.jpg' },
      });

      expect(updated.image).toBe('/challenges/new-image.jpg');
    });

    it('should add folderId', async () => {
      const updated = await prisma.challenge.update({
        where: { id: 'test-challenge' },
        data: { folderId: 'new_folder_123' },
      });

      expect(updated.folderId).toBe('new_folder_123');
    });

    it('should remove folderId', async () => {
      // First add a folderId
      await prisma.challenge.update({
        where: { id: 'test-challenge' },
        data: { folderId: 'folder_to_remove' },
      });

      // Then remove it
      const updated = await prisma.challenge.update({
        where: { id: 'test-challenge' },
        data: { folderId: null },
      });

      expect(updated.folderId).toBeNull();
    });

    it('should update multiple fields at once', async () => {
      const updated = await prisma.challenge.update({
        where: { id: 'test-challenge' },
        data: {
          title: 'Completely New Title',
          instruction: 'Brand new instruction',
          image: '/challenges/completely-new.jpg',
          folderId: 'new_folder',
        },
      });

      expect(updated.title).toBe('Completely New Title');
      expect(updated.instruction).toBe('Brand new instruction');
      expect(updated.image).toBe('/challenges/completely-new.jpg');
      expect(updated.folderId).toBe('new_folder');
    });

    it('should throw error when updating non-existent challenge', async () => {
      await expect(
        prisma.challenge.update({
          where: { id: 'nonexistent' },
          data: { title: 'New Title' },
        })
      ).rejects.toThrow();
    });
  });

  describe('DELETE operations', () => {
    beforeEach(async () => {
      await prisma.challenge.createMany({
        data: [
          {
            id: 'delete1',
            title: 'Delete 1',
            instruction: 'To delete',
            image: '/challenges/delete1.jpg',
          },
          {
            id: 'delete2',
            title: 'Delete 2',
            instruction: 'To delete',
            image: '/challenges/delete2.jpg',
          },
          {
            id: 'keep1',
            title: 'Keep 1',
            instruction: 'To keep',
            image: '/challenges/keep1.jpg',
          },
        ],
      });
    });

    it('should delete challenge by id', async () => {
      const deleted = await prisma.challenge.delete({
        where: { id: 'delete1' },
      });

      expect(deleted.id).toBe('delete1');

      const remaining = await prisma.challenge.findMany();
      expect(remaining).toHaveLength(2);
      expect(remaining.find(c => c.id === 'delete1')).toBeUndefined();
    });

    it('should delete multiple challenges', async () => {
      const result = await prisma.challenge.deleteMany({
        where: {
          title: {
            contains: 'Delete',
          },
        },
      });

      expect(result.count).toBe(2);

      const remaining = await prisma.challenge.findMany();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('keep1');
    });

    it('should throw error when deleting non-existent challenge', async () => {
      await expect(
        prisma.challenge.delete({
          where: { id: 'nonexistent' },
        })
      ).rejects.toThrow();
    });
  });

  describe('UPSERT operations', () => {
    it('should insert when challenge does not exist', async () => {
      const challenge = await prisma.challenge.upsert({
        where: { id: 'new-challenge' },
        update: {},
        create: {
          id: 'new-challenge',
          title: 'New Challenge',
          instruction: 'Brand new challenge',
          image: '/challenges/new.jpg',
        },
      });

      expect(challenge.id).toBe('new-challenge');
      expect(challenge.title).toBe('New Challenge');

      const count = await prisma.challenge.count();
      expect(count).toBe(1);
    });

    it('should update when challenge exists', async () => {
      // Create initial challenge
      await prisma.challenge.create({
        data: {
          id: 'existing',
          title: 'Original Title',
          instruction: 'Original instruction',
          image: '/challenges/original.jpg',
        },
      });

      // Upsert should update
      const challenge = await prisma.challenge.upsert({
        where: { id: 'existing' },
        update: {
          title: 'Updated Title',
          instruction: 'Updated instruction',
        },
        create: {
          id: 'existing',
          title: 'Should Not Use This',
          instruction: 'Should not create',
          image: '/challenges/should-not-create.jpg',
        },
      });

      expect(challenge.title).toBe('Updated Title');
      expect(challenge.instruction).toBe('Updated instruction');
      expect(challenge.image).toBe('/challenges/original.jpg'); // Not changed

      const count = await prisma.challenge.count();
      expect(count).toBe(1); // Still only 1 record
    });
  });

  describe('COUNT and aggregation', () => {
    beforeEach(async () => {
      await prisma.challenge.createMany({
        data: [
          {
            id: 'c1',
            title: 'Challenge 1',
            instruction: 'Instruction 1',
            image: '/challenges/c1.jpg',
            folderId: 'folder1',
          },
          {
            id: 'c2',
            title: 'Challenge 2',
            instruction: 'Instruction 2',
            image: '/challenges/c2.jpg',
            folderId: 'folder1',
          },
          {
            id: 'c3',
            title: 'Challenge 3',
            instruction: 'Instruction 3',
            image: '/challenges/c3.jpg',
          },
          {
            id: 'c4',
            title: 'Challenge 4',
            instruction: 'Instruction 4',
            image: '/challenges/c4.jpg',
          },
        ],
      });
    });

    it('should count all challenges', async () => {
      const count = await prisma.challenge.count();
      expect(count).toBe(4);
    });

    it('should count challenges with folderId', async () => {
      const count = await prisma.challenge.count({
        where: {
          folderId: {
            not: null,
          },
        },
      });
      expect(count).toBe(2);
    });

    it('should count challenges by specific folderId', async () => {
      const count = await prisma.challenge.count({
        where: { folderId: 'folder1' },
      });
      expect(count).toBe(2);
    });

    it('should count challenges without folderId', async () => {
      const count = await prisma.challenge.count({
        where: { folderId: null },
      });
      expect(count).toBe(2);
    });
  });

  describe('Data integrity', () => {
    it('should preserve special characters in title and instruction', async () => {
      const challenge = await prisma.challenge.create({
        data: {
          id: 'special-chars',
          title: 'The "Ultimate" Challenge!',
          instruction: "Don't miss this & that... it's amazing! 😊",
          image: '/challenges/special.jpg',
        },
      });

      const retrieved = await prisma.challenge.findUnique({
        where: { id: 'special-chars' },
      });

      expect(retrieved.title).toBe('The "Ultimate" Challenge!');
      expect(retrieved.instruction).toBe("Don't miss this & that... it's amazing! 😊");
    });

    it('should handle long instructions', async () => {
      const longInstruction = 'A'.repeat(500);

      const challenge = await prisma.challenge.create({
        data: {
          id: 'long-instruction',
          title: 'Long',
          instruction: longInstruction,
          image: '/challenges/long.jpg',
        },
      });

      expect(challenge.instruction).toBe(longInstruction);
      expect(challenge.instruction.length).toBe(500);
    });

    it('should handle kebab-case and snake_case IDs', async () => {
      await prisma.challenge.createMany({
        data: [
          {
            id: 'kebab-case-id',
            title: 'Kebab',
            instruction: 'Kebab case',
            image: '/challenges/kebab.jpg',
          },
          {
            id: 'snake_case_id',
            title: 'Snake',
            instruction: 'Snake case',
            image: '/challenges/snake.jpg',
          },
          {
            id: 'camelCaseId',
            title: 'Camel',
            instruction: 'Camel case',
            image: '/challenges/camel.jpg',
          },
        ],
      });

      const kebab = await prisma.challenge.findUnique({ where: { id: 'kebab-case-id' } });
      const snake = await prisma.challenge.findUnique({ where: { id: 'snake_case_id' } });
      const camel = await prisma.challenge.findUnique({ where: { id: 'camelCaseId' } });

      expect(kebab).not.toBeNull();
      expect(snake).not.toBeNull();
      expect(camel).not.toBeNull();
    });
  });
});
