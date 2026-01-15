# Architecture Improvements & Best Practices

## Executive Summary

This document outlines recommended improvements for the United Album codebase, focusing on:
- Code organization and design patterns
- Error handling and resilience
- Security best practices
- Performance optimizations
- Maintainability and scalability

---

## 1. Code Organization & Architecture

### Current State
- ✅ Good separation between `/lib`, `/utils`, `/components`, `/app`
- ✅ Next.js App Router structure properly used
- ❌ Some inconsistent patterns across API routes
- ❌ Lack of centralized error handling
- ❌ No DTOs (Data Transfer Objects) or validation schemas

### Recommendations

#### 1.1 Implement Repository Pattern for Data Access

**Current Issue**: Direct file I/O scattered across codebase
**Solution**: Create abstract repository layer

```javascript
// lib/repositories/BaseRepository.js
export class BaseRepository {
    constructor(filePath) {
        this.filePath = filePath;
    }

    async findAll() { /* implementation */ }
    async findById(id) { /* implementation */ }
    async save(entity) { /* implementation */ }
    async delete(id) { /* implementation */ }
}

// lib/repositories/PhotoRepository.js
export class PhotoRepository extends BaseRepository {
    constructor() {
        super(path.join(process.cwd(), 'data', 'photos.json'));
    }

    async findByDriveId(driveId) { /* custom query */ }
    async findByFaceId(faceId) { /* custom query */ }
}
```

**Benefits**:
- Single source of truth for data operations
- Easier to swap storage backend (JSON → Database)
- Better testability with mock repositories

#### 1.2 Add Request/Response DTOs with Validation

**Current Issue**: No validation of incoming data
**Solution**: Use Zod for runtime type safety

```bash
npm install zod
```

```javascript
// lib/schemas/photoSchema.js
import { z } from 'zod';

export const UploadPhotoSchema = z.object({
    file: z.instanceof(File),
    folderId: z.string().optional(),
    poseId: z.string().optional(),
    uploaderId: z.string().min(1),
});

export const PhotoResponseSchema = z.object({
    id: z.number(),
    driveId: z.string(),
    url: z.string().url(),
    faceIds: z.array(z.string()),
    mainFaceId: z.string(),
    timestamp: z.string().datetime(),
});

// Usage in API route
export async function POST(request) {
    const formData = await request.formData();
    const data = {
        file: formData.get('file'),
        folderId: formData.get('folderId'),
        uploaderId: formData.get('uploaderId'),
    };

    const validated = UploadPhotoSchema.parse(data); // Throws if invalid
    // ... rest of handler
}
```

**Benefits**:
- Runtime type safety
- Automatic validation errors
- Self-documenting API contracts
- Prevents invalid data from entering system

---

## 2. Error Handling & Resilience

### Current State
- ❌ Inconsistent error handling across API routes
- ❌ Generic error messages exposed to clients
- ❌ No error monitoring/logging infrastructure
- ✅ Basic try-catch blocks present

### Recommendations

#### 2.1 Centralized Error Handling Middleware

```javascript
// lib/middleware/errorHandler.js
export class AppError extends Error {
    constructor(message, statusCode, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
    }
}

export const errorHandler = (error, request) => {
    // Log error with context
    console.error('[Error]', {
        message: error.message,
        stack: error.stack,
        url: request.url,
        method: request.method,
        timestamp: new Date().toISOString(),
    });

    // Don't expose internal errors to client
    if (error.isOperational) {
        return NextResponse.json({
            error: error.message,
            code: error.code,
        }, { status: error.statusCode });
    }

    // Generic error for unexpected failures
    return NextResponse.json({
        error: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
    }, { status: 500 });
};

// Usage in API routes
export async function POST(request) {
    try {
        // ... handler logic
    } catch (error) {
        return errorHandler(error, request);
    }
}
```

#### 2.2 Implement Retry Logic with Exponential Backoff

**Already implemented in `UploadSection.js`** ✅ - Replicate pattern elsewhere

```javascript
// lib/utils/retry.js
export async function retryWithBackoff(fn, options = {}) {
    const {
        maxRetries = 3,
        baseDelay = 1000,
        maxDelay = 10000,
        shouldRetry = () => true,
    } = options;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === maxRetries || !shouldRetry(error)) {
                throw error;
            }

            const delay = Math.min(
                baseDelay * Math.pow(2, attempt),
                maxDelay
            );

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// Usage
const result = await retryWithBackoff(
    () => uploadToDrive(fileBuffer, fileName, folderId),
    {
        maxRetries: 3,
        shouldRetry: (error) => error.code === 'RATE_LIMIT' || error.code === 'NETWORK_ERROR',
    }
);
```

---

## 3. Security Improvements

