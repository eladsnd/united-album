/**
 * Tests for AppSettingsRepository
 *
 * Run with: npm test -- AppSettingsRepository.test.js
 */

import { jest } from '@jest/globals';
import { AppSettingsRepository } from '../../../lib/repositories/AppSettingsRepository.js';
import { mockDeep, mockReset } from 'jest-mock-extended';
import prisma from '../../../lib/prisma.js';

// Mock Prisma client
jest.mock('../../../lib/prisma.js', () => ({
  __esModule: true,
  default: mockDeep(),
}));

describe('AppSettingsRepository', () => {
  let repository;

  beforeEach(() => {
    mockReset(prisma);
    repository = new AppSettingsRepository();
  });

  describe('getModel()', () => {
    test('should return correct model name', () => {
      expect(repository.getModel()).toBe('appSettings');
    });
  });

  describe('getSettings()', () => {
    test('should return existing settings', async () => {
      const mockSettings = {
        id: 'app_settings',
        gamification: false,
        events: true,
        faceDetection: true,
        photoLikes: true,
        bulkUpload: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.appSettings.findUnique.mockResolvedValue(mockSettings);

      const result = await repository.getSettings();

      expect(prisma.appSettings.findUnique).toHaveBeenCalledWith({
        where: { id: 'app_settings' },
      });
      expect(result).toEqual(mockSettings);
    });

    test('should create default settings if not exists', async () => {
      const mockNewSettings = {
        id: 'app_settings',
        gamification: false,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.appSettings.findUnique.mockResolvedValue(null);
      prisma.appSettings.create.mockResolvedValue(mockNewSettings);

      const result = await repository.getSettings();

      expect(prisma.appSettings.create).toHaveBeenCalledWith({
        data: {
          id: 'app_settings',
          gamification: false,
          events: false,
          faceDetection: false,
          photoLikes: false,
          bulkUpload: false,
        },
      });
      expect(result).toEqual(mockNewSettings);
    });
  });

  describe('updateSettings()', () => {
    test('should update settings with partial data', async () => {
      const existingSettings = {
        id: 'app_settings',
        gamification: false,
        events: true,
        faceDetection: true,
        photoLikes: true,
        bulkUpload: true,
      };

      const updatedSettings = {
        ...existingSettings,
        gamification: true,
      };

      prisma.appSettings.findUnique.mockResolvedValue(existingSettings);
      prisma.appSettings.upsert.mockResolvedValue(updatedSettings);

      const result = await repository.updateSettings({ gamification: true });

      expect(result.gamification).toBe(true);
      expect(result.events).toBe(true);
    });

    test('should ensure settings exist before update', async () => {
      prisma.appSettings.findUnique.mockResolvedValueOnce(null);
      prisma.appSettings.create.mockResolvedValue({
        id: 'app_settings',
        gamification: false,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
      });

      prisma.appSettings.upsert.mockResolvedValue({
        id: 'app_settings',
        gamification: true,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
      });

      await repository.updateSettings({ gamification: true });

      // Should have called getSettings first (which creates if not exists)
      expect(prisma.appSettings.findUnique).toHaveBeenCalled();
    });
  });

  describe('getFeatureFlag()', () => {
    test('should return true for enabled features', async () => {
      prisma.appSettings.findUnique.mockResolvedValue({
        id: 'app_settings',
        gamification: true,
        events: false,
        faceDetection: true,
        photoLikes: false,
        bulkUpload: true,
      });

      expect(await repository.getFeatureFlag('gamification')).toBe(true);
      expect(await repository.getFeatureFlag('faceDetection')).toBe(true);
      expect(await repository.getFeatureFlag('bulkUpload')).toBe(true);
    });

    test('should return false for disabled features', async () => {
      prisma.appSettings.findUnique.mockResolvedValue({
        id: 'app_settings',
        gamification: false,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
      });

      expect(await repository.getFeatureFlag('gamification')).toBe(false);
      expect(await repository.getFeatureFlag('events')).toBe(false);
    });

    test('should return false for non-existent features', async () => {
      prisma.appSettings.findUnique.mockResolvedValue({
        id: 'app_settings',
        gamification: true,
        events: true,
        faceDetection: true,
        photoLikes: true,
        bulkUpload: true,
      });

      expect(await repository.getFeatureFlag('nonExistent')).toBe(false);
    });
  });

  describe('setFeatureFlag()', () => {
    test('should update specific feature flag', async () => {
      prisma.appSettings.findUnique.mockResolvedValue({
        id: 'app_settings',
        gamification: false,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
      });

      prisma.appSettings.upsert.mockResolvedValue({
        id: 'app_settings',
        gamification: true,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
      });

      const result = await repository.setFeatureFlag('gamification', true);

      expect(result.gamification).toBe(true);
      expect(result.events).toBe(false);
    });
  });

  describe('resetFeatureFlags()', () => {
    test('should reset all flags to false', async () => {
      prisma.appSettings.findUnique.mockResolvedValue({
        id: 'app_settings',
        gamification: true,
        events: true,
        faceDetection: true,
        photoLikes: true,
        bulkUpload: true,
      });

      prisma.appSettings.upsert.mockResolvedValue({
        id: 'app_settings',
        gamification: false,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
      });

      const result = await repository.resetFeatureFlags();

      expect(result.gamification).toBe(false);
      expect(result.events).toBe(false);
      expect(result.faceDetection).toBe(false);
      expect(result.photoLikes).toBe(false);
      expect(result.bulkUpload).toBe(false);
    });
  });

  describe('Backward compatibility methods', () => {
    test('isGamifyModeEnabled() should work', async () => {
      prisma.appSettings.findUnique.mockResolvedValue({
        id: 'app_settings',
        gamification: true,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
      });

      const result = await repository.isGamifyModeEnabled();
      expect(result).toBe(true);
    });

    test('toggleGamifyMode() should work', async () => {
      prisma.appSettings.findUnique.mockResolvedValue({
        id: 'app_settings',
        gamification: false,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
      });

      prisma.appSettings.upsert.mockResolvedValue({
        id: 'app_settings',
        gamification: true,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
      });

      const result = await repository.toggleGamifyMode();
      expect(result.gamification).toBe(true);
    });
  });
});
