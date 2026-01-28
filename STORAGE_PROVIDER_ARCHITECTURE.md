# Storage Provider Architecture

## 🎯 Plug & Play Provider System

This application uses a **provider-agnostic storage architecture** that allows seamless switching between storage providers (Cloudinary, Google Drive, S3, etc.) without touching your business logic code.

---

## ✅ What "Provider-Agnostic" Means

Your code should:
- ✅ **Import from** `lib/storage/operations.js` ONLY
- ✅ **Never import** `googleDrive.js` or `cloudinary` SDK directly
- ✅ **Use generic function names** (uploadPhoto, deletePhoto, getPhotoStream)
- ✅ **Store URLs** in database (not IDs) for compatibility
- ✅ **Work with ANY provider** without code changes

---

## 🏗️ Architecture Layers

### Layer 1: Provider Adapters (Implementation)
**Location:** `lib/storage/`

Each provider implements the `StorageAdapter` interface:

```javascript
// lib/storage/StorageAdapter.js
class StorageAdapter {
  async upload(fileBuffer, fileName, options) {}
  async delete(fileId) {}
  async getStream(fileId) {}
  getUrl(fileId, options) {}
  async createFolder(folderName, parentId) {}
  async listFiles(folderId) {}
  getName() {}
}
```

**Implementations:**
- `CloudinaryAdapter.js` - Cloudinary CDN (recommended)
- `GoogleDriveAdapter.js` - Google Drive storage
- `StorageAdapter.js` - Base interface

### Layer 2: Factory Pattern (Provider Selection)
**Location:** `lib/storage/index.js`

Automatically selects the right provider based on environment variable:

```javascript
export function getStorageAdapter() {
  const provider = process.env.STORAGE_PROVIDER || 'cloudinary';

  switch (provider) {
    case 'cloudinary':
      return new CloudinaryAdapter();
    case 'drive':
      return new GoogleDriveAdapter();
    default:
      throw new Error(`Unknown storage provider: ${provider}`);
  }
}
```

### Layer 3: High-Level Operations (Your Code Uses This)
**Location:** `lib/storage/operations.js`

Provider-agnostic functions for all storage needs:

```javascript
// ✅ CORRECT - Use these functions
import {
  uploadPhoto,
  deletePhoto,
  getPhotoStream,
  getPhotoUrl,
  listFiles,
  isCloudinary,
  isGoogleDrive
} from '@/lib/storage/operations';

// Upload a photo (works with ANY provider)
const result = await uploadPhoto(buffer, 'photo.jpg');
console.log(result.url); // URL works with current provider

// Delete a photo (works with ANY provider)
await deletePhoto(fileId);

// Get file stream (works with ANY provider)
const { stream } = await getPhotoStream(fileId);

// Check current provider
if (isGoogleDrive()) {
  // Google Drive specific logic (sync, deduplication)
}
```

---

## 🚫 Common Violations (What NOT to Do)

### ❌ WRONG: Direct Provider Imports

```javascript
// ❌ DON'T DO THIS
import { uploadToDrive } from '@/lib/storage/googleDrive';
import { v2 as cloudinary } from 'cloudinary';

// This breaks when you switch providers!
const result = await uploadToDrive(buffer, 'photo.jpg');
```

### ✅ CORRECT: Use Operations Layer

```javascript
// ✅ DO THIS INSTEAD
import { uploadPhoto } from '@/lib/storage/operations';

// Works with ANY provider
const result = await uploadPhoto(buffer, 'photo.jpg');
```

---

## 📋 Provider Switching Checklist

To switch providers, you ONLY need to:

1. **Change ONE environment variable:**
   ```bash
   # .env or .env.local
   STORAGE_PROVIDER=cloudinary  # or 'drive'
   ```

2. **Restart the server:**
   ```bash
   npm run dev
   ```

3. **Done!** All file operations automatically use the new provider.

**No code changes required** if you followed the architecture correctly.

---

## 🔍 How to Verify Proper Separation

### Check for Violations

