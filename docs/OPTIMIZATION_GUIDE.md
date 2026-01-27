# Optimization & Bandwidth Management Guide

This guide explains how we leverage Cloudinary's free features while staying within limits using smart rate limiting and batching.

## 🎯 The Challenge

**Cloudinary Free Tier Limits:**
- ✅ 25 GB storage (plenty for 1000+ photos)
- ⚠️ 25 GB bandwidth/month (can be tight if everyone downloads everything)
- ⚠️ 25,000 transformations/month (caching helps, but monitoring needed)

**Our Solution:**
1. **Auto-optimization** - Reduce file sizes by 40-60% (free!)
2. **Rate limiting** - Prevent bandwidth abuse
3. **Smart batching** - Download large albums in chunks
4. **Lazy loading** - Load thumbnails first, full images on demand
5. **Keep face-api.js** - Fallback option, works with any provider

## 🚀 Features We Implemented

### 1. Auto-Quality Optimization (FREE - Saves 40-60% bandwidth!)

**What it does:**
- Automatically compresses images with NO visible quality loss
- Serves WebP/AVIF on modern browsers (50% smaller than JPEG)
- 5 MB photo → 1-2 MB with same visual quality

**Config:** `lib/config/storage.js`
```javascript
cloudinary: {
  useAutoQuality: true,  // Enable auto-quality
  useAutoFormat: true,   // Enable WebP/AVIF
}
```

**Environment variables:**
```bash
CLOUDINARY_AUTO_QUALITY=true
CLOUDINARY_AUTO_FORMAT=true
```

**How to use:**
```javascript
import { getOptimizedUrl } from '@/lib/config/storage';
import { getStorageAdapter } from '@/lib/storage';

const storage = getStorageAdapter();

// Automatic optimization
const url = getOptimizedUrl(storage, fileId, 'gallery');
// Returns: https://res.cloudinary.com/.../q_auto,f_auto,w_800,h_600/...

// Manual control
const url = storage.getUrl(fileId, {
  width: 800,
  quality: 'auto',
  fetch_format: 'auto'
});
```

**Impact:**
- 1000 photos × 5 MB = 5 GB → **2 GB** (60% savings!)
- 100 views × 2 GB = 200 GB → **80 GB** (60% savings!)
- Still exceeds 25 GB, but much better!

### 2. Download Rate Limiting (Prevents Abuse)

**What it does:**
- Limits concurrent downloads per user (default: 3)
- Limits downloads per minute per user (default: 20)
- Prevents bots from mass-downloading entire album

**Config:** `lib/middleware/downloadRateLimit.js`
```javascript
downloads: {
  enableRateLimit: true,
  maxConcurrent: 3,      // Max 3 simultaneous downloads
  maxPerMinute: 20,      // Max 20 photos/minute
}
```

**How to use:**
```javascript
import { withDownloadRateLimit } from '@/lib/middleware/downloadRateLimit';

export async function GET(request) {
  return withDownloadRateLimit(request, async () => {
    // Your download logic here
    const photoStream = await getPhotoStream(photoId);
    return new Response(photoStream);
  });
}
```

**Response when rate limited:**
```json
{
  "error": "Rate limit exceeded. Max: 20 downloads/minute",
  "retryAfter": 45
}
```

**Impact:**
- Prevents one user from downloading 1000 photos in 1 minute
- 20 photos/minute = 50 minutes for full album (reasonable)
- Spreads bandwidth usage over time

### 3. Smart Batching (Large Album Downloads)

**What it does:**
- Splits large albums into batches (default: 50 photos/batch)
- User downloads batches sequentially
- Prevents server overload and bandwidth spikes

**Config:**
```javascript
downloads: {
  enableBatching: true,
  batchSize: 50,           // Photos per batch
  maxAlbumSize: 500,       // Max photos in single download
}
```

**How it works:**
```javascript
import { calculateBatchSize, validateAlbumSize } from '@/lib/middleware/downloadRateLimit';

// Check if album is too large
const validation = validateAlbumSize(photoCount);
if (!validation.valid) {
  return Response.json({ error: validation.error }, { status: 400 });
}

// Calculate batches
const { batches, batchSize, recommendBatching } = calculateBatchSize(photoCount);

if (recommendBatching) {
  return Response.json({
    message: 'Album too large for single download',
    batches,
    batchSize,
    instruction: 'Download in batches using batch parameter'
  });
}
```

**User experience:**
```
Album: 500 photos

Batch 1: Photos 1-50   (GET /api/download-album?batch=1)
Batch 2: Photos 51-100 (GET /api/download-album?batch=2)
...
Batch 10: Photos 451-500
```

