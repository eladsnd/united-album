# Round 3: Security and API Vulnerability Analysis

**Generated**: 2026-01-17 (Round 3)
**Focus**: API Security, Rate Limiting, Authentication, DoS Vectors
**Severity Levels**: 🔴 Critical | 🟠 High | 🟡 Medium | ℹ️ Info

---

## 🔴 CRITICAL ISSUES

### 1. Admin Password Brute-Force Attack (No Rate Limiting)
**File**: `app/api/admin/auth/route.js:39-107`
**Severity**: 🔴 Critical (Security - Authentication Bypass)

**Problem**: Admin login endpoint has NO rate limiting
```javascript
// app/api/admin/auth/route.js
export async function POST(request) {
    const { password } = await request.json();

    if (!password) {
        return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const isValid = verifyAdminPassword(password); // ❌ NO RATE LIMIT

    if (!isValid) {
        return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    // ...
}
```

**Attack Scenario**:
```bash
# Attacker can try thousands of passwords per second
for password in $(cat wordlist.txt); do
    curl -X POST http://localhost:3000/api/admin/auth \
         -H "Content-Type: application/json" \
         -d "{\"password\":\"$password\"}"
done
```

**Impact**:
- Unlimited password attempts (brute-force attack)
- No IP-based throttling
- No account lockout
- Timing-safe comparison is useless if attacker can try 10,000 passwords/second
- Full admin access if password is weak (8 chars = ~6 hours with good wordlist)

**Fix**:
```javascript
import { applyRateLimit } from '../../../../lib/rateLimit';

export async function POST(request) {
    // CRITICAL: Rate limit admin login attempts
    const rateLimitResult = applyRateLimit(request, 'auth', {
        maxRequests: 5,        // Only 5 attempts per minute
        windowMs: 60 * 1000    // 1 minute window
    });

    if (!rateLimitResult.allowed) {
        return NextResponse.json(
            {
                success: false,
                error: 'Too many login attempts. Please try again later.',
                retryAfter: Math.ceil(rateLimitResult.retryAfter / 1000)
            },
            {
                status: 429,
                headers: {
                    'Retry-After': Math.ceil(rateLimitResult.retryAfter / 1000).toString()
                }
            }
        );
    }

    const { password } = await request.json();
    const isValid = verifyAdminPassword(password);

    // ... rest of logic
}
```

**Alternative Fix - Progressive Delay**:
```javascript
// Track failed attempts per IP
const failedAttempts = new Map(); // IP -> { count, lastAttempt }

export async function POST(request) {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const attempts = failedAttempts.get(ip) || { count: 0, lastAttempt: 0 };

    // Progressive delay: 0s, 2s, 5s, 10s, 30s, 60s
    const delays = [0, 2000, 5000, 10000, 30000, 60000];
    const delay = delays[Math.min(attempts.count, delays.length - 1)];

    if (Date.now() - attempts.lastAttempt < delay) {
        return NextResponse.json(
            { error: `Too many failed attempts. Wait ${delay/1000}s` },
            { status: 429 }
        );
    }

    const { password } = await request.json();
    const isValid = verifyAdminPassword(password);

    if (!isValid) {
        attempts.count++;
        attempts.lastAttempt = Date.now();
        failedAttempts.set(ip, attempts);
        return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    // Success - clear failed attempts
    failedAttempts.delete(ip);
    // ... return token
}
```

---

### 2. Photo Deletion DoS Attack (No Rate Limiting)
**File**: `app/api/delete-photo/route.js`
**Severity**: 🔴 Critical (DoS - Resource Exhaustion)

**Problem**: Delete endpoint has NO rate limiting
```javascript
// delete-photo/route.js - Uses NestJS architecture but missing rate limit
async function deletePhotoHandler(request) {
    // ❌ NO RATE LIMITING
    const { searchParams } = new URL(request.url);
    const photoId = parseInt(searchParams.get('photoId'), 10);

    const photoService = getPhotoService();
    await photoService.deletePhoto(photoId, ...); // Expensive: Drive API + disk I/O
}

export const DELETE = withLogging(withErrorHandler(deletePhotoHandler));
```

**Attack Scenario**:
```javascript
// Attacker with valid uploaderId can spam delete requests
const uploaderId = "uploader_1234_abc";
for (let i = 0; i < 1000; i++) {
    fetch(`/api/delete-photo?photoId=${i}&uploaderId=${uploaderId}`, {
        method: 'DELETE'
    });
}
```

