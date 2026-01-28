/**
 * AppSettingsRepository Tests
 *
 * Tests for AppSettings database operations
 * Ensures feature flags system is resilient and doesn't fail silently
 */

import { AppSettingsRepository } from '@/lib/repositories/AppSettingsRepository';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset } from 'jest-mock-extended';

// Mock Prisma Client
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: mockDeep<PrismaClient>(),
}));

import prisma from '@/lib/prisma';

const mockPrisma = prisma as ReturnType<typeof mockDeep<PrismaClient>>;

describe('AppSettingsRepository', () => {
  let repository;

  beforeEach(() => {
    mockReset(mockPrisma);
    repository = new AppSettingsRepository();
  });

  describe('getSettings', () => {
    it('should return existing settings from database', async () => {
      const mockSettings = {
        id: 'app_settings',
        gamification: true,
        events: true,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
        challenges: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.appSettings.findUnique.mockResolvedValue(mockSettings);

      const result = await repository.getSettings();

      expect(result).toEqual(mockSettings);
      expect(mockPrisma.appSettings.findUnique).toHaveBeenCalledWith({
        where: { id: 'app_settings' },
      });
    });

    it('should create default settings if none exist', async () => {
      const defaultSettings = {
        id: 'app_settings',
        gamification: false,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
        challenges: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.appSettings.findUnique.mockResolvedValue(null);
      mockPrisma.appSettings.create.mockResolvedValue(defaultSettings);

      const result = await repository.getSettings();

      expect(result).toEqual(defaultSettings);
      expect(mockPrisma.appSettings.create).toHaveBeenCalledWith({
        data: {
          id: 'app_settings',
          gamification: false,
          events: false,
          faceDetection: false,
          photoLikes: false,
          bulkUpload: false,
          challenges: false,
        },
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.appSettings.findUnique.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(repository.getSettings()).rejects.toThrow('Database connection failed');
    });
  });

  describe('updateSettings', () => {
    it('should update existing settings', async () => {
      const updates = {
        gamification: true,
        challenges: true,
      };

      const updatedSettings = {
        id: 'app_settings',
        gamification: true,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
        challenges: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.appSettings.update.mockResolvedValue(updatedSettings);

      const result = await repository.updateSettings(updates);

      expect(result).toEqual(updatedSettings);
      expect(mockPrisma.appSettings.update).toHaveBeenCalledWith({
        where: { id: 'app_settings' },
        data: updates,
      });
    });

    it('should handle partial updates', async () => {
      const updates = {
        gamification: true,
      };

      const updatedSettings = {
        id: 'app_settings',
        gamification: true,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
        challenges: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.appSettings.update.mockResolvedValue(updatedSettings);

      const result = await repository.updateSettings(updates);

      expect(result.gamification).toBe(true);
      expect(mockPrisma.appSettings.update).toHaveBeenCalledWith({
        where: { id: 'app_settings' },
        data: updates,
      });
    });

    it('should handle update errors', async () => {
      mockPrisma.appSettings.update.mockRejectedValue(
        new Error('Record not found')
      );

      await expect(repository.updateSettings({ gamification: true })).rejects.toThrow();
    });
  });

  describe('database schema validation', () => {
    it('should have correct model name', () => {
      expect(repository.getModel()).toBe('appSettings');
    });

    it('should use correct singleton ID', async () => {
      mockPrisma.appSettings.findUnique.mockResolvedValue({
        id: 'app_settings',
        gamification: false,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
        challenges: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await repository.getSettings();

      expect(mockPrisma.appSettings.findUnique).toHaveBeenCalledWith({
        where: { id: 'app_settings' },
      });
    });
  });
});