Run this command to find any direct provider imports:

```bash
# Should return NO results in app/ directory
grep -r "from.*googleDrive\|import.*googleDrive" app/

# Should return NO results in lib/services/ directory
grep -r "from.*cloudinary\|import.*cloudinary" lib/services/
```

### Valid Imports

These are the ONLY files that should import provider-specific code:

```
lib/storage/GoogleDriveAdapter.js   ✅ (imports googleDrive.js)
lib/storage/CloudinaryAdapter.js    ✅ (imports cloudinary SDK)
lib/storage/index.js                ✅ (imports adapters)
```

**All other files** should import from `lib/storage/operations.js` ONLY.

---

## 📦 Available Operations

### Upload Operations
```javascript
uploadPhoto(buffer, fileName, options)       // Upload photo
uploadChallengeImage(buffer, fileName, id)   // Upload challenge image
uploadFaceThumbnail(buffer, fileName)        // Upload face crop
uploadPhotos(photosArray, options)           // Batch upload
```

### Delete Operations
```javascript
deletePhoto(fileId)                          // Delete single photo
deletePhotos(fileIdsArray)                   // Batch delete
```

### URL Operations
```javascript
getPhotoUrl(fileId, { size: 'thumbnail' })   // Get optimized URL
getPhotoPlaceholder(fileId)                  // Get blur preview
getFaceUrl(fileId, useFaceDetection)         // Get face thumbnail
getDownloadUrl(fileId)                       // Get download URL
```

### Stream Operations
```javascript
getPhotoStream(fileId)                       // Get file stream
```

### Folder Operations
```javascript
createFolder(folderName, parentId)           // Create folder
listFiles(folderId)                          // List files in folder
```

### Utility Functions
```javascript
getProviderName()                            // Returns: 'cloudinary' or 'google-drive'
isCloudinary()                               // Check if using Cloudinary
isGoogleDrive()                              // Check if using Google Drive
detectProvider(url)                          // Detect provider from URL
extractFileId(url)                           // Extract file ID from URL
```

---

## 🎨 Provider-Specific Logic Pattern

When you need provider-specific logic (rare), use feature detection:

```javascript
import { isGoogleDrive, isCloudinary, listFiles } from '@/lib/storage/operations';

// ✅ CORRECT: Feature detection
if (isGoogleDrive()) {
  // Google Drive needs file sync
  const validFiles = await listFiles();
  // Filter orphaned files
}

if (isCloudinary()) {
  // Cloudinary has direct URLs, no sync needed
  // Skip validation logic
}

// Continue with provider-agnostic code
```

**When to use provider-specific logic:**
- ✅ Google Drive file sync (Google Drive loses files if app revokes access)
- ✅ Performance optimizations specific to provider
- ✅ Feature availability checks

**When NOT to use:**
- ❌ File uploads (use `uploadPhoto`)
- ❌ File deletes (use `deletePhoto`)
- ❌ Getting streams (use `getPhotoStream`)
- ❌ Any core operation (use operations.js)

---

## 📊 Real-World Example: Photo API

### ❌ BEFORE (Tightly Coupled)

```javascript
// app/api/photos/route.js - WRONG!
import { listDriveFiles } from '@/lib/storage/googleDrive'; // ❌ Direct import

export async function GET(request) {
  const photos = await photoRepo.findAll();
  const validDriveIds = await listDriveFiles(); // ❌ Google Drive only!

  return NextResponse.json({
    photos: photos.filter(p => validDriveIds.has(p.driveId))
  });
}
```

**Problem:** This breaks when STORAGE_PROVIDER=cloudinary!

### ✅ AFTER (Provider-Agnostic)

```javascript
// app/api/photos/route.js - CORRECT!
import { listFiles, isGoogleDrive } from '@/lib/storage/operations'; // ✅

export async function GET(request) {
  const photos = await photoRepo.findAll();

  // Only sync if using Google Drive
  if (isGoogleDrive()) {
    const validFileIds = await listFiles(); // ✅ Provider-agnostic
    return NextResponse.json({
      photos: photos.filter(p => validFileIds.has(p.driveId))
    });
  }

  // Cloudinary: Just return all photos (no sync needed)
  return NextResponse.json({ photos });
}
```