### Current State
- ✅ Admin authentication with HMAC tokens
- ✅ Uploader session IDs for ownership
- ❌ No request validation/sanitization
- ❌ No rate limiting on most endpoints
- ❌ Potential path traversal in file operations

### Recommendations

#### 3.1 Input Sanitization & Validation

```javascript
// lib/utils/sanitize.js
export function sanitizeFileName(fileName) {
    return fileName
        .replace(/[^a-zA-Z0-9._-]/g, '-') // Remove special chars
        .replace(/\.{2,}/g, '.') // Prevent directory traversal
        .replace(/^\./, '') // Remove leading dot
        .slice(0, 255); // Limit length
}

export function sanitizeDriveId(driveId) {
    // Google Drive IDs are alphanumeric with dashes/underscores
    if (!/^[a-zA-Z0-9_-]{20,50}$/.test(driveId)) {
        throw new AppError('Invalid Drive ID format', 400, 'INVALID_DRIVE_ID');
    }
    return driveId;
}
```

#### 3.2 Expand Rate Limiting

**Current**: Only on `/api/upload`
**Recommendation**: Add to all mutation endpoints

```javascript
// lib/middleware/rateLimit.js - enhance existing
const RATE_LIMITS = {
    '/api/upload': { max: 10, window: 60000 },
    '/api/delete-photo': { max: 20, window: 60000 },
    '/api/update-faces': { max: 15, window: 60000 },
    '/api/admin/poses': { max: 30, window: 60000 },
};

export function getRateLimiter(endpoint) {
    const config = RATE_LIMITS[endpoint] || { max: 100, window: 60000 };
    return createRateLimiter(config);
}
```

#### 3.3 Secure File Upload Validation

```javascript
// lib/validators/fileUpload.js
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function validateUploadFile(file) {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        throw new AppError('File too large (max 10MB)', 400, 'FILE_TOO_LARGE');
    }

    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new AppError('Invalid file type. Only JPEG, PNG, WebP allowed', 400, 'INVALID_FILE_TYPE');
    }

    // Verify actual file content matches MIME type (magic number check)
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // JPEG magic number: FF D8 FF
    // PNG magic number: 89 50 4E 47
    const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
    const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;

    if (!isJPEG && !isPNG) {
        throw new AppError('File content does not match declared type', 400, 'FILE_CONTENT_MISMATCH');
    }

    return true;
}
```

---

## 4. Performance Optimizations

### Current State
- ❌ No caching strategy
- ❌ Full file reads on every API call
- ❌ No image optimization pipeline
- ✅ Face detection models lazy-loaded client-side

### Recommendations

#### 4.1 Implement Response Caching

```javascript
// lib/cache/memoryCache.js
class MemoryCache {
    constructor(ttl = 60000) {
        this.cache = new Map();
        this.ttl = ttl;
    }

    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return null;
        }

        return entry.value;
    }

    set(key, value, ttl = this.ttl) {
        this.cache.set(key, {
            value,
            expiry: Date.now() + ttl,
        });
    }

    clear() {
        this.cache.clear();
    }
}

export const photosCache = new MemoryCache(30000); // 30s TTL
export const facesCache = new MemoryCache(60000); // 60s TTL

// Usage in photoStorage.js
export function getPhotos() {
    const cached = photosCache.get('all_photos');
    if (cached) return cached;

    const photos = loadPhotos();
    photosCache.set('all_photos', photos);
    return photos;
}
```

#### 4.2 Lazy Load Components

```javascript
// app/page.js
import dynamic from 'next/dynamic';

const FaceGallery = dynamic(() => import('../components/FaceGallery'), {
    loading: () => <GallerySkeleton />,
    ssr: false, // Client-side only (uses localStorage)
});

const AdminPoseManager = dynamic(() => import('../components/AdminPoseManager'), {
    loading: () => <div>Loading admin panel...</div>,
});
```

#### 4.3 Optimize JSON File I/O

```javascript
// lib/storage/optimizedFileIO.js
import { promises as fs } from 'fs';

export class OptimizedJSONStorage {
    constructor(filePath) {
        this.filePath = filePath;
        this.writeQueue = Promise.resolve();
    }

    async read() {
        try {
            const data = await fs.readFile(this.filePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') return [];
            throw error;
        }
    }

    async write(data) {
        // Queue writes to prevent race conditions
        this.writeQueue = this.writeQueue.then(async () => {
            const tempFile = `${this.filePath}.tmp`;
            await fs.writeFile(tempFile, JSON.stringify(data, null, 2));
            await fs.rename(tempFile, this.filePath);
        });
        return this.writeQueue;
    }
}
```

---

## 5. Design Patterns to Implement

