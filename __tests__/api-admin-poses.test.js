/**
 * Tests for Pose Management API
 *
 * Tests all CRUD operations for pose challenges including:
 * - GET: List all poses
 * - POST: Create new pose with image upload
 * - PUT: Update existing pose
 * - DELETE: Remove pose
 */

import { isAdminAuthenticated } from '../lib/adminAuth';
import fs from 'fs';
import path from 'path';

// Mock dependencies BEFORE importing the route
jest.mock('../lib/adminAuth');
jest.mock('fs');

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data, init = {}) => {
      return new global.Response(JSON.stringify(data), {
        ...init,
        headers: {
          'content-type': 'application/json',
          ...init.headers,
        },
      });
    },
  },
}));

// Import route handlers AFTER mocking
import { GET, POST, PUT, DELETE } from '../app/api/admin/poses/route';

// Mock data directory paths
const CHALLENGES_FILE_PATH = path.join(process.cwd(), 'data', 'challenges.json');
const CHALLENGES_IMAGE_DIR = path.join(process.cwd(), 'public', 'challenges');

// Mock challenge data
const mockChallenges = [
  {
    id: 'romantic-dip',
    title: 'Romantic Dip',
    instruction: 'Dip your partner romantically',
    image: '/challenges/romantic-dip.png',
    folderId: '123abc',
  },
  {
    id: 'sweet-whisper',
    title: 'Sweet Whisper',
    instruction: 'Whisper something sweet',
    image: '/challenges/sweet-whisper.jpg',
    folderId: '456def',
  },
];

// Helper to create mock Request object
function createMockRequest(options = {}) {
  const {
    method = 'GET',
    url = 'http://localhost:3000/api/admin/poses',
    headers = {},
    body = null,
  } = options;

  const request = {
    method,
    url,
    headers: new Map(Object.entries({
      'content-type': 'application/json',
      ...headers,
    })),
    formData: jest.fn(),
  };

  // Add headers.get method
  request.headers.get = function(key) {
    return this.get(key.toLowerCase());
  };

  if (body) {
    request.formData.mockResolvedValue(body);
  }

  return request;
}

// Helper to create mock File object
function createMockFile(options = {}) {
  const {
    name = 'test-image.png',
    type = 'image/png',
    size = 1024,
    content = Buffer.from('fake-image-data'),
  } = options;

  // Create a proper File-like object that passes instanceof File check
  const file = Object.create(global.File ? global.File.prototype : {});
  Object.defineProperties(file, {
    name: { value: name, writable: false },
    type: { value: type, writable: false },
    size: { value: size, writable: false },
    arrayBuffer: {
      value: jest.fn().mockResolvedValue(content.buffer),
      writable: false
    },
  });

  return file;
}

// Helper to create mock FormData
function createMockFormData(data = {}) {
  const formData = new Map(Object.entries(data));
  formData.get = function(key) {
    return this.has(key) ? Map.prototype.get.call(this, key) : null;
  };
  return formData;
}

