# Design Patterns Analysis & Refactoring Recommendations

**Generated**: 2026-01-18
**Purpose**: Identify code smells, duplications, and design pattern violations across the codebase

---

## ✅ JUST FIXED: Stream Handling Duplication

### Problem Identified
Same stream-handling logic duplicated in 2 endpoints:
- `app/api/download/[driveId]/route.js` (lines 45-59)
- `app/api/download-album/route.js` (lines 47-62)

### Solution Implemented
Created centralized utility: `lib/streamUtils.js`
```javascript
// Before: 25+ lines of duplicated stream handling in each file
// After: 1 line call to shared utility
const buffer = await downloadDriveFile(getFileStream, driveId);
```

**Benefits**:
- DRY principle applied
- Single source of truth for stream handling
- Bugs fixed once, apply everywhere
- Easier to test and maintain

---

## 🔴 CRITICAL PATTERNS TO FIX

### 1. JSON File Storage Race Conditions

**Files Affected**:
- `lib/photoStorage.js` (all CRUD functions)
- `lib/faceStorage.js` (all CRUD functions)
- `app/api/admin/poses/route.js` (writeChallenges)

**Problem**: Non-atomic read-modify-write operations
```javascript
// RACE CONDITION EXAMPLE
export function savePhoto(photo) {
    const photos = loadPhotos();      // READ (unlocked)
    photos.push(photo);                // MODIFY
    fs.writeFileSync(PHOTOS_FILE, ...); // WRITE (overwrites)
    // ❌ Another concurrent request can overwrite this
}
```

**Scenario**:
```
Time | Request A              | Request B
-----|------------------------|------------------------
T1   | loadPhotos() → [p1]   |
T2   |                        | loadPhotos() → [p1]
T3   | push(p2) → [p1, p2]   |
T4   |                        | push(p3) → [p1, p3]
T5   | writeFile([p1, p2])   |
T6   |                        | writeFile([p1, p3]) ← OVERWRITES p2!
```

**Solution Option A - File Locking** (RECOMMENDED):
```javascript
import lockfile from 'proper-lockfile';

export async function savePhoto(photo) {
    const release = await lockfile.lock(PHOTOS_FILE, {
        retries: { retries: 5, factor: 2 }
    });

    try {
        const photos = loadPhotos();
        const existingIndex = photos.findIndex(p => p.driveId === photo.driveId);
        if (existingIndex !== -1) {
            photos[existingIndex] = photo;
        } else {
            photos.push(photo);
        }
        fs.writeFileSync(PHOTOS_FILE, JSON.stringify(photos, null, 2));
        return photo;
    } finally {
        await release();
    }
}
```

**Solution Option B - Queue Pattern**:
```javascript
// Single-threaded write queue
const writeQueue = [];
let isProcessing = false;

async function queueWrite(operation) {
    return new Promise((resolve, reject) => {
        writeQueue.push({ operation, resolve, reject });
        processQueue();
    });
}

async function processQueue() {
    if (isProcessing || writeQueue.length === 0) return;
    isProcessing = true;

    while (writeQueue.length > 0) {
        const { operation, resolve, reject } = writeQueue.shift();
        try {
            const result = await operation();
            resolve(result);
        } catch (error) {
            reject(error);
        }
    }

    isProcessing = false;
}
```

**Severity**: 🔴 Critical - Data loss possible
**Effort**: Medium (2-4 hours)
**Priority**: High

---

### 2. Synchronous File I/O Blocking Event Loop

**Files Affected**:
- `lib/photoStorage.js` (all functions)
- `lib/faceStorage.js` (all functions)
- `app/api/admin/poses/route.js` (readChallenges, writeChallenges)

**Problem**: Blocking operations prevent concurrent requests
```javascript
// BLOCKS EVENT LOOP
const data = fs.readFileSync(PHOTOS_FILE, 'utf-8'); // 10-100ms block
const photos = JSON.parse(data);
// During this time, NO other requests can be processed
```

**Impact**:
- 100 photos = ~50ms read time = ALL requests blocked for 50ms
- Upload + read + write = ~150ms total block
- 10 concurrent users = terrible UX

