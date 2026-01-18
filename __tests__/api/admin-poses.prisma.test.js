/**
 * Admin Poses API Route Tests (Prisma-based)
 *
 * Comprehensive tests for app/api/admin/poses/route.js after migration to Prisma.
 * Tests all CRUD operations with proper Prisma mocking.
 */

import { GET, POST, PUT, DELETE } from '../../app/api/admin/poses/route';
import prismaMock from '../prismaMock';
import * as adminAuth from '../../lib/adminAuth';

// Mock dependencies
jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: require('../prismaMock').default,
}));

jest.mock('../../lib/adminAuth');
jest.mock('fs');
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data, init) => ({
      json: async () => data,
      status: init?.status || 200,
      ...init,
    }),
  },
}));

describe('GET /api/admin/poses', () => {
  it('should return all poses ordered by createdAt', async () => {
    const mockChallenges = [
      {
        id: 'test-pose-1',
        title: 'Test Pose 1',
        instruction: 'Do something',
        image: '/challenges/test-pose-1.jpg',
        folderId: null,
        createdAt: new Date('2024-01-01'),
      },
      {
        id: 'test-pose-2',
        title: 'Test Pose 2',
        instruction: 'Do something else',
        image: '/challenges/test-pose-2.jpg',
        folderId: 'folder123',
        createdAt: new Date('2024-01-02'),
      },
    ];

    prismaMock.challenge.findMany.mockResolvedValue(mockChallenges);

    const request = new Request('http://localhost:3000/api/admin/poses');
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockChallenges);
    expect(prismaMock.challenge.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'asc' },
    });
  });

  it('should return empty array when no poses exist', async () => {
    prismaMock.challenge.findMany.mockResolvedValue([]);

    const request = new Request('http://localhost:3000/api/admin/poses');
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toEqual([]);
  });

  it('should handle database errors gracefully', async () => {
    prismaMock.challenge.findMany.mockRejectedValue(new Error('Database connection failed'));

    const request = new Request('http://localhost:3000/api/admin/poses');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });
});

describe('POST /api/admin/poses', () => {
  beforeEach(() => {
    adminAuth.isAdminAuthenticated = jest.fn().mockReturnValue(true);
  });

  it('should create a new pose successfully', async () => {
    const newPose = {
      id: 'test-pose',
      title: 'Test Pose',
      instruction: 'Test instruction',
      image: '/challenges/test-pose.jpg',
      folderId: null,
    };

    prismaMock.challenge.findUnique.mockResolvedValue(null); // No existing pose
    prismaMock.challenge.create.mockResolvedValue(newPose);

    const formData = new FormData();
    formData.append('title', 'Test Pose');
    formData.append('instruction', 'Test instruction');
    formData.append('image', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));

    const request = new Request('http://localhost:3000/api/admin/poses', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data).toMatchObject({
      title: 'Test Pose',
      instruction: 'Test instruction',
    });
  });

  it('should reject unauthenticated requests', async () => {
    adminAuth.isAdminAuthenticated.mockReturnValue(false);

    const formData = new FormData();
    formData.append('title', 'Test Pose');
    formData.append('instruction', 'Test instruction');
    formData.append('image', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));

    const request = new Request('http://localhost:3000/api/admin/poses', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('Unauthorized');
  });

  it('should reject duplicate pose IDs', async () => {
    const existingPose = {
      id: 'test-pose',
      title: 'Test Pose',
      instruction: 'Existing',
      image: '/challenges/test-pose.jpg',
      folderId: null,
    };

    adminAuth.isAdminAuthenticated.mockReturnValue(true);
    prismaMock.challenge.findUnique.mockResolvedValue(existingPose);

    const formData = new FormData();
    formData.append('title', 'Test Pose'); // Same title = same ID
    formData.append('instruction', 'New instruction');
    formData.append('image', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));

    const request = new Request('http://localhost:3000/api/admin/poses', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain('already exists');
  });

  it('should validate required fields', async () => {
    adminAuth.isAdminAuthenticated.mockReturnValue(true);

    const formData = new FormData();
    // Missing title, instruction, and image

    const request = new Request('http://localhost:3000/api/admin/poses', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });
});