**Impact:**
- Prevents 500-photo (2.5 GB) download spike
- Spreads bandwidth over time
- Better server performance

### 4. Lazy Loading Placeholders (Ultra-Fast Load)

**What it does:**
- Shows tiny blurred preview instantly (10KB)
- Loads full image when visible on screen
- Perceived load time: instant!

**Config:**
```javascript
bandwidth: {
  usePlaceholders: true,
  placeholderQuality: 10,  // Very low quality
  placeholderWidth: 50,    // Tiny width
}
```

**How to use:**
```javascript
import { getPlaceholderUrl, getOptimizedUrl } from '@/lib/config/storage';

const placeholder = getPlaceholderUrl(storage, fileId);
const fullImage = getOptimizedUrl(storage, fileId, 'gallery');

<img
  src={placeholder}  // Loads instantly
  data-src={fullImage}  // Lazy load when visible
  loading="lazy"
/>
```

**Impact:**
- Gallery with 100 photos: 100 × 10KB = 1 MB instant load
- Full images load on-demand: 100 × 2 MB = 200 MB (only if scrolled)
- 200x faster initial page load!

### 5. Hybrid Face Detection (Best of Both Worlds)

**What we keep:**
- ✅ Client-side face-api.js for uploads (accuracy + matching)
- ✅ Server-side face-api.js for custom crops (fallback)

**What we add:**
- ⭐ Cloudinary face detection for thumbnails (optional, faster)

**Config:**
```javascript
cloudinary: {
  useFaceDetection: false,  // Keep face-api.js by default
}
```

**Comparison:**

| Feature | face-api.js | Cloudinary |
|---------|-------------|------------|
| Accuracy | Very high | Good |
| Speed | Slower | Instant |
| Matching | ✅ 128D descriptors | ❌ No matching |
| Server CPU | Uses CPU | Zero CPU |
| Works offline | ✅ Yes | ❌ No |

**Recommendation:** Keep face-api.js for uploads/matching, optionally use Cloudinary for thumbnails only.

**How to use both:**
```javascript
import { getFaceThumbnailUrl } from '@/lib/config/storage';

// Uses Cloudinary if enabled, falls back to face-api.js
const thumbUrl = getFaceThumbnailUrl(storage, fileId, true);
```

## 📊 Bandwidth Calculation

### Without Optimizations
```
1000 photos × 5 MB = 5 GB storage ✅
100 guests × 50 photos viewed × 5 MB = 25 GB bandwidth ⚠️ AT LIMIT

Downloads:
50 guests × 100 photos × 5 MB = 25 GB ⚠️ AT LIMIT

Total bandwidth: 50 GB/month ❌ EXCEEDS LIMIT
```

### With Our Optimizations
```
1000 photos × 2 MB (optimized) = 2 GB storage ✅

Gallery views (lazy loaded):
100 guests × 50 photos × 10 KB (placeholder) = 50 MB ✅
100 guests × 20 photos × 2 MB (full images) = 4 GB ✅

Downloads (rate limited):
50 guests × 20 photos × 2 MB = 2 GB ✅
(Rate limit prevents mass downloads)

Total bandwidth: ~7 GB/month ✅ WELL UNDER 25 GB LIMIT!
```

**Savings: 86% reduction in bandwidth usage!**

## 🎮 Usage Examples

### Example 1: Optimized Gallery

```javascript
// components/FaceGallery.js
import { getOptimizedUrl, getPlaceholderUrl } from '@/lib/config/storage';
import { getStorageAdapter } from '@/lib/storage';

const storage = getStorageAdapter();

{photos.map(photo => {
  const placeholder = getPlaceholderUrl(storage, photo.driveId);
  const fullUrl = getOptimizedUrl(storage, photo.driveId, 'gallery');

  return (
    <div className="photo-card">
      <img
        src={placeholder}  // 10 KB - loads instantly
        data-src={fullUrl}  // 2 MB - lazy loads
        loading="lazy"
        alt="Wedding Photo"
      />
    </div>
  );
})}
```

### Example 2: Rate-Limited Download

```javascript
// app/api/download/[driveId]/route.js
import { withDownloadRateLimit } from '@/lib/middleware/downloadRateLimit';
import { getStorageAdapter } from '@/lib/storage';

export async function GET(request, { params }) {
  return withDownloadRateLimit(request, async () => {
    const storage = getStorageAdapter();
    const { stream, contentType } = await storage.getStream(params.driveId);

    return new Response(stream, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'attachment',
      },
    });
  });
}
```

### Example 3: Batched Album Download