describe('Pose Management API', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(mockChallenges));
    fs.writeFileSync.mockImplementation(() => {});
    fs.renameSync.mockImplementation(() => {});
    fs.mkdirSync.mockImplementation(() => {});
    fs.unlinkSync.mockImplementation(() => {});
  });

  describe('GET - List all poses', () => {
    it('should return all poses successfully', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockChallenges);
      expect(fs.readFileSync).toHaveBeenCalledWith(CHALLENGES_FILE_PATH, 'utf8');
    });

    it('should initialize empty array if file does not exist', async () => {
      fs.existsSync.mockReturnValue(false);

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual([]);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        CHALLENGES_FILE_PATH,
        JSON.stringify([], null, 2)
      );
    });

    it('should handle file read errors', async () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File read error');
      });

      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });

    it('should not require authentication', async () => {
      const request = createMockRequest();
      await GET(request);

      expect(isAdminAuthenticated).not.toHaveBeenCalled();
    });
  });

  describe('POST - Create new pose', () => {
    it('should create new pose successfully', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      const mockImage = createMockFile();
      const formData = createMockFormData({
        title: 'New Dance Move',
        instruction: 'Dance together gracefully',
        image: mockImage,
        folderId: '789ghi',
      });

      const request = createMockRequest({
        method: 'POST',
        body: formData,
        headers: { authorization: 'Bearer valid-token' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        id: 'new-dance-move',
        title: 'New Dance Move',
        instruction: 'Dance together gracefully',
        folderId: '789ghi',
      });
      expect(data.data.image).toMatch(/\/challenges\/new-dance-move\.(png|jpg)/);

      // Verify image was saved
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('new-dance-move.png'),
        expect.any(Buffer)
      );

      // Verify challenges were written
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.tmp'),
        expect.stringContaining('new-dance-move')
      );
    });

    it('should reject request without authentication', async () => {
      isAdminAuthenticated.mockReturnValue(false);

      const request = createMockRequest({ method: 'POST' });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });

    it('should reject request with missing title', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      const mockImage = createMockFile();
      const formData = createMockFormData({
        instruction: 'Dance together',
        image: mockImage,
      });

      const request = createMockRequest({
        method: 'POST',
        body: formData,
        headers: { authorization: 'Bearer valid-token' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Title is required');
    });

    it('should reject request with missing instruction', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      const mockImage = createMockFile();
      const formData = createMockFormData({
        title: 'New Pose',
        image: mockImage,
      });

      const request = createMockRequest({
        method: 'POST',
        body: formData,
        headers: { authorization: 'Bearer valid-token' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Instruction is required');
    });

    it('should reject request with missing image', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      const formData = createMockFormData({
        title: 'New Pose',
        instruction: 'Do something fun',
      });

      const request = createMockRequest({
        method: 'POST',
        body: formData,
        headers: { authorization: 'Bearer valid-token' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Image file is required');
    });

    it('should reject duplicate pose ID', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      const mockImage = createMockFile();
      const formData = createMockFormData({
        title: 'Romantic Dip', // Will generate ID 'romantic-dip' which exists
        instruction: 'Duplicate pose',
        image: mockImage,
      });

      const request = createMockRequest({
        method: 'POST',
        body: formData,
        headers: { authorization: 'Bearer valid-token' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('already exists');
    });

    it('should reject invalid file type', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      const mockImage = createMockFile({ type: 'image/gif' });
      const formData = createMockFormData({
        title: 'New Pose',
        instruction: 'Test instruction',
        image: mockImage,
      });

      const request = createMockRequest({
        method: 'POST',
        body: formData,
        headers: { authorization: 'Bearer valid-token' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid file type');
    });

    it('should reject oversized file', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      const mockImage = createMockFile({ size: 6 * 1024 * 1024 }); // 6MB
      const formData = createMockFormData({
        title: 'New Pose',
        instruction: 'Test instruction',
        image: mockImage,
      });

      const request = createMockRequest({
        method: 'POST',
        body: formData,
        headers: { authorization: 'Bearer valid-token' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('exceeds 5MB limit');
    });

    it('should handle JPEG images correctly', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      const mockImage = createMockFile({ type: 'image/jpeg', name: 'test.jpg' });
      const formData = createMockFormData({
        title: 'JPEG Pose',
        instruction: 'Test with JPEG',
        image: mockImage,
      });

      const request = createMockRequest({
        method: 'POST',
        body: formData,
        headers: { authorization: 'Bearer valid-token' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.data.image).toContain('.jpg');
    });

    it('should cleanup image on metadata save failure', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      // Mock writeFileSync to succeed for image but fail for challenges
      let writeCallCount = 0;
      fs.writeFileSync.mockImplementation((filepath) => {
        writeCallCount++;
        if (filepath.includes('challenges.json')) {
          throw new Error('Metadata save failed');
        }
      });

      const mockImage = createMockFile();
      const formData = createMockFormData({
        title: 'Test Pose',
        instruction: 'Test instruction',
        image: mockImage,
      });

      const request = createMockRequest({
        method: 'POST',
        body: formData,
        headers: { authorization: 'Bearer valid-token' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(fs.unlinkSync).toHaveBeenCalled();
    });
  });

  describe('PUT - Update existing pose', () => {
    it('should update pose successfully', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      const formData = createMockFormData({
        id: 'romantic-dip',
        title: 'Updated Romantic Dip',
        instruction: 'Updated instruction',
        folderId: 'new-folder-id',
      });

      const request = createMockRequest({
        method: 'PUT',
        body: formData,
        headers: { authorization: 'Bearer valid-token' },
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        id: 'romantic-dip',
        title: 'Updated Romantic Dip',
        instruction: 'Updated instruction',
        folderId: 'new-folder-id',
      });
    });

    it('should update only provided fields', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      const formData = createMockFormData({
        id: 'romantic-dip',
        title: 'Partially Updated Title',
      });

      const request = createMockRequest({
        method: 'PUT',
        body: formData,
        headers: { authorization: 'Bearer valid-token' },
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.title).toBe('Partially Updated Title');
      expect(data.data.instruction).toBe(mockChallenges[0].instruction); // Unchanged
    });

    it('should update image when provided', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      const mockImage = createMockFile({ name: 'new-image.png' });
      const formData = createMockFormData({
        id: 'romantic-dip',
        image: mockImage,
      });

      const request = createMockRequest({
        method: 'PUT',
        body: formData,
        headers: { authorization: 'Bearer valid-token' },
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('romantic-dip.png'),
        expect.any(Buffer)
      );
    });

    it('should reject request without authentication', async () => {
      isAdminAuthenticated.mockReturnValue(false);

      const request = createMockRequest({ method: 'PUT' });
      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });

    it('should reject request with missing ID', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      const formData = createMockFormData({
        title: 'Updated Title',
      });

      const request = createMockRequest({
        method: 'PUT',
        body: formData,
        headers: { authorization: 'Bearer valid-token' },
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Pose ID is required');
    });

    it('should return 404 for non-existent pose', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      const formData = createMockFormData({
        id: 'non-existent-pose',
        title: 'Updated Title',
      });

      const request = createMockRequest({
        method: 'PUT',
        body: formData,
        headers: { authorization: 'Bearer valid-token' },
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('should reject invalid image file', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      const mockImage = createMockFile({ type: 'image/gif' });
      const formData = createMockFormData({
        id: 'romantic-dip',
        image: mockImage,
      });

      const request = createMockRequest({
        method: 'PUT',
        body: formData,
        headers: { authorization: 'Bearer valid-token' },
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid file type');
    });
  });

  describe('DELETE - Remove pose', () => {
    it('should delete pose successfully', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      const request = createMockRequest({
        method: 'DELETE',
        url: 'http://localhost:3000/api/admin/poses?id=romantic-dip',
        headers: { authorization: 'Bearer valid-token' },
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe('romantic-dip');
      expect(data.data.note).toContain('Image file preserved');

      // Verify challenges were updated (without deleted pose)
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should preserve image file after deletion', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      const request = createMockRequest({
        method: 'DELETE',
        url: 'http://localhost:3000/api/admin/poses?id=romantic-dip',
        headers: { authorization: 'Bearer valid-token' },
      });

      await DELETE(request);

      // Verify unlinkSync was NOT called for image deletion
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should reject request without authentication', async () => {
      isAdminAuthenticated.mockReturnValue(false);

      const request = createMockRequest({
        method: 'DELETE',
        url: 'http://localhost:3000/api/admin/poses?id=romantic-dip',
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });

    it('should reject request with missing ID', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      const request = createMockRequest({
        method: 'DELETE',
        url: 'http://localhost:3000/api/admin/poses',
        headers: { authorization: 'Bearer valid-token' },
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Pose ID is required');
    });

    it('should return 404 for non-existent pose', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      const request = createMockRequest({
        method: 'DELETE',
        url: 'http://localhost:3000/api/admin/poses?id=non-existent-pose',
        headers: { authorization: 'Bearer valid-token' },
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });
  });

  describe('Slugify function', () => {
    it('should convert title to lowercase slug', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      const mockImage = createMockFile();
      const formData = createMockFormData({
        title: 'The ROMANTIC Dip',
        instruction: 'Test',
        image: mockImage,
      });

      const request = createMockRequest({
        method: 'POST',
        body: formData,
        headers: { authorization: 'Bearer valid-token' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data.id).toBe('the-romantic-dip');
    });

    it('should replace spaces with hyphens', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      const mockImage = createMockFile();
      const formData = createMockFormData({
        title: 'Sweet Whisper Moment',
        instruction: 'Test',
        image: mockImage,
      });

      const request = createMockRequest({
        method: 'POST',
        body: formData,
        headers: { authorization: 'Bearer valid-token' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data.id).toBe('sweet-whisper-moment');
    });

    it('should remove special characters', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      const mockImage = createMockFile();
      const formData = createMockFormData({
        title: 'Dance & Spin! (Fun)',
        instruction: 'Test',
        image: mockImage,
      });

      const request = createMockRequest({
        method: 'POST',
        body: formData,
        headers: { authorization: 'Bearer valid-token' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data.id).toBe('dance-spin-fun');
    });

    it('should trim leading and trailing hyphens', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      const mockImage = createMockFile();
      const formData = createMockFormData({
        title: '  -Test Pose-  ',
        instruction: 'Test',
        image: mockImage,
      });

      const request = createMockRequest({
        method: 'POST',
        body: formData,
        headers: { authorization: 'Bearer valid-token' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.data.id).toBe('test-pose');
    });
  });
});