**Impact**:
- Each delete = Google Drive API call + 2 JSON file writes
- 1000 concurrent deletes = server freeze
- Blocks all other requests (synchronous file I/O)
- Admin users can delete ANYTHING without limit
- Orphaned face cleanup = expensive queries for each delete

**Fix**:
```javascript
import { applyRateLimit } from '../../../lib/rateLimit';

async function deletePhotoHandler(request) {
    // Add rate limiting to prevent deletion spam
    const rateLimitResult = applyRateLimit(request, 'api'); // Uses existing 'api' bucket

    if (!rateLimitResult.allowed) {
        throw new AppError(
            'Too many delete requests. Please slow down.',
            429,
            'RATE_LIMIT_EXCEEDED'
        );
    }

    // ... existing logic
}
```

**Better Fix - Stricter Limit for Delete**:
```javascript
// Create dedicated rate limit for destructive operations
const rateLimitResult = applyRateLimit(request, 'delete', {
    maxRequests: 10,       // Only 10 deletes per minute
    windowMs: 60 * 1000
});
```

---

### 3. Face Data Injection Attack (No Input Sanitization)
**File**: `app/api/faces/route.js:16-37`
**Severity**: 🟠 High (Data Corruption + Potential XSS)

**Problem**: Face POST endpoint accepts arbitrary data without validation
```javascript
// app/api/faces/route.js
export async function POST(request) {
    const { faceId, descriptor, metadata } = await request.json();

    if (!faceId || !descriptor) {
        return NextResponse.json({ error: 'faceId and descriptor required' }, { status: 400 });
    }

    // ❌ NO VALIDATION of faceId format
    // ❌ NO VALIDATION of descriptor type/length
    // ❌ NO SANITIZATION of metadata

    const savedFace = saveFaceDescriptor(faceId, descriptor, metadata);
    return NextResponse.json({ success: true, face: savedFace });
}
```

**Attack Scenarios**:

**1. XSS via faceId**:
```javascript
fetch('/api/faces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        faceId: '<img src=x onerror=alert(document.cookie)>',
        descriptor: [0,0,0,...],
        metadata: {}
    })
});
// Later displayed in FaceGallery without escaping → XSS
```

**2. Database Corruption**:
```javascript
// Massive descriptor array → DoS
fetch('/api/faces', {
    method: 'POST',
    body: JSON.stringify({
        faceId: 'person_1',
        descriptor: new Array(1000000).fill(0), // 1 million elements
        metadata: { photoCount: -999999 } // Negative count
    })
});
```

**3. Malicious Metadata**:
```javascript
// Inject executable code into metadata
{
    faceId: 'person_1',
    descriptor: [...],
    metadata: {
        name: '<script>alert("XSS")</script>',
        notes: '"; DROP TABLE faces; --'
    }
}
```

**Fix**:
```javascript
import { sanitizeFaceId } from '../../../lib/utils/sanitize';

export async function POST(request) {
    const { faceId, descriptor, metadata } = await request.json();

    // 1. Validate faceId format
    if (!faceId || typeof faceId !== 'string') {
        return NextResponse.json({ error: 'Invalid faceId' }, { status: 400 });
    }

    // Sanitize faceId - only allow person_N format
    const sanitizedFaceId = sanitizeFaceId(faceId);
    if (!sanitizedFaceId || !/^person_\d+$/.test(sanitizedFaceId)) {
        return NextResponse.json(
            { error: 'Invalid faceId format. Expected: person_N' },
            { status: 400 }
        );
    }

    // 2. Validate descriptor is array of numbers
    if (!Array.isArray(descriptor)) {
        return NextResponse.json({ error: 'Descriptor must be array' }, { status: 400 });
    }

    if (descriptor.length !== 128) {
        return NextResponse.json(
            { error: 'Descriptor must have exactly 128 dimensions' },
            { status: 400 }
        );
    }

    const validDescriptor = descriptor.every(
        val => typeof val === 'number' && isFinite(val) && !isNaN(val)
    );

    if (!validDescriptor) {
        return NextResponse.json(
            { error: 'Descriptor must contain only finite numbers' },
            { status: 400 }
        );
    }

    // 3. Sanitize metadata (remove any HTML/scripts)
    const sanitizedMetadata = metadata ? {
        photoCount: typeof metadata.photoCount === 'number'
            ? Math.max(0, Math.floor(metadata.photoCount))
            : 0,
        timestamp: metadata.timestamp || new Date().toISOString(),
        // Strip any other fields that could contain XSS
    } : {};

    const savedFace = saveFaceDescriptor(sanitizedFaceId, descriptor, sanitizedMetadata);
    return NextResponse.json({ success: true, face: savedFace });
}
```

