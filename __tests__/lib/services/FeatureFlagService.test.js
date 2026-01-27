/**
 * Tests for FeatureFlagService
 *
 * Run with: npm test -- FeatureFlagService.test.js
 */

import { jest } from '@jest/globals';
import { FeatureFlagService } from '../../../lib/services/FeatureFlagService.js';
import { AppSettingsRepository } from '../../../lib/repositories/AppSettingsRepository.js';

// Mock AppSettingsRepository
jest.mock('../../../lib/repositories/AppSettingsRepository.js');

describe('FeatureFlagService', () => {
  let service;
  let mockSettingsRepo;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Create mock settings repository
    mockSettingsRepo = {
      getSettings: jest.fn(),
      updateSettings: jest.fn(),
    };

    // Mock the constructor to return our mock
    AppSettingsRepository.mockImplementation(() => mockSettingsRepo);

    // Create service instance
    service = new FeatureFlagService();
  });

  afterEach(() => {
    // Clear cache after each test
    service._invalidateCache();
  });

  describe('FEATURES constant', () => {
    test('should define all feature names', () => {
      expect(FeatureFlagService.FEATURES).toEqual({
        GAMIFICATION: 'gamification',
        EVENTS: 'events',
        FACE_DETECTION: 'faceDetection',
        PHOTO_LIKES: 'photoLikes',
        BULK_UPLOAD: 'bulkUpload',
      });
    });
  });

  describe('isEnabled()', () => {
    test('should return true for enabled features', async () => {
      mockSettingsRepo.getSettings.mockResolvedValue({
        gamification: true,
        events: false,
        faceDetection: true,
        photoLikes: false,
        bulkUpload: true,
      });

      expect(await service.isEnabled('gamification')).toBe(true);
      expect(await service.isEnabled('faceDetection')).toBe(true);
      expect(await service.isEnabled('bulkUpload')).toBe(true);
    });

    test('should return false for disabled features', async () => {
      mockSettingsRepo.getSettings.mockResolvedValue({
        gamification: false,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
      });

      expect(await service.isEnabled('gamification')).toBe(false);
      expect(await service.isEnabled('events')).toBe(false);
    });

    test('should return false for non-existent features', async () => {
      mockSettingsRepo.getSettings.mockResolvedValue({
        gamification: true,
        events: true,
        faceDetection: true,
        photoLikes: true,
        bulkUpload: true,
      });

      expect(await service.isEnabled('nonExistent')).toBe(false);
    });

    test('should use cache for subsequent calls', async () => {
      mockSettingsRepo.getSettings.mockResolvedValue({
        gamification: true,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
      });

      // First call - should query DB
      await service.isEnabled('gamification');
      expect(mockSettingsRepo.getSettings).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await service.isEnabled('gamification');
      expect(mockSettingsRepo.getSettings).toHaveBeenCalledTimes(1);

      // Different feature - should still use same cache
      await service.isEnabled('events');
      expect(mockSettingsRepo.getSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAllFlags()', () => {
    test('should return all feature flags', async () => {
      const mockSettings = {
        id: 'app_settings',
        gamification: true,
        events: false,
        faceDetection: true,
        photoLikes: false,
        bulkUpload: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSettingsRepo.getSettings.mockResolvedValue(mockSettings);

      const flags = await service.getAllFlags();

      expect(flags).toEqual({
        gamification: true,
        events: false,
        faceDetection: true,
        photoLikes: false,
        bulkUpload: true,
      });

      // Should not include id, timestamps
      expect(flags.id).toBeUndefined();
      expect(flags.createdAt).toBeUndefined();
      expect(flags.updatedAt).toBeUndefined();
    });

    test('should return cached flags on second call', async () => {
      mockSettingsRepo.getSettings.mockResolvedValue({
        gamification: true,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
      });

      await service.getAllFlags();
      await service.getAllFlags();

      expect(mockSettingsRepo.getSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateFlag()', () => {
    test('should update a single flag', async () => {
      const updatedSettings = {
        gamification: true,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
      };

      mockSettingsRepo.updateSettings.mockResolvedValue(updatedSettings);

      const result = await service.updateFlag('gamification', true);

      expect(mockSettingsRepo.updateSettings).toHaveBeenCalledWith({
        gamification: true,
      });
      expect(result).toEqual(updatedSettings);
    });

    test('should invalidate cache after update', async () => {
      mockSettingsRepo.getSettings.mockResolvedValue({
        gamification: false,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
      });

      mockSettingsRepo.updateSettings.mockResolvedValue({
        gamification: true,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
      });

      // First call - populate cache
      await service.isEnabled('gamification');
      expect(mockSettingsRepo.getSettings).toHaveBeenCalledTimes(1);

      // Update flag - should invalidate cache
      await service.updateFlag('gamification', true);

      // Next call - should query DB again (cache invalidated)
      await service.isEnabled('gamification');
      expect(mockSettingsRepo.getSettings).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateFlags()', () => {
    test('should update multiple flags at once', async () => {
      const updates = {
        gamification: true,
        events: true,
      };

      const updatedSettings = {
        gamification: true,
        events: true,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
      };

      mockSettingsRepo.updateSettings.mockResolvedValue(updatedSettings);

      const result = await service.updateFlags(updates);

      expect(mockSettingsRepo.updateSettings).toHaveBeenCalledWith(updates);
      expect(result).toEqual(updatedSettings);
    });

    test('should invalidate cache after bulk update', async () => {
      mockSettingsRepo.getSettings.mockResolvedValue({
        gamification: false,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
      });

      mockSettingsRepo.updateSettings.mockResolvedValue({
        gamification: true,
        events: true,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
      });

      // Populate cache
      await service.getAllFlags();
      expect(mockSettingsRepo.getSettings).toHaveBeenCalledTimes(1);

      // Bulk update
      await service.updateFlags({ gamification: true, events: true });

      // Should query DB again
      await service.getAllFlags();
      expect(mockSettingsRepo.getSettings).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache TTL', () => {
    test('should expire cache after 30 seconds', async () => {
      jest.useFakeTimers();

      mockSettingsRepo.getSettings.mockResolvedValue({
        gamification: true,
        events: false,
        faceDetection: false,
        photoLikes: false,
        bulkUpload: false,
      });

      // First call - populate cache
      await service.isEnabled('gamification');
      expect(mockSettingsRepo.getSettings).toHaveBeenCalledTimes(1);

      // Advance time by 29 seconds - cache still valid
      jest.advanceTimersByTime(29000);
      await service.isEnabled('gamification');
      expect(mockSettingsRepo.getSettings).toHaveBeenCalledTimes(1);

      // Advance time by 2 more seconds - cache expired
      jest.advanceTimersByTime(2000);
      await service.isEnabled('gamification');
      expect(mockSettingsRepo.getSettings).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });
  });
});
