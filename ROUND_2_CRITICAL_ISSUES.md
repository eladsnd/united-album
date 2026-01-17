# Round 2: Critical Issues Analysis

**Generated**: 2026-01-17 (Round 2)
**Severity Levels**: 🔴 Critical | 🟠 High | 🟡 Medium

---

## 🔴 CRITICAL ISSUES

### 1. File System Race Conditions (Data Corruption Risk)
**Files**: `lib/photoStorage.js`, `lib/faceStorage.js`, `app/api/admin/poses/route.js`
**Severity**: 🔴 Critical (Data Loss/Corruption)

**Problem**: Non-atomic read-modify-write operations
```javascript
// lib/photoStorage.js:32-56
export function savePhoto(photo) {
    const photos = loadPhotos();           // ❌ READ

    // ... modification logic ...

    fs.writeFileSync(PHOTOS_FILE, JSON.stringify(photos, null, 2)); // ❌ WRITE
    return photo;
}
```

**Race Condition Scenario**:
```
Time | Request A                  | Request B
-----|----------------------------|---------------------------
T1   | loadPhotos() → [photo1]    |
T2   |                            | loadPhotos() → [photo1]
T3   | photos.push(photoA)        |
T4   |                            | photos.push(photoB)
T5   | writeFile([photo1, photoA])|
T6   |                            | writeFile([photo1, photoB]) ← OVERWRITES A!
```

**Result**: photoA is lost completely

**Impact**:
- 2+ simultaneous uploads → photos lost
- Concurrent delete + update → data corruption
- Face descriptor updates → lost face IDs
- Admin pose edits → overwrites

**Affected Operations**:
- `savePhoto()` - lib/photoStorage.js:32
- `updatePhoto()` - lib/photoStorage.js:64
- `deletePhoto()` - lib/photoStorage.js:92
- `saveFaceDescriptor()` - lib/faceStorage.js:55
- `deleteFace()` - lib/faceStorage.js:136
- `writeChallenges()` - app/api/admin/poses/route.js:61

**Fix Option A - File Locking (RECOMMENDED)**:
```bash
npm install proper-lockfile
```