---

## 🟠 HIGH PRIORITY ISSUES

### 4. Download Album DoS (No Size Limit)
**File**: `app/api/download-album/route.js:6-55`
**Severity**: 🟠 High (DoS - Memory Exhaustion)

**Problem**: No limit on number of photos in ZIP download
```javascript
export async function POST(request) {
    const { photoIds } = await request.json();

    // ❌ NO VALIDATION of photoIds length
    // ❌ NO RATE LIMITING

    const photos = getPhotos();
    const selectedPhotos = photos.filter(p => photoIds.includes(p.id));

    const zip = new JSZip();

    // Download ALL photos into memory
    for (const photo of selectedPhotos) {
        const stream = await getFileStream(photo.driveId);
        const chunks = [];

        for await (const chunk of stream) {
            chunks.push(chunk); // ❌ Unbounded memory usage
        }

        const buffer = Buffer.concat(chunks);
        zip.file(filename, buffer); // ❌ All photos in memory at once
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    return new NextResponse(zipBuffer, { ... });
}
```

**Attack Scenario**:
```javascript
// Request ZIP of ALL photos (1000+ photos = 5GB+)
fetch('/api/download-album', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        photoIds: Array.from({ length: 1000 }, (_, i) => i) // All photo IDs
    })
});
// Server runs out of memory and crashes
```

**Impact**:
- 1000 photos × 5MB = 5GB in memory
- Server OOM (Out of Memory) crash
- All requests blocked while generating ZIP
- No timeout → request can run for hours

**Fix**:
```javascript
import { applyRateLimit } from '../../../lib/rateLimit';

export async function POST(request) {
    // 1. Rate limit downloads
    const rateLimitResult = applyRateLimit(request, 'download', {
        maxRequests: 3,         // Only 3 album downloads per hour
        windowMs: 60 * 60 * 1000
    });

    if (!rateLimitResult.allowed) {
        return NextResponse.json(
            { error: 'Download limit reached. Please try again later.' },
            { status: 429 }
        );
    }

    const { photoIds } = await request.json();

    // 2. Validate photoIds is array
    if (!Array.isArray(photoIds)) {
        return NextResponse.json({ error: 'photoIds must be array' }, { status: 400 });
    }

    // 3. Limit number of photos per ZIP
    const MAX_PHOTOS_PER_ZIP = 50;
    if (photoIds.length > MAX_PHOTOS_PER_ZIP) {
        return NextResponse.json(
            { error: `Maximum ${MAX_PHOTOS_PER_ZIP} photos per download` },
            { status: 400 }
        );
    }

    // 4. Estimate total size before starting
    const photos = getPhotos();
    const selectedPhotos = photos.filter(p => photoIds.includes(p.id));

    const estimatedSize = selectedPhotos.length * 5 * 1024 * 1024; // Assume 5MB avg
    const MAX_ZIP_SIZE = 100 * 1024 * 1024; // 100MB max

    if (estimatedSize > MAX_ZIP_SIZE) {
        return NextResponse.json(
            { error: 'Selected photos exceed maximum download size (100MB)' },
            { status: 413 } // Payload Too Large
        );
    }

    // ... rest of ZIP generation
}
```

---

### 5. Download Individual Photo DoS (No Rate Limiting)
**File**: `app/api/download/[driveId]/route.js:5-85`
**Severity**: 🟠 High (DoS - Bandwidth Exhaustion)

**Problem**: No rate limiting on individual photo downloads
```javascript
export async function GET(request, { params }) {
    const { driveId } = await params;

    // ❌ NO RATE LIMITING
    // Each download = Google Drive API call + stream buffering

    const response = await getFileStream(driveId);
    const stream = response.stream;

    // Buffer entire file into memory
    const chunks = [];
    await new Promise((resolve, reject) => {
        stream.on('data', (chunk) => {
            chunks.push(chunk); // ❌ Unbounded
        });
        // ...
    });

    const buffer = Buffer.concat(chunks);
    return new NextResponse(buffer, { ... });
}
```

**Attack Scenario**:
```javascript
// Spam download requests to exhaust Google Drive API quota
for (let i = 0; i < 1000; i++) {
    fetch(`/api/download/${driveId}`);
}
// Google Drive API quota exceeded → all downloads fail for all users
```

**Impact**:
- Google Drive API has daily quota limits
- Unlimited downloads = quota exhaustion
- All users unable to download/view photos
- Bandwidth costs for hosting provider