**Solution**: Use async file operations
```javascript
import fs from 'fs/promises';

async function loadPhotos() {
    ensureDataDir();

    try {
        const exists = await fs.access(PHOTOS_FILE)
            .then(() => true)
            .catch(() => false);

        if (!exists) return [];

        const data = await fs.readFile(PHOTOS_FILE, 'utf-8');

        if (!data || data.trim().length === 0) {
            return [];
        }

        const photos = JSON.parse(data);

        if (!Array.isArray(photos)) {
            return await restoreFromBackup() || [];
        }

        return photos;
    } catch (error) {
        if (error instanceof SyntaxError) {
            return await restoreFromBackup() || [];
        }
        throw error;
    }
}

export async function savePhoto(photo) {
    const photos = await loadPhotos();
    // ... modification logic
    await fs.writeFile(PHOTOS_FILE, JSON.stringify(photos, null, 2));
    return photo;
}
```

**Severity**: 🟠 High - Performance degradation
**Effort**: Medium (2-3 hours)
**Priority**: High

---

### 3. Duplicate photoCount Not Decremented

**File**: `lib/faceStorage.js`

**Problem**: Face photoCount increments on add, but never decrements on delete
```javascript
// Increments photoCount
export function saveFaceDescriptor(faceId, descriptor, metadata) {
    // ...
    photoCount: existingFace.photoCount + 1, // ✅ Increments
}

// DOES NOT decrement photoCount
export function deleteFace(faceId) {
    const faces = loadFaces();
    const filtered = faces.filter(f => f.faceId !== faceId);
    // ❌ No decrement
}
```

**Result**:
- Upload 5 photos with person_1 → photoCount = 5
- Delete 3 photos → photoCount still = 5 (wrong!)
- Gallery shows "5 photos" but only 2 exist

**Solution**: Track deletions properly
```javascript
// In PhotoService.deletePhoto()
const photo = await photoRepository.findById(photoId);

for (const faceId of photo.faceIds) {
    await faceService.decrementPhotoCount(faceId);
}

// In FaceService
async decrementPhotoCount(faceId) {
    const face = await this.faceRepository.findById(faceId);
    if (face) {
        face.photoCount = Math.max(0, face.photoCount - 1);
        await this.faceRepository.update(faceId, { photoCount: face.photoCount });

        // If photoCount reaches 0, delete the face
        if (face.photoCount === 0) {
            await this.deleteFace(faceId);
        }
    }
}
```

**Severity**: 🟡 Medium - Data inconsistency
**Effort**: Low (30 min)
**Priority**: Medium

---

### 4. No Database Abstraction (JSON Files at Scale)

**Files Affected**:
- `lib/photoStorage.js`
- `lib/faceStorage.js`

**Problem**: JSON files won't scale beyond ~1000 photos
- Every request loads entire JSON file into memory
- No indexing (O(n) lookups)
- No query optimization
- File size grows unbounded

**Current Limitations**:
- 10,000 photos × 2KB = 20MB JSON file loaded on EVERY request
- findById() = O(n) linear search
- filter() = O(n) full scan
- No pagination support

**Solution**: Migrate to database (SQLite, PostgreSQL, or MongoDB)

**Option A - SQLite** (Easiest migration):
```javascript
import Database from 'better-sqlite3';

const db = new Database('data/united-album.db');

// Create tables
db.exec(`
    CREATE TABLE IF NOT EXISTS photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        driveId TEXT UNIQUE NOT NULL,
        mainFaceId TEXT,
        faceIds TEXT, -- JSON array
        faceBoxes TEXT, -- JSON array
        poseId TEXT,
        uploaderId TEXT,
        timestamp TEXT
    );

    CREATE INDEX idx_driveId ON photos(driveId);
    CREATE INDEX idx_mainFaceId ON photos(mainFaceId);
    CREATE INDEX idx_poseId ON photos(poseId);
