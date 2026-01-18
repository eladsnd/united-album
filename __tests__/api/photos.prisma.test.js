/**
 * Photos API Route Tests (Prisma-based)
 *
 * Comprehensive tests for app/api/photos/route.js after migration to Prisma.
 * Tests photo sync logic with Google Drive and database cleanup.
 */

import { GET } from '../../app/api/photos/route';
import prismaMock from '../prismaMock';
import * as googleDrive from '../../lib/googleDrive';
import * as photoStorage from '../../lib/photoStorage';

// Mock dependencies
jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: require('../prismaMock').default,
}));

jest.mock('../../lib/googleDrive');
jest.mock('../../lib/photoStorage');
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data) => ({
      json: async () => data,
    }),
  },
}));

describe('GET /api/photos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return all photos when they match Drive files', async () => {
    const mockPhotos = [
      {
        id: 1,
        driveId: 'drive123',
        name: 'photo1.jpg',
        url: 'http://example.com/photo1.jpg',
        mainFaceId: 'person_1',
        faceIds: ['person_1', 'person_2'],
        faceBoxes: [],
        poseId: 'test-pose',
        uploaderId: 'uploader1',
        timestamp: new Date(),
      },
      {
        id: 2,
        driveId: 'drive456',
        name: 'photo2.jpg',
        url: 'http://example.com/photo2.jpg',
        mainFaceId: 'person_3',
        faceIds: ['person_3'],
        faceBoxes: [],
        poseId: 'test-pose-2',
        uploaderId: 'uploader1',
        timestamp: new Date(),
      },
    ];

    const validDriveIds = new Set(['drive123', 'drive456']);

    photoStorage.getPhotos.mockResolvedValue(mockPhotos);
    googleDrive.listDriveFiles.mockResolvedValue(validDriveIds);

    const request = new Request('http://localhost:3000/api/photos');
    const response = await GET(request);
    const data = await response.json();

    expect(data).toHaveLength(2);
    expect(data[0].url).toBe('/api/image/drive123'); // URL forced to proxy
    expect(data[1].url).toBe('/api/image/drive456');
  });

  it('should filter out photos not in Drive', async () => {
    const mockPhotos = [
      {
        id: 1,
        driveId: 'drive123',
        name: 'photo1.jpg',
        url: 'http://example.com/photo1.jpg',
        mainFaceId: 'person_1',
        faceIds: [],
        faceBoxes: [],
        poseId: 'test-pose',
        uploaderId: 'uploader1',
        timestamp: new Date(),
      },
      {
        id: 2,
        driveId: 'drive456', // This file was deleted from Drive
        name: 'photo2.jpg',
        url: 'http://example.com/photo2.jpg',
        mainFaceId: 'person_2',
        faceIds: [],
        faceBoxes: [],
        poseId: 'test-pose',
        uploaderId: 'uploader1',
        timestamp: new Date(),
      },
    ];

    const validDriveIds = new Set(['drive123']); // Only drive123 exists

    photoStorage.getPhotos.mockResolvedValue(mockPhotos);
    googleDrive.listDriveFiles.mockResolvedValue(validDriveIds);
    photoStorage.deletePhoto.mockResolvedValue(true);

    const request = new Request('http://localhost:3000/api/photos');
    const response = await GET(request);
    const data = await response.json();

    expect(data).toHaveLength(1);
    expect(data[0].driveId).toBe('drive123');
    expect(photoStorage.deletePhoto).toHaveBeenCalledWith('drive456');
  });

  it('should keep mock_drive_id photos for testing', async () => {
    const mockPhotos = [
      {
        id: 1,
        driveId: 'mock_drive_id',
        name: 'test-photo.jpg',
        url: 'http://example.com/test-photo.jpg',
        mainFaceId: 'unknown',
        faceIds: [],
        faceBoxes: [],
        poseId: 'unknown_pose',
        uploaderId: 'test',
        timestamp: new Date(),
      },
    ];

    const validDriveIds = new Set(); // Empty - no real files

    photoStorage.getPhotos.mockResolvedValue(mockPhotos);
    googleDrive.listDriveFiles.mockResolvedValue(validDriveIds);

    const request = new Request('http://localhost:3000/api/photos');
    const response = await GET(request);
    const data = await response.json();

    expect(data).toHaveLength(1);
    expect(data[0].driveId).toBe('mock_drive_id');
    expect(photoStorage.deletePhoto).not.toHaveBeenCalled();
  });

  it('should deduplicate photos with same driveId', async () => {
    const mockPhotos = [
      {
        id: 1,
        driveId: 'drive123',
        name: 'photo1.jpg',
        url: 'http://example.com/photo1.jpg',
        mainFaceId: 'person_1',
        faceIds: [],
        faceBoxes: [],
        poseId: 'test-pose',
        uploaderId: 'uploader1',
        timestamp: new Date('2024-01-01'),
      },
      {
        id: 2,
        driveId: 'drive123', // Duplicate!
        name: 'photo1-duplicate.jpg',
        url: 'http://example.com/photo1-dup.jpg',
        mainFaceId: 'person_1',
        faceIds: [],
        faceBoxes: [],
        poseId: 'test-pose',
        uploaderId: 'uploader1',
        timestamp: new Date('2024-01-02'),
      },
    ];

    const validDriveIds = new Set(['drive123']);

    photoStorage.getPhotos.mockResolvedValue(mockPhotos);
    googleDrive.listDriveFiles.mockResolvedValue(validDriveIds);
    photoStorage.deletePhoto.mockResolvedValue(true);

    const request = new Request('http://localhost:3000/api/photos');
    const response = await GET(request);
    const data = await response.json();

    expect(data).toHaveLength(1); // Deduplicated
    expect(data[0].id).toBe(1); // Keeps first occurrence
  });

  it('should fallback to local photos if Drive check fails', async () => {
    const mockPhotos = [
      {
        id: 1,
        driveId: 'drive123',
        name: 'photo1.jpg',
        url: 'http://example.com/photo1.jpg',
        mainFaceId: 'person_1',
        faceIds: [],
        faceBoxes: [],
        poseId: 'test-pose',
        uploaderId: 'uploader1',
        timestamp: new Date(),
      },
    ];

    photoStorage.getPhotos.mockResolvedValue(mockPhotos);
    googleDrive.listDriveFiles.mockRejectedValue(new Error('Drive API error'));

    const request = new Request('http://localhost:3000/api/photos');
    const response = await GET(request);
    const data = await response.json();

    expect(data).toHaveLength(1);
    expect(data[0].driveId).toBe('drive123');
    expect(photoStorage.deletePhoto).not.toHaveBeenCalled(); // No cleanup on error
  });

  it('should return empty array if both database and Drive fail', async () => {
    photoStorage.getPhotos
      .mockResolvedValueOnce([]) // First call succeeds with empty
      .mockRejectedValueOnce(new Error('DB error')); // Fallback fails
    googleDrive.listDriveFiles.mockRejectedValue(new Error('Drive error'));

    const request = new Request('http://localhost:3000/api/photos');
    const response = await GET(request);
    const data = await response.json();

    expect(data).toEqual([]);
  });

  it('should force proxy URLs for all non-mock photos', async () => {
    const mockPhotos = [
      {
        id: 1,
        driveId: 'drive123',
        name: 'photo1.jpg',
        url: 'https://drive.google.com/uc?id=drive123', // Direct Drive URL
        mainFaceId: 'unknown',
        faceIds: [],
        faceBoxes: [],
        poseId: 'unknown_pose',
        uploaderId: 'uploader1',
        timestamp: new Date(),
      },
    ];

    const validDriveIds = new Set(['drive123']);

    photoStorage.getPhotos.mockResolvedValue(mockPhotos);
    googleDrive.listDriveFiles.mockResolvedValue(validDriveIds);

    const request = new Request('http://localhost:3000/api/photos');
    const response = await GET(request);
    const data = await response.json();

    expect(data[0].url).toBe('/api/image/drive123'); // Forced to proxy
  });
});
