/**
 * Admin Settings API Integration Tests
 *
 * End-to-end tests for feature flags API endpoints
 * Ensures the full stack (API → Service → Repository → Database) works correctly
 *
 * Run with: npm test -- admin-settings-integration.test.js
 */

import { GET, PUT } from '@/app/api/admin/settings/route';
import { NextRequest } from 'next/server';
import { FeatureFlagService } from '@/lib/services/FeatureFlagService';

// Mock admin authentication
jest.mock('@/lib/adminAuth', () => ({
  isAdminAuthenticated: jest.fn(() => true),
}));

describe('Admin Settings API Integration Tests', () => {
  let service;

  beforeEach(() => {
    service = new FeatureFlagService();
  });

  describe('GET /api/admin/settings', () => {
    test('should return all feature flags', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('gamification');
      expect(data.data).toHaveProperty('events');
      expect(data.data).toHaveProperty('faceDetection');
      expect(data.data).toHaveProperty('photoLikes');
      expect(data.data).toHaveProperty('bulkUpload');
      expect(data.data).toHaveProperty('challenges');
    });

    test('should return boolean values for all flags', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(typeof data.data.gamification).toBe('boolean');
      expect(typeof data.data.events).toBe('boolean');
      expect(typeof data.data.faceDetection).toBe('boolean');
      expect(typeof data.data.photoLikes).toBe('boolean');
      expect(typeof data.data.bulkUpload).toBe('boolean');
      expect(typeof data.data.challenges).toBe('boolean');
    });

    test('should require admin authentication', async () => {
      // Temporarily mock as unauthenticated
      const { isAdminAuthenticated } = require('@/lib/adminAuth');
      isAdminAuthenticated.mockReturnValueOnce(false);

      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'GET',
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });
  });

  describe('PUT /api/admin/settings', () => {
    test('should update feature flags', async () => {
      const updates = {
        gamification: true,
        challenges: true,
      };

      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify(updates),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.gamification).toBe(true);
      expect(data.data.challenges).toBe(true);
      expect(data.message).toContain('updated successfully');
    });

    test('should handle partial updates', async () => {
      const updates = {
        gamification: true,
      };

      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify(updates),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.gamification).toBe(true);
      // Other flags should remain unchanged
      expect(typeof data.data.events).toBe('boolean');
    });

    test('should require admin authentication', async () => {
      const { isAdminAuthenticated } = require('@/lib/adminAuth');
      isAdminAuthenticated.mockReturnValueOnce(false);

      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ gamification: true }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });

    test('should reject invalid feature names', async () => {
      const updates = {
        invalidFeature: true,
      };

      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: JSON.stringify(updates),
      });

      const response = await PUT(request);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-token',
        },
        body: 'invalid json',
      });

      const response = await PUT(request);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // Mock service to throw error
      const originalGetAllFlags = service.getAllFlags;
      service.getAllFlags = jest.fn().mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const response = await GET(request);

      expect(response.status).toBe(500);

      // Restore
      service.getAllFlags = originalGetAllFlags;
    });
  });

  describe('Response Format', () => {
    test('should return consistent JSON structure', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      // Should have success flag
      expect(data).toHaveProperty('success');
      expect(typeof data.success).toBe('boolean');

      // Should have data object
      expect(data).toHaveProperty('data');
      expect(typeof data.data).toBe('object');

      // Should not expose internal IDs or timestamps
      expect(data.data.id).toBeUndefined();
      expect(data.data.createdAt).toBeUndefined();
      expect(data.data.updatedAt).toBeUndefined();
    });

    test('should set correct content-type header', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/settings', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const response = await GET(request);

      expect(response.headers.get('content-type')).toContain('application/json');
    });
  });
});
