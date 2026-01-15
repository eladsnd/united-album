/**
 * API Endpoint Tests - Upload
 * Tests the /api/upload endpoint functionality
 */

import { POST } from '../../app/api/upload/route';

// Mock dependencies
jest.mock('../../lib/googleDrive');
jest.mock('../../lib/photoStorage');
jest.mock('../../lib/rateLimit');

import { uploadToDrive } from '../../lib/googleDrive';
import { savePhoto } from '../../lib/photoStorage';
import { applyRateLimit } from '../../lib/rateLimit';

describe('POST /api/upload', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Mock rate limiting to always allow
        applyRateLimit.mockReturnValue({
            allowed: true,
            headers: {}
        });

        // Mock Google Drive upload
        uploadToDrive.mockResolvedValue({
            id: 'mock_drive_id_123',
            webViewLink: 'https://drive.google.com/file/d/mock_drive_id_123'
        });

        // Mock photo storage
        savePhoto.mockImplementation((photo) => photo);

        // Mock environment variables
        process.env.GOOGLE_CLIENT_ID = 'test_client_id';
        process.env.GOOGLE_REFRESH_TOKEN = 'test_refresh_token';
        process.env.GOOGLE_DRIVE_FOLDER_ID = 'test_folder_id';
    });

    it('should upload photo successfully', async () => {
        const formData = new FormData();
        const mockFile = new Blob(['test'], { type: 'image/jpeg' });
        formData.append('file', mockFile, 'test.jpg');
        formData.append('mainFaceId', 'person_0');
        formData.append('faceIds', 'person_0');
        formData.append('faceBoxes', JSON.stringify([{ x: 10, y: 10, width: 50, height: 50 }]));
        formData.append('poseId', 'test_pose');

        const request = new Request('http://localhost:3000/api/upload', {
            method: 'POST',
            body: formData
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.photo).toBeDefined();
        expect(uploadToDrive).toHaveBeenCalled();
        expect(savePhoto).toHaveBeenCalled();
    });

    it('should reject upload without file', async () => {
        const formData = new FormData();
        formData.append('mainFaceId', 'person_0');

        const request = new Request('http://localhost:3000/api/upload', {
            method: 'POST',
            body: formData
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('No file uploaded');
    });

    it('should reject upload without OAuth credentials', async () => {
        delete process.env.GOOGLE_CLIENT_ID;

        const formData = new FormData();
        const mockFile = new Blob(['test'], { type: 'image/jpeg' });
        formData.append('file', mockFile, 'test.jpg');

        const request = new Request('http://localhost:3000/api/upload', {
            method: 'POST',
            body: formData
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.code).toBe('CREDENTIALS_MISSING');
    });

    it('should apply rate limiting', async () => {
        applyRateLimit.mockReturnValue({
            allowed: false,
            response: new Response(
                JSON.stringify({ error: 'Rate limit exceeded' }),
                { status: 429 }
            )
        });

        const formData = new FormData();
        const mockFile = new Blob(['test'], { type: 'image/jpeg' });
        formData.append('file', mockFile, 'test.jpg');

        const request = new Request('http://localhost:3000/api/upload', {
            method: 'POST',
            body: formData
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(429);
        expect(data.error).toContain('Rate limit');
        expect(uploadToDrive).not.toHaveBeenCalled();
    });

    it('should handle Drive upload failure', async () => {
        uploadToDrive.mockRejectedValue(new Error('Drive API error'));

        const formData = new FormData();
        const mockFile = new Blob(['test'], { type: 'image/jpeg' });
        formData.append('file', mockFile, 'test.jpg');

        const request = new Request('http://localhost:3000/api/upload', {
            method: 'POST',
            body: formData
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.code).toBe('DRIVE_UPLOAD_FAILED');
        expect(data.error).toContain('Drive upload failed');
    });

    it('should save photo metadata with correct structure', async () => {
        const formData = new FormData();
        const mockFile = new Blob(['test'], { type: 'image/jpeg' });
        formData.append('file', mockFile, 'test.jpg');
        formData.append('mainFaceId', 'person_5');
        formData.append('faceIds', 'person_5,person_2');
        formData.append('faceBoxes', JSON.stringify([
            { x: 10, y: 10, width: 50, height: 50 },
            { x: 100, y: 100, width: 45, height: 45 }
        ]));
        formData.append('poseId', 'romantic_dip');

        const request = new Request('http://localhost:3000/api/upload', {
            method: 'POST',
            body: formData
        });

        await POST(request);

        expect(savePhoto).toHaveBeenCalledWith(
            expect.objectContaining({
                driveId: 'mock_drive_id_123',
                mainFaceId: 'person_5',
                faceIds: ['person_5', 'person_2'],
                faceBoxes: [
                    { x: 10, y: 10, width: 50, height: 50 },
                    { x: 100, y: 100, width: 45, height: 45 }
                ],
                poseId: 'romantic_dip',
                url: '/api/image/mock_drive_id_123'
            })
        );
    });
});
