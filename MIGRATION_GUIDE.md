# Storage Migration Guide

This guide explains how to switch storage providers and migrate existing code.

## ✅ What's Already Done

The codebase now has a **modular storage system** that supports:
- **Cloudinary** (recommended, 25GB free)
- **Google Drive** (current, 15GB free)
- **Easy switching** via environment variable

## 🔄 How to Switch Providers

### Switch to Cloudinary (Recommended)

**1. Set up Cloudinary account:**
- Follow `CLOUDINARY_SETUP.md` for step-by-step instructions
- Takes ~5 minutes total

**2. Update `.env.local`:**
```bash
STORAGE_PROVIDER=cloudinary

CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

**3. Restart your server:**
```bash
npm run dev
```

**That's it!** New uploads will use Cloudinary automatically.

### Switch Back to Google Drive

**Update `.env.local`:**
```bash
STORAGE_PROVIDER=drive

# Make sure these are set:
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_DRIVE_FOLDER_ID=...
```

Restart server and you're back on Google Drive!

## 📦 Code Updates Required

The following files need to be updated to use the new storage abstraction:

### High Priority (Image Upload/Download)
- [ ] `lib/services/UploadService.js` - Photo uploads
- [ ] `lib/services/ChallengeService.js` - Pose challenge uploads
- [ ] `lib/services/PhotoService.js` - Photo deletion
- [ ] `lib/services/FaceService.js` - Face thumbnail uploads

### Medium Priority (Image Serving)
- [ ] `app/api/image/[id]/route.js` - Image proxy
- [ ] `app/api/face-crop/[driveId]/route.js` - Face crop proxy
- [ ] `app/api/download/[driveId]/route.js` - Download endpoint

### Low Priority (Batch Operations)
- [ ] `app/api/download-album/route.js` - Album ZIP download
- [ ] `app/api/photos/route.js` - Photo listing

### Test Files (Update After Main Code)
- [ ] `__tests__/lib/services/*.test.js`
- [ ] `__tests__/api/*.test.js`

## 🔧 Migration Pattern

### Before (Old Code)
```javascript
import { uploadToDrive, deleteFromDrive } from '@/lib/googleDrive';

// Upload
const result = await uploadToDrive(buffer, fileName, folderId);
const url = `/api/image/${result.id}`;

// Delete
await deleteFromDrive(fileId);
```

### After (New Code)
```javascript
import { getStorageAdapter } from '@/lib/storage';

// Upload
const storage = getStorageAdapter();
const { id, url } = await storage.upload(buffer, fileName, {
  folder: 'photos',
  mimeType: 'image/jpeg'
});

// Delete
await storage.delete(fileId);
```

## 📝 Step-by-Step Migration

### 1. Update UploadService.js

**Find:**
```javascript
import { uploadToDrive, findOrCreateFolder } from '../googleDrive';
```

**Replace with:**
```javascript
import { getStorageAdapter } from '@/lib/storage';
```

**Find:**
```javascript
const driveFile = await uploadToDrive(fileBuffer, fileName, folderId);
```

**Replace with:**
```javascript
const storage = getStorageAdapter();
const { id, url } = await storage.upload(fileBuffer, fileName, {
  folder: 'photos',
  mimeType: 'image/jpeg'
});
```

### 2. Update ChallengeService.js

**Find:**
```javascript
const driveFile = await uploadToDrive(imageBuffer, fileName, challengesFolderId);
```

**Replace with:**
```javascript
const storage = getStorageAdapter();
const { id, url } = await storage.upload(imageBuffer, fileName, {
  folder: 'challenges',
  mimeType: 'image/jpeg'
});
```

### 3. Update PhotoService.js

**Find:**
```javascript
await deleteFromDrive(photo.driveId);
```

**Replace with:**
```javascript
const storage = getStorageAdapter();
await storage.delete(photo.driveId);
```

### 4. Update FaceService.js

**Find:**
```javascript
const driveFile = await uploadToDrive(croppedBuffer, thumbnailFileName, facesFolderId);
```

**Replace with:**
```javascript
const storage = getStorageAdapter();
const { id, url } = await storage.upload(croppedBuffer, thumbnailFileName, {
  folder: 'faces',
  mimeType: 'image/jpeg'
});
```

## 🌐 Updating Image Serving Routes

### For Cloudinary

Cloudinary returns **direct URLs** - no proxy needed!

```javascript
// OLD: Proxy through API
const url = `/api/image/${driveId}`;

// NEW: Direct Cloudinary URL
const url = photo.url; // Already a full HTTPS URL!
```

### For Google Drive

Keep the proxy for Google Drive files:

```javascript
// Still needed for Drive files
const url = `/api/image/${driveId}`;
```

Our system handles both automatically!

## 🧪 Testing After Migration

### 1. Test Photo Upload
```bash
# Upload a photo through the app
# Check console logs for: [Storage] ✓ cloudinary adapter ready
```

### 2. Test Pose Challenge Creation
```bash
# Go to /admin → Pose Challenges
# Create new challenge with image
# Should see: Pose created successfully!
```

### 3. Test Photo Deletion
```bash
# Delete a photo from gallery
# Check Cloudinary console - file should be removed
```

### 4. Check Cloudinary Console
- Go to https://console.cloudinary.com/
- Navigate to **Media Library**
- You should see folders: `united-album/photos`, `united-album/challenges`, `united-album/faces`

## 🎯 Migration Checklist

- [ ] Cloudinary account created
- [ ] Credentials added to `.env.local`
- [ ] `STORAGE_PROVIDER=cloudinary` set
- [ ] Server restarted
- [ ] UploadService updated
- [ ] ChallengeService updated
- [ ] PhotoService updated
- [ ] FaceService updated
- [ ] Image serving routes updated
- [ ] Tests updated
- [ ] Photo upload works
- [ ] Pose challenge creation works
- [ ] Photo deletion works
- [ ] Face detection works
- [ ] Production env vars updated (Vercel)
- [ ] Production deployment tested

## 🔄 Handling Mixed Storage

**During migration, you'll have:**
- Old photos in Google Drive
- New photos in Cloudinary

**This is fine!** The system handles both:

```javascript
// Photo model stores the full URL
{
  id: 1,
  driveId: "google-drive-id-123",
  url: "/api/image/google-drive-id-123"  // Old photo
}

{
  id: 2,
  driveId: "cloudinary-public-id",
  url: "https://res.cloudinary.com/..."   // New photo
}
```

Both display correctly in the gallery!

## 📊 Verifying Provider in Use

Check server logs on startup:
```
[Storage] Initializing cloudinary adapter...
[Storage] ✓ cloudinary adapter ready
```

Or:
```
[Storage] Initializing google-drive adapter...
[Storage] ✓ google-drive adapter ready
```

## 🆘 Rollback Plan

If something goes wrong:

**1. Switch back immediately:**
```bash
STORAGE_PROVIDER=drive
```

**2. Restart server**

**3. All old photos still work!**

New uploads go back to Google Drive until you fix the issue.

## 💡 Pro Tips

1. **Test locally first** - Make sure Cloudinary works before production
2. **Keep Google Drive configured** - Fallback option if Cloudinary has issues
3. **Monitor Cloudinary usage** - Check dashboard periodically
4. **Optimize images** - Reduce quality/size to save bandwidth
5. **Use transformations** - Cloudinary can resize on-the-fly

## 🚀 Next Steps

After migration is complete:

1. **Update production** - Add Cloudinary env vars to Vercel
2. **Monitor performance** - Should be faster than Google Drive!
3. **Clean up** - Optionally migrate old photos from Drive
4. **Enjoy** - No more OAuth token headaches! 🎉

Need help? Check `CLOUDINARY_SETUP.md` or open a GitHub issue!