```javascript
// app/api/download-album/route.js
import { calculateBatchSize, validateAlbumSize, withDownloadRateLimit } from '@/lib/middleware/downloadRateLimit';

export async function POST(request) {
  return withDownloadRateLimit(request, async () => {
    const { photoIds, batch = 1 } = await request.json();

    // Validate size
    const validation = validateAlbumSize(photoIds.length);
    if (!validation.valid) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    // Calculate batches
    const { batches, batchSize } = calculateBatchSize(photoIds.length);

    // Get photos for this batch
    const startIdx = (batch - 1) * batchSize;
    const endIdx = Math.min(startIdx + batchSize, photoIds.length);
    const batchPhotoIds = photoIds.slice(startIdx, endIdx);

    // Create ZIP with batch
    const zip = await createZip(batchPhotoIds);

    return new Response(zip, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="album-batch-${batch}.zip"`,
      },
    });
  });
}
```

## 🔧 Configuration Levels

### Level 1: Default (Recommended)
```bash
# .env.local - Just set provider
STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=dibluthbm
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

**Result:**
- ✅ Auto-quality enabled
- ✅ Auto-format enabled
- ✅ Rate limiting enabled
- ✅ Batching enabled
- ✅ Lazy loading enabled
- ✅ Face-api.js kept for accuracy

### Level 2: Custom Optimization
```bash
# Fine-tune optimizations
CLOUDINARY_AUTO_QUALITY=true
CLOUDINARY_AUTO_FORMAT=true
CLOUDINARY_FACE_DETECTION=false  # Keep face-api.js

DOWNLOAD_RATE_LIMIT=true
DOWNLOAD_MAX_CONCURRENT=5  # Allow more concurrent
DOWNLOAD_MAX_PER_MINUTE=30  # Allow faster downloads
```

### Level 3: Maximum Performance
```bash
# All optimizations enabled
CLOUDINARY_AUTO_QUALITY=true
CLOUDINARY_AUTO_FORMAT=true
CLOUDINARY_FACE_DETECTION=true  # Use Cloudinary faces

USE_PLACEHOLDERS=true
PLACEHOLDER_QUALITY=5  # Smaller placeholders
PLACEHOLDER_WIDTH=30   # Tiny placeholders

DOWNLOAD_BATCH_SIZE=25  # Smaller batches
```

## 🧪 Testing

### Test Rate Limiting
```bash
# Try downloading 25 photos in 1 minute
for i in {1..25}; do
  curl http://localhost:3000/api/download/photo-$i -o photo-$i.jpg
done

# After 20, you should get:
# {"error":"Rate limit exceeded. Max: 20 downloads/minute","retryAfter":45}
```

### Test Batching
```bash
# Try downloading 600 photos
curl -X POST http://localhost:3000/api/download-album \
  -H "Content-Type: application/json" \
  -d '{"photoIds": [...600 ids...]}'

# Should get:
# {"error":"Album too large. Max: 500 photos. Use batching instead."}
```

### Test Optimizations
```bash
# Check image URLs
curl http://localhost:3000/api/photos | jq '.photos[0].url'

# Should see optimized URL:
# "https://res.cloudinary.com/.../q_auto,f_auto,w_800,h_600/..."
```

## 📈 Monitoring

### Check Cloudinary Usage

1. Go to [Cloudinary Console](https://console.cloudinary.com/)
2. Click **"Reports"** → **"Usage"**
3. Monitor:
   - **Storage used** (should stay under 25 GB)
   - **Bandwidth used** (should stay under 25 GB/month)
   - **Transformations** (should stay under 25,000/month)

### Alert Thresholds

**Set up alerts when:**
- Storage > 20 GB (80% of limit)
- Bandwidth > 20 GB/month (80% of limit)
- Transformations > 20,000/month (80% of limit)

## 🎯 Summary

**What We Built:**
1. ✅ **Modular storage system** - Switch providers anytime
2. ✅ **Auto-optimization** - 60% smaller files (FREE!)
3. ✅ **Rate limiting** - Prevents bandwidth abuse
4. ✅ **Smart batching** - Large albums in chunks
5. ✅ **Lazy loading** - Instant page loads
6. ✅ **Kept face-api.js** - Accurate face detection & matching
7. ✅ **Optional Cloudinary faces** - Zero CPU usage for thumbnails

**Result:**
- **86% bandwidth reduction** (50 GB → 7 GB)
- **200x faster page loads** (lazy loading)
- **Free tier sufficient** for 1000+ photo weddings
- **Future-proof** - switch providers anytime
- **No code deleted** - all original features intact!

🎉 **You get Cloudinary's premium features for FREE while staying under limits!**