describe('PUT /api/admin/poses', () => {
  beforeEach(() => {
    adminAuth.isAdminAuthenticated = jest.fn().mockReturnValue(true);
  });

  it('should update an existing pose', async () => {
    const existingPose = {
      id: 'test-pose',
      title: 'Old Title',
      instruction: 'Old instruction',
      image: '/challenges/test-pose.jpg',
      folderId: null,
    };

    const updatedPose = {
      ...existingPose,
      title: 'New Title',
      instruction: 'New instruction',
    };

    prismaMock.challenge.findUnique.mockResolvedValue(existingPose);
    prismaMock.challenge.update.mockResolvedValue(updatedPose);

    const formData = new FormData();
    formData.append('id', 'test-pose');
    formData.append('title', 'New Title');
    formData.append('instruction', 'New instruction');

    const request = new Request('http://localhost:3000/api/admin/poses', {
      method: 'PUT',
      body: formData,
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.title).toBe('New Title');
    expect(data.data.instruction).toBe('New instruction');
    expect(prismaMock.challenge.update).toHaveBeenCalledWith({
      where: { id: 'test-pose' },
      data: expect.objectContaining({
        title: 'New Title',
        instruction: 'New instruction',
      }),
    });
  });

  it('should return 404 for non-existent pose', async () => {
    adminAuth.isAdminAuthenticated.mockReturnValue(true);
    prismaMock.challenge.findUnique.mockResolvedValue(null);

    const formData = new FormData();
    formData.append('id', 'non-existent');
    formData.append('title', 'New Title');

    const request = new Request('http://localhost:3000/api/admin/poses', {
      method: 'PUT',
      body: formData,
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('not found');
  });

  it('should require admin authentication', async () => {
    adminAuth.isAdminAuthenticated.mockReturnValue(false);

    const formData = new FormData();
    formData.append('id', 'test-pose');
    formData.append('title', 'New Title');

    const request = new Request('http://localhost:3000/api/admin/poses', {
      method: 'PUT',
      body: formData,
    });

    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('Unauthorized');
  });
});

describe('DELETE /api/admin/poses', () => {
  beforeEach(() => {
    adminAuth.isAdminAuthenticated = jest.fn().mockReturnValue(true);
  });

  it('should delete an existing pose', async () => {
    const deletedPose = {
      id: 'test-pose',
      title: 'Test Pose',
      instruction: 'Test instruction',
      image: '/challenges/test-pose.jpg',
      folderId: null,
    };

    prismaMock.challenge.delete.mockResolvedValue(deletedPose);

    const request = new Request('http://localhost:3000/api/admin/poses?id=test-pose', {
      method: 'DELETE',
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.id).toBe('test-pose');
    expect(prismaMock.challenge.delete).toHaveBeenCalledWith({
      where: { id: 'test-pose' },
    });
  });

  it('should return 404 for non-existent pose', async () => {
    adminAuth.isAdminAuthenticated.mockReturnValue(true);
    const notFoundError = new Error('Record not found');
    notFoundError.code = 'P2025';
    prismaMock.challenge.delete.mockRejectedValue(notFoundError);

    const request = new Request('http://localhost:3000/api/admin/poses?id=non-existent', {
      method: 'DELETE',
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('not found');
  });

  it('should require pose ID parameter', async () => {
    adminAuth.isAdminAuthenticated.mockReturnValue(true);

    const request = new Request('http://localhost:3000/api/admin/poses', {
      method: 'DELETE',
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('required');
  });

  it('should require admin authentication', async () => {
    adminAuth.isAdminAuthenticated.mockReturnValue(false);

    const request = new Request('http://localhost:3000/api/admin/poses?id=test-pose', {
      method: 'DELETE',
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('Unauthorized');
  });
});