### 5.1 Service Layer Pattern

Separate business logic from API routes:

```javascript
// lib/services/PhotoService.js
export class PhotoService {
    constructor(photoRepo, faceRepo, driveService) {
        this.photoRepo = photoRepo;
        this.faceRepo = faceRepo;
        this.driveService = driveService;
    }

    async uploadPhoto({ file, poseId, uploaderId }) {
        // 1. Validate file
        await validateUploadFile(file);

        // 2. Upload to Drive
        const driveFile = await this.driveService.upload(file);

        // 3. Detect faces
        const faces = await detectFaces(file);

        // 4. Save metadata
        const photo = await this.photoRepo.save({
            driveId: driveFile.id,
            poseId,
            uploaderId,
            faceIds: faces.map(f => f.id),
            timestamp: new Date().toISOString(),
        });

        return photo;
    }

    async deletePhoto(photoId, requesterId) {
        const photo = await this.photoRepo.findById(photoId);
        if (!photo) {
            throw new AppError('Photo not found', 404, 'PHOTO_NOT_FOUND');
        }

        // Check permissions
        if (photo.uploaderId !== requesterId) {
            throw new AppError('Unauthorized', 403, 'FORBIDDEN');
        }

        // Delete from Drive
        await this.driveService.delete(photo.driveId);

        // Delete metadata
        await this.photoRepo.delete(photoId);

        // Cleanup orphaned faces
        await this.cleanupOrphanedFaces(photo.faceIds);

        return { success: true };
    }
}

// app/api/upload/route.js becomes thin:
export async function POST(request) {
    try {
        const formData = await request.formData();
        const photo = await photoService.uploadPhoto({
            file: formData.get('file'),
            poseId: formData.get('poseId'),
            uploaderId: formData.get('uploaderId'),
        });
        return NextResponse.json({ success: true, photo });
    } catch (error) {
        return errorHandler(error, request);
    }
}
```

### 5.2 Factory Pattern for Google Drive Operations

```javascript
// lib/factories/DriveClientFactory.js
export class DriveClientFactory {
    static async create() {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );

        oauth2Client.setCredentials({
            refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        });

        return google.drive({ version: 'v3', auth: oauth2Client });
    }
}

// lib/services/DriveService.js
export class DriveService {
    async upload(fileBuffer, fileName, folderId) { /* ... */ }
    async download(fileId) { /* ... */ }
    async delete(fileId) { /* ... */ }
    async createFolder(name, parentId) { /* ... */ }
}
```

### 5.3 Observer Pattern for Real-time Updates

```javascript
// lib/events/EventEmitter.js
export class EventEmitter {
    constructor() {
        this.listeners = new Map();
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    emit(event, data) {
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach(callback => callback(data));
    }
}

export const appEvents = new EventEmitter();

// Usage in photoService
async uploadPhoto(data) {
    const photo = await this.photoRepo.save(data);
    appEvents.emit('photo:uploaded', photo);
    return photo;
}

// In components
useEffect(() => {
    const handler = () => fetchPhotos();
    appEvents.on('photo:uploaded', handler);
    return () => appEvents.off('photo:uploaded', handler);
}, []);
```

---

## 6. Testing Improvements

### Current State
- ✅ Good test coverage for components
- ✅ E2E tests with Playwright
- ❌ No integration tests for services
- ❌ No API contract tests

### Recommendations

#### 6.1 Add API Contract Tests

```javascript
// __tests__/contracts/uploadAPI.contract.test.js
import { UploadPhotoSchema, PhotoResponseSchema } from '@/lib/schemas';

describe('Upload API Contract', () => {
    it('accepts valid upload request', () => {
        const validRequest = {
            file: new File(['content'], 'test.jpg', { type: 'image/jpeg' }),
            poseId: 'test-pose',
            uploaderId: 'user_123',
        };

        expect(() => UploadPhotoSchema.parse(validRequest)).not.toThrow();
    });

    it('returns valid photo response', () => {
        const validResponse = {
            id: 123,
            driveId: 'abc123',
            url: 'https://example.com/photo.jpg',
            faceIds: ['person_1'],
            mainFaceId: 'person_1',
            timestamp: new Date().toISOString(),
        };

        expect(() => PhotoResponseSchema.parse(validResponse)).not.toThrow();
    });
});
```

#### 6.2 Add Service Integration Tests