`);

// Repository methods
export function savePhoto(photo) {
    const stmt = db.prepare(`
        INSERT INTO photos (driveId, mainFaceId, faceIds, faceBoxes, poseId, uploaderId, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(driveId) DO UPDATE SET
            mainFaceId = excluded.mainFaceId,
            faceIds = excluded.faceIds,
            faceBoxes = excluded.faceBoxes
    `);

    stmt.run(
        photo.driveId,
        photo.mainFaceId,
        JSON.stringify(photo.faceIds),
        JSON.stringify(photo.faceBoxes),
        photo.poseId,
        photo.uploaderId,
        photo.timestamp
    );

    return photo;
}

export function getPhotos() {
    const stmt = db.prepare('SELECT * FROM photos ORDER BY timestamp DESC');
    const rows = stmt.all();

    return rows.map(row => ({
        ...row,
        faceIds: JSON.parse(row.faceIds),
        faceBoxes: JSON.parse(row.faceBoxes)
    }));
}

export function findByFaceId(faceId) {
    const stmt = db.prepare(`
        SELECT * FROM photos
        WHERE mainFaceId = ? OR faceIds LIKE ?
        ORDER BY timestamp DESC
    `);

    const rows = stmt.all(faceId, `%"${faceId}"%`);
    return rows.map(row => ({
        ...row,
        faceIds: JSON.parse(row.faceIds),
        faceBoxes: JSON.parse(row.faceBoxes)
    }));
}
```

**Benefits**:
- O(1) indexed lookups (vs O(n) linear)
- No memory overhead (doesn't load all data)
- ACID transactions (no race conditions)
- Pagination support
- Query optimization
- Scalable to millions of records

**Severity**: 🟡 Medium - Future scalability issue
**Effort**: High (6-8 hours)
**Priority**: Low (only needed at scale)

---

## 🟡 MEDIUM PATTERNS TO FIX

### 5. Filename Slug Generation Duplicated

**Files**:
- `app/api/admin/poses/route.js:28-53` (slugify function)
- `app/api/download/[driveId]/route.js:23-27` (poseSlug cleaning)

**Problem**: Same slug sanitization logic in 2 places
```javascript
// poses/route.js
function slugify(title) {
    const normalized = title.toLowerCase().trim().normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    const slug = normalized
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    // ...
}

// download/route.js
const poseSlug = photo.poseId
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
```

**Solution**: Create `lib/textUtils.js`
```javascript
/**
 * Convert text to URL-safe slug
 * Supports Unicode (Hebrew, Arabic, Chinese, etc.)
 */
export function slugify(text, options = {}) {
    const {
        lowercase = true,
        separator = '-',
        fallback = null
    } = options;

    // Normalize Unicode (remove diacritics)
    let slug = text.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    if (lowercase) {
        slug = slug.toLowerCase();
    }

    // Keep Unicode letters, numbers, spaces, separator
    slug = slug
        .replace(/[^\p{L}\p{N}\s-]/gu, separator)
        .replace(/[\s_-]+/g, separator)
        .replace(new RegExp(`^${separator}+|${separator}+$`, 'g'), '');

    // Fallback if empty
    if (!slug && fallback) {
        return typeof fallback === 'function' ? fallback() : fallback;
    }

    return slug;
}

// Usage
const poseId = slugify(title, {
    fallback: () => `pose-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
});
```

**Severity**: 🟡 Medium - Code duplication
**Effort**: Low (30 min)
**Priority**: Low

---

### 6. Error Handling Inconsistency

**Files**: All API routes

**Problem**: Mix of error handling patterns
```javascript
// Pattern 1: Try-catch with NextResponse
try {
    // ...
} catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
}

// Pattern 2: Try-catch with AppError
try {
    // ...
} catch (error) {
    throw new AppError(error.message, 500);
}

// Pattern 3: Direct NextResponse
if (!isValid) {
    return NextResponse.json({ error: 'Invalid' }, { status: 400 });
}

// Pattern 4: Interceptor-wrapped (NestJS-style)
export const POST = withErrorHandler(handler);
```

**Solution**: Standardize on interceptor pattern
```javascript
// ALL routes should use:
async function handler(request) {
    // Throw AppError for business logic errors
    if (!isValid) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    }

    // Let unexpected errors bubble up
    const result = await service.doSomething();

    return NextResponse.json({ success: true, data: result });
}

export const POST = withLogging(withErrorHandler(handler));

// Interceptor handles ALL errors consistently
```

**Benefits**:
- Consistent error responses
- Centralized error logging
- Stack traces in development only
- User-friendly messages

**Severity**: 🟡 Medium - Maintenance burden
**Effort**: Medium (2-3 hours)
**Priority**: Medium

---

### 7. Environment Variable Validation Missing

**File**: Multiple files access `process.env.*` directly

**Problem**: No startup validation of required env vars
```javascript
// These can fail at runtime, not startup
const secret = process.env.ADMIN_PASSWORD;
const clientId = process.env.GOOGLE_CLIENT_ID;
```

**Solution**: Validate on startup
```javascript
// lib/validateEnv.js
const requiredEnvVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REFRESH_TOKEN',
    'GOOGLE_DRIVE_FOLDER_ID',
    'ADMIN_PASSWORD'
];

