/**
 * Database Schema Validation Tests
 *
 * Ensures critical database tables exist and have correct structure.
 * Prevents runtime errors from missing tables or columns.
 *
 * Run with: npm test -- schema-validation.test.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Database Schema Validation', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('AppSettings Table', () => {
    test('should have AppSettings table in database', async () => {
      // This will throw if table doesn't exist
      const result = await prisma.$queryRaw`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='AppSettings';
      `;

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('AppSettings');
    });

    test('should have correct columns in AppSettings', async () => {
      const columns = await prisma.$queryRaw`
        PRAGMA table_info(AppSettings);
      `;

      const columnNames = columns.map((col) => col.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('gamification');
      expect(columnNames).toContain('events');
      expect(columnNames).toContain('faceDetection');
      expect(columnNames).toContain('photoLikes');
      expect(columnNames).toContain('bulkUpload');
      expect(columnNames).toContain('challenges');
      expect(columnNames).toContain('createdAt');
      expect(columnNames).toContain('updatedAt');
    });

    test('should have app_settings record', async () => {
      const settings = await prisma.appSettings.findUnique({
        where: { id: 'app_settings' },
      });

      expect(settings).not.toBeNull();
      expect(settings.id).toBe('app_settings');
    });

    test('should have boolean columns with proper types', async () => {
      const settings = await prisma.appSettings.findUnique({
        where: { id: 'app_settings' },
      });

      expect(typeof settings.gamification).toBe('boolean');
      expect(typeof settings.events).toBe('boolean');
      expect(typeof settings.faceDetection).toBe('boolean');
      expect(typeof settings.photoLikes).toBe('boolean');
      expect(typeof settings.bulkUpload).toBe('boolean');
      expect(typeof settings.challenges).toBe('boolean');
    });

    test('should have timestamp columns', async () => {
      const settings = await prisma.appSettings.findUnique({
        where: { id: 'app_settings' },
      });

      expect(settings.createdAt).toBeInstanceOf(Date);
      expect(settings.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Database Connection', () => {
    test('should be able to connect to database', async () => {
      await expect(prisma.$queryRaw`SELECT 1 as test`).resolves.toBeTruthy();
    });

    test('should use correct database file', async () => {
      const dbPath = process.env.DATABASE_URL;

      expect(dbPath).toBeDefined();
      expect(dbPath).toContain('file:');

      // Should point to prisma/dev.db in development
      if (process.env.NODE_ENV !== 'production') {
        expect(dbPath).toContain('prisma/dev.db');
      }
    });
  });

  describe('Critical Tables Existence', () => {
    test('should have all required tables', async () => {
      const tables = await prisma.$queryRaw`
        SELECT name FROM sqlite_master
        WHERE type='table'
        ORDER BY name;
      `;

      const tableNames = tables.map((t) => t.name);

      // Critical tables that must exist
      expect(tableNames).toContain('AppSettings');
      expect(tableNames).toContain('Photo');
      expect(tableNames).toContain('Face');
      expect(tableNames).toContain('Challenge');
    });
  });

  describe('Data Integrity', () => {
    test('should have only one AppSettings record (singleton)', async () => {
      const count = await prisma.appSettings.count();

      expect(count).toBe(1);
    });

    test('should not allow duplicate AppSettings records', async () => {
      // Try to create duplicate (should fail with unique constraint)
      await expect(
        prisma.appSettings.create({
          data: {
            id: 'app_settings',
            gamification: false,
            events: false,
            faceDetection: false,
            photoLikes: false,
            bulkUpload: false,
            challenges: false,
          },
        })
      ).rejects.toThrow();
    });
  });
});