**Fix**:
```javascript
import { applyRateLimit } from '../../../../lib/rateLimit';

export async function GET(request, { params }) {
    const { driveId } = await params;

    // Rate limit downloads per IP
    const rateLimitResult = applyRateLimit(request, 'download', {
        maxRequests: 20,        // 20 downloads per minute per IP
        windowMs: 60 * 1000
    });

    if (!rateLimitResult.allowed) {
        return NextResponse.json(
            { error: 'Download rate limit exceeded' },
            { status: 429 }
        );
    }

    // ... rest of download logic
}
```

---

### 6. Photo List API Information Disclosure
**File**: `app/api/photos/route.js:5-47`
**Severity**: 🟡 Medium (Information Disclosure)

**Problem**: Public endpoint exposes ALL photo metadata
```javascript
export async function GET() {
    try {
        const localPhotos = getPhotos();
        const validDriveIds = await listDriveFiles();

        const filteredPhotos = localPhotos.filter(p => {
            if (p.driveId === 'mock_drive_id') return true;
            return validDriveIds.has(p.driveId);
        });

        // ❌ Returns ALL photo metadata to ANYONE
        return NextResponse.json(syncedPhotos);
    } catch (error) {
        return NextResponse.json(getPhotos()); // ❌ Fallback also exposes all
    }
}
```

**Information Leaked**:
```json
[
  {
    "id": 1,
    "driveId": "1abc123...",
    "uploaderId": "uploader_1234_xyz",  // ← Session ID leaked
    "mainFaceId": "person_3",
    "faceIds": ["person_3", "person_7"],
    "faceBoxes": [...],
    "poseId": "warrior-pose",
    "timestamp": "2026-01-15T10:30:00Z",
    "url": "/api/image/1abc123..."
  }
]
```

**Privacy Issues**:
1. **Uploader tracking**: `uploaderId` reveals who uploaded what
2. **Face tracking**: Can map which person appears in which photos
3. **Timeline analysis**: Timestamps reveal event timeline
4. **Pose analysis**: Know which poses were completed

**Not Critical Because**:
- This is a wedding album app (semi-public by design)
- Photos are already shared with guests
- Face IDs don't contain PII (just "person_N")

**But Still Concerning**:
- Uploader IDs could be used to track individuals across sessions
- Someone could scrape all photo URLs and download entire album
- No authentication required to view metadata

**Optional Fix** (if privacy is desired):
```javascript
export async function GET(request) {
    // Option 1: Require authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Option 2: Sanitize response (remove sensitive fields)
    const photos = getPhotos();
    const sanitizedPhotos = photos.map(p => ({
        id: p.id,
        url: p.url,
        mainFaceId: p.mainFaceId,
        poseId: p.poseId,
        timestamp: p.timestamp,
        // ❌ REMOVE: uploaderId, faceBoxes (contain coordinates)
    }));

    return NextResponse.json(sanitizedPhotos);
}
```

---

## 🟡 MEDIUM PRIORITY ISSUES

### 7. Missing Rate Limit on Face Thumbnails API
**File**: `app/api/face-thumbnails/route.js`
**Severity**: 🟡 Medium (DoS - Resource Usage)

**Problem**: Face thumbnails endpoint has no rate limiting
```javascript
// Likely pattern based on other APIs
export async function GET() {
    // ❌ NO RATE LIMITING
    // Generates thumbnail URLs for all faces
    // Could be called repeatedly to waste resources
}
```

**Impact**: Lower than download endpoints, but still allows abuse

**Fix**: Add standard API rate limiting
```javascript
import { applyRateLimit } from '../../../lib/rateLimit';

export async function GET(request) {
    const rateLimitResult = applyRateLimit(request, 'api');
    if (!rateLimitResult.allowed) {
        return rateLimitResult.response;
    }
    // ... rest of logic
}
```

---

### 8. Config API Exposes Server IP
**File**: `app/api/config/route.js:4-7`
**Severity**: ℹ️ Info (Information Disclosure)

**Problem**: Public endpoint reveals server's local IP
```javascript
export async function GET() {
    const localIP = getLocalIP();
    return NextResponse.json({ localIP }); // ❌ Exposes internal IP
}
```

**Use Case**: Needed for QR code generation for mobile access

**Risk**: Low (local IP is not directly exploitable)

**Recommendation**: Add comment explaining why this is needed
```javascript
/**
 * GET /api/config
 *
 * Returns server configuration for client use.
 *
 * NOTE: Exposes local IP address for QR code generation.
 * This is intentional to allow guests to connect to the album
 * on the local network. The IP is only the local network address
 * (192.168.x.x or 10.x.x.x), not the public IP.
 */
export async function GET() {
    const localIP = getLocalIP();
    return NextResponse.json({ localIP });
}
```

