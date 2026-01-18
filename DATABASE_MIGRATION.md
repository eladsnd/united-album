# Database Migration Guide

## Overview

This guide documents the migration from JSON file storage to PostgreSQL database using Prisma ORM, enabling free and reliable deployment on Vercel.

---

## 🎯 Goal: Enable Free Deployment for Wedding

### Problem with JSON Files
The app currently stores data in local JSON files:
- `data/photos.json` - Photo metadata
- `data/faces.json` - Face recognition descriptors
- `data/challenges.json` - Pose challenges

**Why this doesn't work on Vercel:**
- ❌ **Ephemeral Storage**: All files deleted on restart/redeploy
- ❌ **Data Loss**: Wedding photos lost permanently
- ❌ **No Concurrency**: JSON files can't handle simultaneous uploads
- ❌ **No Locking on Serverless**: File locking doesn't work across instances

### Solution: PostgreSQL + Prisma
- ✅ **Persistent Storage**: Data survives restarts
- ✅ **Free Tier**: Vercel Postgres (256MB free)
- ✅ **ACID Transactions**: Prevents race conditions
- ✅ **Scalable**: Handles 100+ concurrent guests

---

## 📊 Database Schema

### Photo Table
Stores photo metadata and face associations:
```prisma
model Photo {
  id          BigInt    @id @default(autoincrement())
  name        String                                  // Original filename
  driveId     String    @unique                       // Google Drive file ID
  url         String                                  // Proxy URL for display
  mainFaceId  String    @default("unknown")           // Primary person in photo
  faceIds     String[]  @default([])                  // All detected face IDs
  faceBoxes   Json      @default("[]")                // Bounding box coordinates
  poseId      String    @default("unknown_pose")      // Associated challenge
  uploaderId  String?                                 // Session ID of uploader
  timestamp   DateTime  @default(now())               // Upload time
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

**Indexes**: driveId (unique), mainFaceId, poseId, uploaderId, timestamp

### Face Table
Stores face recognition descriptors:
```prisma
model Face {
  faceId            String   @id                      // person_1, person_2, etc.
  descriptors       Json     @default("[]")           // Array of 128D vectors
  descriptor        Json     @default("[]")           // Average descriptor
  metadata          Json     @default("{}")           // Additional metadata
  thumbnailDriveId  String?                           // Thumbnail file ID
  lastSeen          DateTime @default(now())          // Last photo timestamp
  photoCount        Int      @default(0)              // Photos containing face
  sampleCount       Int      @default(0)              // Descriptor samples collected
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

**Indexes**: photoCount, lastSeen

### Challenge Table
Stores pose challenges:
```prisma
model Challenge {
  id          String   @id                           // dip, back-to-back, etc.
  title       String                                  // Display title
  instruction String                                  // Instructions for guests
  image       String                                  // Image path
  folderId    String?                                 // Google Drive folder ID
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**Indexes**: title

---

## 🚀 Migration Steps

### 1. Setup (Completed)
```bash
# Install Prisma
npm install prisma @prisma/client

# Initialize Prisma with PostgreSQL
npx prisma init --datasource-provider postgresql

# Generate Prisma Client
npx prisma generate
```

### 2. Local Development (SQLite)
For local testing without PostgreSQL:

**Update `.env`**:
```env
DATABASE_URL="file:./dev.db"
```

**Update `prisma/schema.prisma`**:
```prisma
datasource db {
  provider = "sqlite"  // Changed from postgresql
  url      = env("DATABASE_URL")
}
```

**Create database**:
```bash
npx prisma migrate dev --name init
```

### 3. Production Setup (Vercel Postgres)

**In Vercel Dashboard**:
1. Go to Storage → Create Database
2. Choose "Postgres" → Free tier (256MB)
3. Copy `DATABASE_URL` connection string

**Add to Vercel Environment Variables**:
```
DATABASE_URL=postgres://user:pass@host:5432/dbname?sslmode=require
```

**Push schema to production**:
```bash
npx prisma db push
```

### 4. Data Migration Script

Run the migration script to import existing JSON data:
```bash
node scripts/migrateToDatabase.js
```

This script:
- Reads data/photos.json, faces.json, challenges.json
- Inserts all records into database
- Preserves IDs and timestamps
- Reports success/failures

---

## 📝 Code Changes Required

### lib/photoStorage.js (Refactor)
**Before** (JSON file):
```javascript
export function savePhoto(photo) {
    const photos = loadPhotos();  // Read JSON file
    photos.push(photo);
    fs.writeFileSync(PHOTOS_FILE, JSON.stringify(photos));
}
```

**After** (Prisma):
```javascript
import prisma from './prisma.js';

export async function savePhoto(photo) {
    return await prisma.photo.create({
        data: {
            name: photo.name,
            driveId: photo.driveId,
            url: photo.url,
            mainFaceId: photo.mainFaceId,
            faceIds: photo.faceIds,
            faceBoxes: photo.faceBoxes,
            poseId: photo.poseId,
            uploaderId: photo.uploaderId,
            timestamp: new Date(photo.timestamp)
        }
    });
}
```

### lib/faceStorage.js (Refactor)
**Before** (JSON file):
```javascript
export function saveFaceDescriptor(faceId, descriptor, metadata) {
    const faces = loadFaces();
    faces.push({ faceId, descriptor, metadata });
    fs.writeFileSync(FACES_FILE, JSON.stringify(faces));
}
```

**After** (Prisma):
```javascript
import prisma from './prisma.js';

export async function saveFaceDescriptor(faceId, descriptors, metadata) {
    return await prisma.face.upsert({
        where: { faceId },
        update: {
            descriptors,
            descriptor: metadata.descriptor,
            thumbnailDriveId: metadata.thumbnailDriveId,
            photoCount: { increment: 1 },
            lastSeen: new Date()
        },
        create: {
            faceId,
            descriptors,
            descriptor: metadata.descriptor || [],
            metadata,
            thumbnailDriveId: metadata.thumbnailDriveId,
            photoCount: 1,
            sampleCount: descriptors.length
        }
    });
}
```

### API Routes (Add await)
All API routes that use photo/face storage must add `await`:
```javascript
// Before
const photo = savePhoto(newPhoto);

// After
const photo = await savePhoto(newPhoto);
```

---

## 🧪 Testing Strategy

### 1. Unit Tests (Jest)
Test database operations in isolation:
```javascript
import prisma from '../lib/prisma';

describe('Photo Database Operations', () => {
    beforeEach(async () => {
        await prisma.photo.deleteMany();
    });

    it('should create a photo', async () => {
        const photo = await prisma.photo.create({
            data: {
                name: 'test.jpg',
                driveId: 'abc123',
                url: '/api/image/abc123'
            }
        });
        expect(photo.driveId).toBe('abc123');
    });
});
```

### 2. Integration Tests
Test API routes with database:
```javascript
const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
});
const data = await response.json();
expect(data.success).toBe(true);
```

### 3. Manual Testing Checklist
- [ ] Upload photo → Verify saved in database
- [ ] Face detection → Verify faces in database
- [ ] Delete photo → Verify removed from database
- [ ] Gallery filtering → Verify queries work
- [ ] Concurrent uploads → No race conditions

---

## 🔄 Rollback Plan

If database migration fails, rollback to JSON files:

1. **Switch back to main branch**:
```bash
git checkout main
```

2. **Restore original code**: JSON files still work locally

3. **Keep database branch**: Available for future retry

---

## 📊 Free Tier Limits (Vercel Postgres)

| Resource | Free Tier | Wedding Needs | Status |
|----------|-----------|---------------|--------|
| Database Storage | 256MB | ~50MB (500 photos) | ✅ |
| Rows | Unlimited | ~1000 rows | ✅ |
| Bandwidth | 100GB/month | ~20GB | ✅ |
| Concurrent Connections | 20 | 10-20 guests | ✅ |
| Uptime | 99.9% | Critical | ✅ |

**Verdict**: Free tier is perfect for wedding (200 guests, 500 photos)

---

## 🎯 Deployment Checklist

### Before Wedding (2 Weeks)
- [ ] Complete database migration
- [ ] Test all features with database
- [ ] Deploy to Vercel with Postgres
- [ ] Share URL with family (beta test)
- [ ] Monitor for 1 week

### 1 Week Before
- [ ] Freeze deployments (no changes!)
- [ ] Verify Vercel Postgres is online
- [ ] Print QR codes with final URL
- [ ] Prepare backup plan

### Wedding Day
- [ ] Monitor every 30 minutes
- [ ] Have laptop nearby (emergency)
- [ ] Tech-savvy friend on standby

---

## 📞 Support

**Prisma Docs**: https://www.prisma.io/docs
**Vercel Postgres**: https://vercel.com/docs/storage/vercel-postgres
**Troubleshooting**: Check DEPLOYMENT_GUIDE.md

---

**Status**: ✅ Schema created, Prisma client generated
**Next**: Create migration script and refactor storage layers
