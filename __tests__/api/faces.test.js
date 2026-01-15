/**
 * API Endpoint Tests - Faces
 * Tests the /api/faces endpoint functionality
 */

import { GET, POST } from '../../app/api/faces/route';

jest.mock('../../lib/faceStorage');

import { getAllFaces, saveFaceDescriptor } from '../../lib/faceStorage';

describe('GET /api/faces', () => {
    it('should return all faces', async () => {
        const mockFaces = [
            { faceId: 'person_0', descriptors: [[0.1, 0.2]], photoCount: 5 },
            { faceId: 'person_1', descriptors: [[0.3, 0.4]], photoCount: 3 }
        ];

        getAllFaces.mockReturnValue(mockFaces);

        const request = new Request('http://localhost:3000/api/faces');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual(mockFaces);
        expect(getAllFaces).toHaveBeenCalled();
    });

    it('should return empty array when no faces exist', async () => {
        getAllFaces.mockReturnValue([]);

        const request = new Request('http://localhost:3000/api/faces');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
        getAllFaces.mockImplementation(() => {
            throw new Error('Database error');
        });

        const request = new Request('http://localhost:3000/api/faces');
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to fetch faces');
    });
});

describe('POST /api/faces', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should save face descriptor successfully', async () => {
        const mockDescriptor = Array(128).fill(0).map((_, i) => i * 0.01);
        const mockFaceData = {
            faceId: 'person_7',
            descriptors: [mockDescriptor],
            descriptor: mockDescriptor,
            photoCount: 1,
            sampleCount: 1
        };

        saveFaceDescriptor.mockReturnValue(mockFaceData);

        const request = new Request('http://localhost:3000/api/faces', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                faceId: 'person_7',
                descriptor: mockDescriptor,
                metadata: { box: { x: 10, y: 10, width: 50, height: 50 } }
            })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.face).toEqual(mockFaceData);
        expect(saveFaceDescriptor).toHaveBeenCalledWith(
            'person_7',
            mockDescriptor,
            { box: { x: 10, y: 10, width: 50, height: 50 } }
        );
    });

    it('should reject request without faceId', async () => {
        const request = new Request('http://localhost:3000/api/faces', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                descriptor: [0.1, 0.2, 0.3]
            })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('faceId and descriptor are required');
        expect(saveFaceDescriptor).not.toHaveBeenCalled();
    });

    it('should reject request without descriptor', async () => {
        const request = new Request('http://localhost:3000/api/faces', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                faceId: 'person_8'
            })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('faceId and descriptor are required');
        expect(saveFaceDescriptor).not.toHaveBeenCalled();
    });

    it('should handle save errors gracefully', async () => {
        saveFaceDescriptor.mockImplementation(() => {
            throw new Error('Storage error');
        });

        const request = new Request('http://localhost:3000/api/faces', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                faceId: 'person_9',
                descriptor: [0.1, 0.2]
            })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Failed to save face');
    });
});
