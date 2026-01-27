/**
 * Integration Tests for /api/features endpoint
 *
 * Run with: npm test -- features.test.js
 */

import { jest } from '@jest/globals';
import { GET } from '../../app/api/features/route.js';
import { FeatureFlagService } from '../../lib/services/FeatureFlagService.js';

// Mock FeatureFlagService
jest.mock('../../lib/services/FeatureFlagService.js');

describe('GET /api/features', () => {
  let mockFeatureFlagService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFeatureFlagService = {
      isEnabled: jest.fn(),
      getAllFlags: jest.fn(),
    };

    FeatureFlagService.mockImplementation(() => mockFeatureFlagService);
  });

  describe('Get all features', () => {
    test('should return all feature flags', async () => {
      const mockFlags = {
        gamification: false,
        events: true,
        faceDetection: true,
        photoLikes: true,
        bulkUpload: true,
      };

      mockFeatureFlagService.getAllFlags.mockResolvedValue(mockFlags);

      const request = new Request('http://localhost:3000/api/features');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        data: mockFlags,
      });
      expect(mockFeatureFlagService.getAllFlags).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get specific feature', () => {
    test('should return specific feature flag (enabled)', async () => {
      mockFeatureFlagService.isEnabled.mockResolvedValue(true);

      const request = new Request('http://localhost:3000/api/features?feature=gamification');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        data: {
          feature: 'gamification',
          enabled: true,
        },
      });
      expect(mockFeatureFlagService.isEnabled).toHaveBeenCalledWith('gamification');
    });

    test('should return specific feature flag (disabled)', async () => {
      mockFeatureFlagService.isEnabled.mockResolvedValue(false);

      const request = new Request('http://localhost:3000/api/features?feature=events');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        data: {
          feature: 'events',
          enabled: false,
        },
      });
      expect(mockFeatureFlagService.isEnabled).toHaveBeenCalledWith('events');
    });

    test('should return false for non-existent feature', async () => {
      mockFeatureFlagService.isEnabled.mockResolvedValue(false);

      const request = new Request('http://localhost:3000/api/features?feature=nonExistent');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.enabled).toBe(false);
    });
  });

  describe('Error handling', () => {
    test('should handle database errors gracefully', async () => {
      mockFeatureFlagService.getAllFlags.mockRejectedValue(new Error('Database error'));

      const request = new Request('http://localhost:3000/api/features');

      // Should be wrapped by withApi decorator which handles errors
      // For this test, we expect the error to be caught and logged
      await expect(GET(request)).rejects.toThrow('Database error');
    });
  });
});