**Benefits:**
- ✅ Works with Cloudinary (current provider)
- ✅ Works with Google Drive (if you switch back)
- ✅ Easy to add new providers later

---

## 🧪 Testing Provider Separation

### Unit Tests Should Mock Operations Layer

```javascript
// ✅ CORRECT: Mock operations.js
jest.mock('@/lib/storage/operations', () => ({
  uploadPhoto: jest.fn(),
  deletePhoto: jest.fn(),
  getPhotoStream: jest.fn(),
}));

// ❌ WRONG: Mock provider directly
jest.mock('@/lib/storage/googleDrive');
```

### Integration Tests Should Work With Any Provider

```javascript
// Test should pass regardless of STORAGE_PROVIDER value
describe('Photo Upload', () => {
  it('should upload photo with current provider', async () => {
    const result = await uploadPhoto(buffer, 'test.jpg');
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('url');
  });
});
```

---

## 🔧 Adding a New Provider

To add a new provider (e.g., AWS S3):

### Step 1: Create Adapter

```javascript
// lib/storage/S3Adapter.js
import { StorageAdapter } from './StorageAdapter';
import AWS from 'aws-sdk';

export class S3Adapter extends StorageAdapter {
  constructor() {
    super();
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
    this.bucket = process.env.AWS_S3_BUCKET;
  }

  async upload(fileBuffer, fileName, options = {}) {
    const result = await this.s3.upload({
      Bucket: this.bucket,
      Key: fileName,
      Body: fileBuffer,
    }).promise();

    return {
      id: result.Key,
      url: result.Location,
    };
  }

  async delete(fileId) {
    await this.s3.deleteObject({
      Bucket: this.bucket,
      Key: fileId,
    }).promise();
  }

  async getStream(fileId) {
    const stream = this.s3.getObject({
      Bucket: this.bucket,
      Key: fileId,
    }).createReadStream();

    return {
      stream,
      contentType: 'image/jpeg',
    };
  }

  getUrl(fileId, options = {}) {
    return `https://${this.bucket}.s3.amazonaws.com/${fileId}`;
  }

  getName() {
    return 's3';
  }
}
```

### Step 2: Register in Factory

```javascript
// lib/storage/index.js
import { S3Adapter } from './S3Adapter';

export function getStorageAdapter() {
  const provider = process.env.STORAGE_PROVIDER || 'cloudinary';

  switch (provider) {
    case 'cloudinary':
      return new CloudinaryAdapter();
    case 'drive':
      return new GoogleDriveAdapter();
    case 's3':
      return new S3Adapter(); // ✅ Add new provider
    default:
      throw new Error(`Unknown storage provider: ${provider}`);
  }
}
```

### Step 3: Set Environment Variable

```bash
# .env.local
STORAGE_PROVIDER=s3
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_BUCKET=your_bucket
```

### Step 4: Done!

**All existing code works with S3 automatically** - no changes needed in:
- API routes
- Services
- Components
- Repositories

---

## 🎯 Key Takeaways

1. **ONE place to change provider:** Just `.env` file
2. **NO code changes** when switching providers
3. **Import from operations.js** ONLY (never direct providers)
4. **Store URLs** in database (not IDs)
5. **Use feature detection** (`isGoogleDrive()`) for provider-specific logic
6. **Test with mocked operations** (not mocked providers)

---

## 📚 Related Documentation

- `CLOUDINARY_SETUP.md` - 5-minute Cloudinary setup
- `GOOGLE_DRIVE_SETUP.md` - Google Drive OAuth setup
- `MIGRATION_GUIDE.md` - Migrating from Drive to Cloudinary
- `lib/storage/README.md` - Technical API reference

---

**Last Updated:** 2026-01-28
**Architecture Version:** 2.0 (Provider-Agnostic)