export function validateEnvironment() {
    const missing = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables:\n${missing.map(v => `  - ${v}`).join('\n')}\n\n` +
            `Please check .env.local and .env.example`
        );
    }

    console.log('[Env] All required environment variables present ✅');
}

// app/layout.js or instrumentation.js
import { validateEnvironment } from '@/lib/validateEnv';
validateEnvironment();
```

**Severity**: 🟡 Medium - Poor error messages
**Effort**: Low (15 min)
**Priority**: Medium

---

## ℹ️ LOW PRIORITY IMPROVEMENTS

### 8. Magic Numbers/Strings

**Problem**: Hard-coded values scattered throughout
```javascript
// lib/rateLimit.js
maxRequests: 5,
windowMs: 60 * 1000,

// app/api/download-album/route.js
const MAX_PHOTOS_PER_ZIP = 50;

// utils/clientFaceDetection.js
const THRESHOLD_1_SAMPLE = 0.45;
const THRESHOLD_2_3_SAMPLES = 0.50;
const THRESHOLD_4_PLUS_SAMPLES = 0.55;
```

**Solution**: Centralize configuration
```javascript
// config/constants.js
export const RATE_LIMITS = {
    ADMIN_AUTH: { maxRequests: 5, windowMs: 60 * 1000 },
    UPLOAD: { maxRequests: 10, windowMs: 60 * 1000 },
    DELETE: { maxRequests: 10, windowMs: 60 * 1000 },
    DOWNLOAD: { maxRequests: 20, windowMs: 60 * 1000 },
    DOWNLOAD_ALBUM: { maxRequests: 3, windowMs: 60 * 60 * 1000 },
};

export const DOWNLOAD_LIMITS = {
    MAX_PHOTOS_PER_ZIP: 50,
    MAX_ZIP_SIZE_MB: 100,
};

export const FACE_RECOGNITION = {
    THRESHOLDS: {
        1: 0.45,
        2: 0.50,
        3: 0.50,
        4: 0.55,
    },
    MAX_DESCRIPTORS_PER_PERSON: 5,
    DESCRIPTOR_DIMENSIONS: 128,
};

export const FILE_LIMITS = {
    MAX_IMAGE_SIZE_MB: 5,
    ALLOWED_IMAGE_TYPES: ['image/png', 'image/jpeg', 'image/jpg'],
    COMPRESSION_QUALITY: 0.95,
};
```

**Severity**: ℹ️ Info - Maintainability
**Effort**: Low (1 hour)
**Priority**: Low

---

### 9. No Logging Strategy

**Problem**: Mix of `console.log`, `console.error`, `console.warn`
- No structured logging
- No log levels
- No log aggregation
- Hard to debug production issues

**Solution**: Use structured logging library
```javascript
import winston from 'winston';

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
    ],
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}

// Usage
logger.info('Photo uploaded', { photoId: 123, uploaderId: 'abc' });
logger.error('Upload failed', { error: err, photoId: 123 });
logger.warn('Rate limit exceeded', { ip: '1.2.3.4', endpoint: '/api/upload' });
```

**Severity**: ℹ️ Info - Debugging
**Effort**: Medium (2 hours)
**Priority**: Low

---

## 📋 Refactoring Priority Roadmap

### Immediate (This Week)
1. ✅ **Stream handling duplication** (DONE)
2. **File locking for race conditions** (2-4 hours)
3. **Photo count decrement logic** (30 min)
4. **Environment variable validation** (15 min)

### Short Term (This Month)
5. **Async file operations** (2-3 hours)
6. **Error handling standardization** (2-3 hours)
7. **Centralize slug generation** (30 min)

### Long Term (As Needed)
8. **Database migration** (6-8 hours) - only when scaling beyond 1000 photos
9. **Structured logging** (2 hours)
10. **Centralize constants** (1 hour)

---

## Benefits Summary

| Refactoring | Code Quality | Performance | Reliability | Maintainability |
|-------------|--------------|-------------|-------------|-----------------|
| ✅ Stream utils | ✅ | — | ✅ | ✅ |
| File locking | — | — | ✅✅✅ | ✅ |
| Async file I/O | — | ✅✅✅ | — | ✅ |
| DB migration | ✅ | ✅✅✅ | ✅✅ | ✅✅ |
| Error consistency | ✅✅ | — | ✅ | ✅✅ |
| Env validation | ✅ | — | ✅ | ✅ |

---

**Generated by**: Claude Code (Proactive Analysis Round 4)
**Next Steps**: Prioritize based on current pain points and scalability needs