```javascript
// __tests__/integration/PhotoService.test.js
import { PhotoService } from '@/lib/services/PhotoService';

describe('PhotoService Integration', () => {
    let service;
    let mockPhotoRepo;
    let mockDriveService;

    beforeEach(() => {
        mockPhotoRepo = {
            save: jest.fn(),
            findById: jest.fn(),
        };
        mockDriveService = {
            upload: jest.fn(),
            delete: jest.fn(),
        };
        service = new PhotoService(mockPhotoRepo, null, mockDriveService);
    });

    it('uploads photo and saves metadata', async () => {
        mockDriveService.upload.mockResolvedValue({ id: 'drive123' });
        mockPhotoRepo.save.mockResolvedValue({ id: 1, driveId: 'drive123' });

        const result = await service.uploadPhoto({
            file: new File(['test'], 'test.jpg'),
            poseId: 'pose1',
            uploaderId: 'user1',
        });

        expect(mockDriveService.upload).toHaveBeenCalled();
        expect(mockPhotoRepo.save).toHaveBeenCalledWith(
            expect.objectContaining({ driveId: 'drive123' })
        );
    });
});
```

---

## 7. Logging & Monitoring

### Recommendations

#### 7.1 Structured Logging

```javascript
// lib/logger/index.js
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
};

class Logger {
    constructor(context) {
        this.context = context;
        this.level = process.env.LOG_LEVEL || 'INFO';
    }

    error(message, meta = {}) {
        if (LOG_LEVELS[this.level] >= LOG_LEVELS.ERROR) {
            console.error(JSON.stringify({
                level: 'ERROR',
                context: this.context,
                message,
                ...meta,
                timestamp: new Date().toISOString(),
            }));
        }
    }

    info(message, meta = {}) {
        if (LOG_LEVELS[this.level] >= LOG_LEVELS.INFO) {
            console.log(JSON.stringify({
                level: 'INFO',
                context: this.context,
                message,
                ...meta,
                timestamp: new Date().toISOString(),
            }));
        }
    }
}

export const createLogger = (context) => new Logger(context);

// Usage
const logger = createLogger('PhotoService');
logger.info('Photo uploaded', { photoId: 123, uploaderId: 'user_1' });
```

---

## 8. Configuration Management

### Recommendation: Environment-based Configuration

```javascript
// lib/config/index.js
const config = {
    env: process.env.NODE_ENV || 'development',

    storage: {
        photosFile: process.env.PHOTOS_FILE || './data/photos.json',
        facesFile: process.env.FACES_FILE || './data/faces.json',
    },

    cache: {
        photosTTL: parseInt(process.env.CACHE_PHOTOS_TTL) || 30000,
        facesTTL: parseInt(process.env.CACHE_FACES_TTL) || 60000,
    },

    upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
        allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png').split(','),
    },

    faceDetection: {
        threshold: parseFloat(process.env.FACE_MATCH_THRESHOLD) || 0.50,
        maxSamples: parseInt(process.env.FACE_MAX_SAMPLES) || 5,
    },
};

export default config;
```

---

## Priority Implementation Order

### Phase 1: Foundation (Week 1)
1. ✅ Centralized error handling middleware
2. ✅ Input validation with Zod
3. ✅ File upload security validation
4. ✅ Structured logging

### Phase 2: Architecture (Week 2)
5. ⏳ Repository pattern for data access
6. ⏳ Service layer for business logic
7. ⏳ Configuration management
8. ⏳ Response caching

### Phase 3: Resilience (Week 3)
9. ⏳ Retry logic for all external calls
10. ⏳ Rate limiting on all mutation endpoints
11. ⏳ Graceful degradation for face detection
12. ⏳ Queue-based file writes

### Phase 4: Testing & Monitoring (Week 4)
13. ⏳ API contract tests
14. ⏳ Service integration tests
15. ⏳ Performance monitoring
16. ⏳ Error tracking (e.g., Sentry integration)

---

## Quick Wins (Can Implement Today)

1. **Fix Next.js config warning**:
   ```javascript
   // next.config.mjs - remove instrumentationHook
   const nextConfig = {
       images: { /* ... */ },
   };
   ```

2. **Add .env.example with all required vars**

3. **Sanitize all user inputs** (filenames, Drive IDs, etc.)

4. **Add JSDoc comments** to all exported functions

5. **Remove unused dependencies** from package.json

6. **Add pre-commit hooks** with Husky + lint-staged

---

## Long-term Considerations

### Database Migration
Current JSON files will become bottleneck at scale. Consider:
- PostgreSQL with Prisma ORM
- MongoDB for document storage
- S3-compatible storage for images

### Real-time Features
- WebSocket connections for live gallery updates
- Server-Sent Events for upload progress
- Redis pub/sub for multi-instance deployments

### CDN Integration
- CloudFront/Cloudflare for image delivery
- Optimize images with next/image
- Lazy loading with IntersectionObserver

---

## Conclusion

This roadmap provides a structured approach to improving code quality, security, and maintainability. Start with Quick Wins and Phase 1 priorities for immediate impact.
