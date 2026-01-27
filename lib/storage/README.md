# Storage Abstraction Layer

Modular, swappable storage system for United Album. Switch between Cloudinary, Google Drive, or any future provider with **zero code changes**.

## Quick Start

### 1. Choose Your Provider

Add to `.env.local`:
```bash
# Option 1: Cloudinary (Recommended - 25GB free, no OAuth!)
STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Option 2: Google Drive (15GB free, OAuth expires)
STORAGE_PROVIDER=drive
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_DRIVE_FOLDER_ID=...
```

### 2. Use in Your Code

```javascript
import { getStorageAdapter } from '@/lib/storage';

// Get the configured adapter
const storage = getStorageAdapter();

// Upload a file
const { id, url } = await storage.upload(fileBuffer, 'photo.jpg', {
  folder: 'photos',
  mimeType: 'image/jpeg'
});

// Delete a file
await storage.delete(fileId);

// Get file stream (for downloads)
const { stream, contentType } = await storage.getStream(fileId);

// Get public URL
const url = storage.getUrl(fileId, {
  width: 800,
  height: 600,
  quality: 'auto'
});
```

## Architecture

```
lib/storage/
├── StorageAdapter.js         # Base interface (contract)
├── CloudinaryAdapter.js      # Cloudinary implementation
├── GoogleDriveAdapter.js     # Google Drive implementation
├── index.js                  # Factory (switches providers)
└── README.md                 # This file
```

### Design Pattern: Strategy Pattern

Each storage provider implements the same interface (`StorageAdapter`), allowing seamless switching without code changes.

```javascript
class StorageAdapter {
  async upload(buffer, fileName, options)
  async delete(fileId)
  async getStream(fileId)
  getUrl(fileId, options)
  async createFolder(folderName, parentId)
  async listFiles(folderId)
  getName()
}
```

## Provider Comparison

| Feature | Cloudinary | Google Drive |
|---------|-----------|--------------|
| Free Storage | **25 GB** | 15 GB |
| Free Bandwidth | 25 GB/month | Unlimited |
| Authentication | API Key ✅ | OAuth (expires) ❌ |
| CDN | Built-in ✅ | No ❌ |
| Image Optimization | Yes ✅ | No ❌ |
| Setup Time | 5 min | 30 min |
| Reliability | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

**Recommendation:** Use Cloudinary for better experience and more storage!

## Adding a New Provider

Want to add AWS S3, Azure Blob, or another provider?

### 1. Create Adapter

```javascript
// lib/storage/S3Adapter.js
import { StorageAdapter } from './StorageAdapter';

export class S3Adapter extends StorageAdapter {
  async upload(fileBuffer, fileName, options) {
    // Your S3 upload logic
  }

  async delete(fileId) {
    // Your S3 delete logic
  }

  // ... implement all required methods
}
```

### 2. Register in Factory

```javascript
// lib/storage/index.js
import { S3Adapter } from './S3Adapter';

export function getStorageAdapter() {
  switch (provider) {
    case 's3':
      return new S3Adapter();
    // ... other cases
  }
}
```

### 3. Update Environment

```bash
# .env.local
STORAGE_PROVIDER=s3
S3_BUCKET_NAME=my-bucket
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

**That's it!** All existing code works with your new provider.

## Fallback Strategy

If primary provider fails, system automatically falls back:

```
Cloudinary fails → Try Google Drive
Google Drive fails → Throw error
```

Configure in `lib/storage/index.js`:

```javascript
catch (error) {
  if (provider === 'cloudinary') {
    console.warn('Falling back to Google Drive...');
    return new GoogleDriveAdapter();
  }
  throw error;
}
```

## Testing

### Unit Tests

```javascript
import { getStorageAdapter, resetStorageAdapter } from '@/lib/storage';

describe('Storage Adapter', () => {
  beforeEach(() => {
    resetStorageAdapter(); // Clear cache
    process.env.STORAGE_PROVIDER = 'cloudinary';
  });

  test('uploads file', async () => {
    const storage = getStorageAdapter();
    const result = await storage.upload(buffer, 'test.jpg');
    expect(result.id).toBeDefined();
    expect(result.url).toBeDefined();
  });
});
```

### Integration Tests

```javascript
// Test with real Cloudinary account
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';

const storage = getStorageAdapter();
const result = await storage.upload(testBuffer, 'integration-test.jpg');
await storage.delete(result.id); // Cleanup
```

## Performance

### Cloudinary
- Upload: ~200-500ms
- Download: ~50-100ms (CDN cached)
- Delete: ~100-200ms

### Google Drive
- Upload: ~500-1000ms
- Download: ~200-400ms (no CDN)
- Delete: ~200-300ms

**Cloudinary is 2-3x faster!**

## Best Practices

### ✅ DO

- Use `getStorageAdapter()` factory (don't instantiate adapters directly)
- Handle errors gracefully (network failures, quota exceeded, etc.)
- Cache URLs when possible (avoid repeated API calls)
- Use appropriate folder names for organization
- Monitor usage via provider dashboards

### ❌ DON'T

- Hardcode provider-specific logic in business code
- Store credentials in code (use environment variables)
- Assume file URLs are permanent (could change between providers)
- Skip error handling (network requests can fail)
- Mix direct provider SDK calls with adapter (breaks abstraction)

## Debugging

### Enable Debug Logs

```javascript
// lib/storage/index.js
console.log(`[Storage] Initializing ${provider} adapter...`);
console.log(`[Storage] ✓ ${adapter.getName()} adapter ready`);
```

### Check Provider in Use

```javascript
const storage = getStorageAdapter();
console.log(`Using: ${storage.getName()}`); // "cloudinary" or "google-drive"
```

### Verify Environment

```javascript
console.log('STORAGE_PROVIDER:', process.env.STORAGE_PROVIDER);
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME);
console.log('GOOGLE_DRIVE_FOLDER_ID:', process.env.GOOGLE_DRIVE_FOLDER_ID);
```

## Migration

See `MIGRATION_GUIDE.md` for step-by-step instructions on:
- Switching from Google Drive to Cloudinary
- Updating existing code to use storage abstraction
- Handling mixed storage (old photos in Drive, new in Cloudinary)
- Production deployment

## Related Documentation

- `CLOUDINARY_SETUP.md` - Cloudinary setup guide
- `GOOGLE_DRIVE_SETUP.md` - Google Drive OAuth setup
- `MIGRATION_GUIDE.md` - Step-by-step migration instructions
- `../CLAUDE.md` - Project overview and development guide

## Support

Questions or issues? Open a GitHub issue with:
- Storage provider being used
- Error messages (if any)
- Environment variables set (redact credentials!)
- Steps to reproduce

---

**Happy coding! 🚀** Switch providers anytime with zero downtime!