---

## Summary Table

| Issue | Severity | Impact | Complexity | Priority |
|-------|----------|--------|------------|----------|
| Admin Brute-Force | 🔴 Critical | Auth Bypass | Low | **URGENT** |
| Delete DoS | 🔴 Critical | Resource Exhaustion | Low | **URGENT** |
| Face Data Injection | 🟠 High | XSS + Corruption | Medium | High |
| Album Download DoS | 🟠 High | Memory Exhaustion | Medium | High |
| Photo Download DoS | 🟠 High | Quota Exhaustion | Low | High |
| Photo List Info Leak | 🟡 Medium | Privacy | Low | Medium |
| Face Thumbnails DoS | 🟡 Medium | Resource Usage | Low | Low |
| Config IP Disclosure | ℹ️ Info | Minimal | Very Low | Document |

---

## Recommended Implementation Order

### **IMMEDIATE** (Today - 2 hours):

1. **Add Admin Login Rate Limiting** (30 min)
   - File: `app/api/admin/auth/route.js`
   - Add 5 attempts/minute limit
   - Critical to prevent password brute-force

2. **Add Delete Endpoint Rate Limiting** (15 min)
   - File: `app/api/delete-photo/route.js`
   - Add 10 deletes/minute limit
   - Prevent deletion spam DoS

3. **Add Download Rate Limiting** (30 min)
   - Files: `app/api/download/[driveId]/route.js`, `app/api/download-album/route.js`
   - Individual: 20/min, Album: 3/hour
   - Prevent API quota exhaustion

4. **Add Album Download Size Limit** (30 min)
   - File: `app/api/download-album/route.js`
   - Max 50 photos per ZIP
   - Prevent memory exhaustion

### **THIS WEEK** (4 hours):

5. **Validate Face API Input** (2 hours)
   - File: `app/api/faces/route.js`
   - Validate faceId format, descriptor dimensions
   - Sanitize metadata
   - Prevent XSS and data corruption

6. **Add Rate Limiting to Face Thumbnails** (15 min)
   - File: `app/api/face-thumbnails/route.js`
   - Standard API rate limit

7. **Sanitize Photo List Response** (30 min)
   - File: `app/api/photos/route.js`
   - Remove uploaderId from public response
   - Optional: add authentication

### **NEXT SPRINT** (Documentation):

8. **Document Config API Security** (15 min)
   - Add comments explaining IP exposure
   - Document that it's intentional for QR codes

---

## Rate Limiting Configuration Summary

Recommended rate limits by endpoint:

```javascript
// lib/rateLimit.js - Add new buckets

const RATE_LIMITS = {
    upload: {
        maxRequests: 10,
        windowMs: 60 * 1000  // 10 uploads/min
    },
    api: {
        maxRequests: 100,
        windowMs: 60 * 1000  // 100 requests/min (general)
    },
    auth: {
        maxRequests: 5,      // ← NEW: Admin login
        windowMs: 60 * 1000  // 5 attempts/min
    },
    delete: {
        maxRequests: 10,     // ← NEW: Photo deletion
        windowMs: 60 * 1000  // 10 deletes/min
    },
    download: {
        maxRequests: 20,     // ← NEW: Individual downloads
        windowMs: 60 * 1000  // 20 downloads/min
    },
    downloadAlbum: {
        maxRequests: 3,      // ← NEW: ZIP downloads
        windowMs: 60 * 60 * 1000  // 3 albums/hour
    }
};
```

---

## Testing Recommendations

After implementing fixes, test with:

1. **Admin Login Brute-Force Test**:
```bash
for i in {1..10}; do
    curl -X POST http://localhost:3000/api/admin/auth \
         -H "Content-Type: application/json" \
         -d '{"password":"wrong"}' &
done
# Should see 429 after 5 attempts
```

2. **Delete Spam Test**:
```bash
for i in {1..20}; do
    curl -X DELETE "http://localhost:3000/api/delete-photo?photoId=1&uploaderId=test" &
done
# Should see 429 after 10 deletes
```

3. **Download Spam Test**:
```bash
for i in {1..30}; do
    curl http://localhost:3000/api/download/test123 &
done
# Should see 429 after 20 downloads
```

4. **Album Size Limit Test**:
```javascript
fetch('/api/download-album', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        photoIds: Array.from({ length: 100 }, (_, i) => i)
    })
});
// Should return 400 "Maximum 50 photos per download"
```