```javascript
import lockfile from 'proper-lockfile';

export async function savePhoto(photo) {
    const release = await lockfile.lock(PHOTOS_FILE, {
        retries: {
            retries: 5,
            factor: 2,
            minTimeout: 100,
            maxTimeout: 1000
        }
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

**Fix Option B - Atomic Write with Rename**:
```javascript
export function savePhoto(photo) {
    const lockId = Date.now() + '-' + Math.random();
    const tempFile = `${PHOTOS_FILE}.${lockId}.tmp`;

    try {
        // Read current data
        const photos = loadPhotos();

        // Modify
        const existingIndex = photos.findIndex(p => p.driveId === photo.driveId);
        if (existingIndex !== -1) {
            photos[existingIndex] = photo;
        } else {
            photos.push(photo);
        }

        // Write to temp file
        fs.writeFileSync(tempFile, JSON.stringify(photos, null, 2));

        // Atomic rename (on most systems)
        fs.renameSync(tempFile, PHOTOS_FILE);

        return photo;
    } catch (error) {
        // Cleanup temp file on error
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }
        throw error;
    }
}
```

---

### 2. JSON Parse Errors Not Handled (App Crashes)
**Files**: `lib/photoStorage.js:23`, `lib/faceStorage.js:23`, `app/api/admin/poses/route.js:49`
**Severity**: 🔴 Critical (Application Crash)

**Problem**: Corrupted JSON crashes the entire app
```javascript
// lib/photoStorage.js:22-28
try {
    const data = fs.readFileSync(PHOTOS_FILE, 'utf-8');
    return JSON.parse(data); // ❌ Can throw on corrupted JSON
} catch (error) {
    console.error('[Photo Storage] Error loading photos:', error);
    return []; // ✅ Returns empty, but error is too generic
}
```

**Issues**:
1. Catches ALL errors (not just JSON parse)
2. File permission errors return `[]` (hides real problem)
3. Disk full errors return `[]` (hides real problem)
4. No backup/recovery mechanism
5. Corrupted JSON = permanent data loss

**Corruption Scenarios**:
- Process killed mid-write → partial JSON `[{"id": 1, "name":`
- Disk full → truncated file
- Power outage → corrupt bytes
- Manual editing → syntax errors

**Fix**:
```javascript
function loadPhotos() {
    ensureDataDir();

    if (!fs.existsSync(PHOTOS_FILE)) {
        return [];
    }

    try {
        const data = fs.readFileSync(PHOTOS_FILE, 'utf-8');

        // Validate JSON before parsing
        if (!data || data.trim().length === 0) {
            console.warn('[Photo Storage] Empty file, returning []');
            return [];
        }

        const photos = JSON.parse(data);

        // Validate structure
        if (!Array.isArray(photos)) {
            console.error('[Photo Storage] Invalid data structure, expected array');
            return restoreFromBackup() || [];
        }

        return photos;
    } catch (error) {
        if (error instanceof SyntaxError) {
            console.error('[Photo Storage] Corrupted JSON file:', error.message);
            console.error('[Photo Storage] Attempting backup restoration...');
            return restoreFromBackup() || [];
        } else {
            // File system error, permission error, etc.
            console.error('[Photo Storage] File system error:', error);
            throw error; // Re-throw to expose real problem
        }
    }
}

// Automatic backup on every write
function saveWithBackup(filePath, data) {
    const backupPath = `${filePath}.backup`;

    // Create backup of current file before overwriting
    if (fs.existsSync(filePath)) {
        fs.copyFileSync(filePath, backupPath);
    }

    try {
        // Atomic write with temp file
        const tempPath = `${filePath}.tmp`;
        fs.writeFileSync(tempPath, data);
        fs.renameSync(tempPath, filePath);
    } catch (error) {
        // Restore from backup on failure
        if (fs.existsSync(backupPath)) {
            fs.copyFileSync(backupPath, filePath);
        }
        throw error;
    }
}

function restoreFromBackup() {
    const backupPath = `${PHOTOS_FILE}.backup`;

    if (fs.existsSync(backupPath)) {
        try {
            const data = fs.readFileSync(backupPath, 'utf-8');
            const photos = JSON.parse(data);

            // Copy backup to main file
            fs.copyFileSync(backupPath, PHOTOS_FILE);

            console.log(`[Photo Storage] Restored from backup (${photos.length} photos)`);
            return photos;
        } catch (backupError) {
            console.error('[Photo Storage] Backup also corrupted:', backupError);
            return null;
        }
    }

    return null;
}
```

---

### 3. No Validation of Photo ID Type Conversion
**File**: `app/api/update-faces/route.js:19`
**Severity**: 🟠 High (Data Corruption)

**Problem**: parseInt can return NaN
```javascript
const photoId = parseInt(formData.get('photoId')); // ❌ No validation

// Later used in findIndex
const photoIndex = photos.findIndex(p => p.id === photoId);
// If photoId is NaN, p.id === NaN is ALWAYS false (NaN !== NaN)
```

**Edge Cases**:
- `photoId` is null → `parseInt(null)` → `NaN`
- `photoId` is "" → `parseInt("")` → `NaN`
- `photoId` is "abc" → `parseInt("abc")` → `NaN`
- `photoId` is undefined → `parseInt(undefined)` → `NaN`

**Result**: Update silently fails, photo never updated

**Fix**:
```javascript
const photoIdStr = formData.get('photoId');
if (!photoIdStr) {
    throw new AppError('Photo ID is required', 400, 'PHOTO_ID_MISSING');
}

const photoId = parseInt(photoIdStr, 10);
if (isNaN(photoId) || photoId <= 0) {
    throw new AppError(`Invalid photo ID: ${photoIdStr}`, 400, 'INVALID_PHOTO_ID');
}
```

---

## 🟠 HIGH PRIORITY ISSUES

### 4. Synchronous File Operations Block Event Loop
**Files**: All `*Storage.js` files
**Severity**: 🟠 High (Performance Degradation)

**Problem**: `fs.readFileSync`, `fs.writeFileSync` block entire server
```javascript
// Every request blocks ALL other requests
fs.readFileSync(PHOTOS_FILE, 'utf-8'); // ❌ Blocks for 10-100ms
```

**Impact**:
- Large JSON files (1000+ photos) = 50-200ms block
- During write, NO requests processed
- Concurrent users = terrible UX
- Server feels "laggy"

**Example**:
```
Time | User A Upload | User B Upload | User C View Gallery
-----|---------------|---------------|--------------------
T1   | readFile 50ms | BLOCKED       | BLOCKED
T2   | processing    | BLOCKED       | BLOCKED
T3   | writeFile 100ms| BLOCKED      | BLOCKED
T4   | done          | starts        | BLOCKED
T5   |               | readFile 50ms | BLOCKED
```

**Fix**: Use async file operations
```javascript
import fs from 'fs/promises';

async function loadPhotos() {
    ensureDataDir();

    try {
        if (!await fs.access(PHOTOS_FILE).then(() => true).catch(() => false)) {
            return [];
        }

        const data = await fs.readFile(PHOTOS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('[Photo Storage] Error loading photos:', error);
        return [];
    }
}

export async function savePhoto(photo) {
    const photos = await loadPhotos();

    const existingIndex = photos.findIndex(p => p.driveId === photo.driveId);
    if (existingIndex !== -1) {
        photos[existingIndex] = photo;
    } else {
        photos.push(photo);
    }

    await fs.writeFile(PHOTOS_FILE, JSON.stringify(photos, null, 2));
    return photo;
}
```

---

### 5. Missing Input Sanitization for File Paths
**File**: `app/api/admin/poses/route.js:106-108`
**Severity**: 🟠 High (Security - Path Traversal)

**Problem**: `poseId` used directly in file path without sanitization
```javascript
const filename = `${poseId}.${ext}`;
const filepath = path.join(CHALLENGES_IMAGE_DIR, filename);
```

**Attack Scenario**:
```javascript
// Malicious admin submits:
title = "../../etc/passwd"
// slugify("../../etc/passwd") = "etcpasswd" (sanitized by accident!)

// BUT if slugify is bypassed or has a bug:
poseId = "../../../etc/passwd"
filepath = "/app/public/challenges/../../../etc/passwd"
// Writes to /etc/passwd !!!
```

**Even with slugify**, future bugs could expose this

**Fix**:
```javascript
// Ensure poseId doesn't escape directory
const filename = `${poseId}.${ext}`;
const filepath = path.join(CHALLENGES_IMAGE_DIR, filename);

// Validate the resolved path stays within challenges dir
const resolvedPath = path.resolve(filepath);
const basePath = path.resolve(CHALLENGES_IMAGE_DIR);

if (!resolvedPath.startsWith(basePath)) {
    throw new Error(`Invalid pose ID: path traversal detected (${poseId})`);
}
```

---

### 6. No Validation That Face Boxes Match Face IDs
**File**: `app/api/update-faces/route.js:26-32`
**Severity**: 🟠 High (Data Corruption)

**Problem**: Face IDs and boxes can have different lengths
```javascript
const faceIdArray = faceIdsStr.split(','); // ["person_1", "person_2"]
const faceBoxes = JSON.parse(faceBoxesStr); // [{x:10, y:20, w:30, h:40}]

// Arrays have different lengths!
// faceIdArray.length = 2
// faceBoxes.length = 1
```

**Result**: Mismatched data in database
```json
{
  "faceIds": ["person_1", "person_2"],
  "faceBoxes": [{"x": 10, "y": 20}]
}
```

**Fix**:
```javascript
if (faceIdArray.length !== faceBoxes.length) {
    throw new AppError(
        `Face IDs count (${faceIdArray.length}) doesn't match face boxes count (${faceBoxes.length})`,
        400,
        'FACE_DATA_MISMATCH'
    );
}
```

---

## 🟡 MEDIUM PRIORITY ISSUES

### 7. photoCount Not Decremented on Photo Delete
**File**: `lib/faceStorage.js:55-110`
**Severity**: 🟡 Medium (Data Inconsistency)

**Problem**: When photo deleted, face photoCount never decremented
```javascript
// saveFaceDescriptor increments photoCount
photoCount: existingFace.photoCount + 1, // line 85

// But deleteFace doesn't decrement it
export function deleteFace(faceId) {
    const faces = loadFaces();
    const filtered = faces.filter(f => f.faceId !== faceId);
    // ❌ No decrement of photoCount
}
```

**Result**: `photoCount` becomes inaccurate over time
- Upload 5 photos of person_1 → photoCount = 5
- Delete 3 photos → photoCount still = 5 (wrong!)
- Gallery shows "5 photos" but only 2 exist

**Fix**: Track photo deletions and update counts
```javascript
// In PhotoService.deletePhoto()
if (orphanedFaces.length > 0) {
    for (const faceId of orphanedFaces) {
        await faceService.decrementPhotoCount(faceId);
    }
}

// In FaceService
async decrementPhotoCount(faceId) {
    const face = await this.faceRepository.findById(faceId);
    if (face) {
        face.photoCount = Math.max(0, face.photoCount - 1);
        await this.faceRepository.update(faceId, { photoCount: face.photoCount });
    }
}
```

---

### 8. No Maximum File Size for JSON Files
**Files**: All `*Storage.js` files
**Severity**: 🟡 Medium (DoS Risk)

**Problem**: JSON files can grow unbounded
- 10,000 photos × 2KB each = 20MB JSON file
- 1,000 faces × 128 descriptors × 8 bytes = 1MB
- Loading 20MB+ into memory on every request

**Impact**:
- Slow server startup
- High memory usage
- Slow reads/writes
- Risk of hitting Node.js memory limits

**Fix**: Implement pagination or database migration
```javascript
// Option A: Warn at size threshold
if (photos.length > 1000) {
    console.warn(`[Photo Storage] Large dataset (${photos.length} photos). Consider migrating to database.`);
}

// Option B: Automatic archival
if (photos.length > 5000) {
    const oldPhotos = photos.filter(p =>
        new Date(p.timestamp) < new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    );
    await archivePhotos(oldPhotos);
}
```

---

## Summary

| Issue | Severity | Impact | Complexity to Fix |
|-------|----------|--------|-------------------|
| File System Race Conditions | 🔴 Critical | Data Loss | Medium |
| JSON Parse Errors | 🔴 Critical | App Crash | Low |
| Photo ID Validation | 🟠 High | Silent Failure | Low |
| Sync File Operations | 🟠 High | Performance | Medium |
| Path Traversal | 🟠 High | Security | Low |
| Face Data Mismatch | 🟠 High | Corruption | Low |
| Photo Count Inaccurate | 🟡 Medium | UX Issue | Low |
| JSON File Size | 🟡 Medium | Performance | High |

## Recommended Fix Priority

**Immediate** (Today):
1. Add photo ID validation (5 min)
2. Add face data mismatch validation (5 min)
3. Add path traversal protection (10 min)
4. Add JSON parse error handling with backup (30 min)

**This Week**:
5. Implement file locking for race conditions (2 hours)
6. Convert to async file operations (2 hours)

**Next Sprint**:
7. Implement photo count tracking (1 hour)
8. Add JSON file size monitoring (30 min)
