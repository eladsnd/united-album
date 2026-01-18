# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

United Album is a Next.js wedding photo-sharing application that combines pose challenges with face recognition. Guests can view pose challenges, upload photos, and browse a face-organized gallery. The app uses Google Drive for storage and client-side face detection for automatic photo organization.

## Development Commands

```bash
# Development
npm run dev              # Start Next.js dev server (localhost:3000)
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run Next.js linter

# Testing
npm test                 # Run Jest test suite
npm run test:watch       # Run Jest in watch mode

# Utilities
node scripts/cleanupData.js  # Clean and merge face data from photos.json and faces.json
```

## Architecture

### Core Data Flow

1. **Photo Upload Flow** (`app/api/upload/route.js`):
   - Client-side face detection runs BEFORE upload using `utils/clientFaceDetection.js`
   - Photo uploads to Google Drive via `lib/googleDrive.js`
   - Metadata (including face IDs, bounding boxes, pose ID) saved to database via `lib/repositories/PhotoRepository.js`
   - Face descriptors saved to database via `lib/repositories/FaceRepository.js`
   - Timestamps automatically captured (`timestamp`, `createdAt`, `updatedAt`)

2. **Pose Challenge Management** (`app/api/admin/poses/route.js`):
   - Pose images uploaded to Google Drive `challenges/` subfolder
   - Challenge metadata stored in database via `lib/repositories/ChallengeRepository.js`
   - Images served via `/api/image/[id]` proxy endpoint
   - Structured folder organization ensures production persistence

3. **Face Detection Strategy**:
   - **Client-side** (preferred): `utils/clientFaceDetection.js` uses face-api.js with TinyFaceDetector and SSD MobileNet models
   - **Server-side** (fallback): `utils/faceDetection.js` provides hash-based face IDs (temporary workaround for TextEncoder issues)
   - Multi-face support: detects all faces, identifies primary face by size
   - Face matching: 0.45 Euclidean distance threshold for recognition

4. **Storage Architecture**:
   - **Google Drive**: All image file storage via OAuth 2.0
     - Main photos: Root folder
     - Face thumbnails: `faces/` subfolder
     - Pose challenges: `challenges/` subfolder
   - **Database (Prisma + SQLite/PostgreSQL)**:
     - Photo metadata: driveId, mainFaceId, faceIds[], faceBoxes[], poseId, timestamp
     - Face descriptors: faceId, descriptor, metadata, photoCount
     - Challenge definitions: id, title, instruction, image (Drive ID), folderId
   - **Production-ready**: All storage persists on Vercel serverless platform

5. **Image Serving**:
   - All images accessed through proxy API: `/api/image/[id]/route.js`
   - Face thumbnails dynamically cropped: `/api/face-crop/[driveId]/route.js`
   - 1-year browser cache (`Cache-Control: public, max-age=31536000, immutable`)
   - Uses Google Drive API file streams

### Key Modules

**Data Access Layer (Repositories)**:
- **`lib/repositories/PhotoRepository.js`**: Photo metadata CRUD with automatic JSON serialization for SQLite
- **`lib/repositories/FaceRepository.js`**: Face descriptor storage with multi-descriptor averaging
- **`lib/repositories/ChallengeRepository.js`**: Pose challenge CRUD operations
- **`lib/repositories/BaseRepository.js`**: Template Method pattern for consistent CRUD operations

**Business Logic Layer (Services)**:
- **`lib/services/PhotoService.js`**: Photo deletion with orphaned face cleanup
- **`lib/services/FaceService.js`**: Face detection metadata updates and thumbnail management
- **`lib/services/UploadService.js`**: Photo upload workflow and Drive integration
- **`lib/services/ChallengeService.js`**: Pose challenge CRUD with Google Drive image storage

**API Layer (Decorators)**:
- **`lib/api/decorators.js`**: Composable middleware (withApi, withErrorHandler, withRateLimit, withAdminAuth)
- **`lib/api/errors.js`**: Custom error classes (ValidationError, NotFoundError, etc.)

**Infrastructure**:
- **`lib/googleDrive.js`**: Google Drive OAuth integration (uploadToDrive, findOrCreateFolder, getFileStream)
- **`lib/rateLimit.js`**: In-memory rate limiting (10 requests/min for uploads, 30/min for admin)
- **`lib/prisma.js`**: Prisma client singleton for database operations

**Face Detection**:
- **`utils/clientFaceDetection.js`**: Browser-based face detection with dual-model strategy (TinyFaceDetector + SSD MobileNet)

**UI Components**:
- **`components/FaceGallery.js`**: Face-filtered photo gallery with timestamp display and scrollable face selector
- **`components/UploadSection.js`**: Photo upload with client-side face detection
- **`components/AdminPoseManager.js`**: Admin panel for pose challenge management

### Deprecated Modules (Do Not Use)

- **`lib/photoStorage.js`**: ⚠️ DEPRECATED - Use PhotoRepository instead
- **`lib/faceStorage.js`**: ⚠️ DEPRECATED - Use FaceRepository instead

### UI Structure

- **Sidebar navigation**: Challenge view, Gallery, Mobile QR access
- **3D Carousel**: Pose challenges with prev/active/next visible items
- **Face Gallery**: Filter by person (mainFaceId) or pose, with face thumbnail scrolling

## Environment Setup

Required environment variables (see `.env.example`):
```
GOOGLE_CLIENT_ID=         # From Google Cloud Console
GOOGLE_CLIENT_SECRET=     # From Google Cloud Console
GOOGLE_REFRESH_TOKEN=     # OAuth refresh token
GOOGLE_DRIVE_FOLDER_ID=   # Default upload folder
```

**Important**: Upload API returns 403 if OAuth credentials are missing.

## Testing Conventions

- Tests located in `__tests__/` directory
- Uses Jest with jsdom environment
- Testing Library for React components
- Run single test: `npm test -- <test-file-name>`

## Face Detection Models

Client-side face detection requires model files in `public/models/`:
- `tiny_face_detector_model-*` (primary, fast)
- `ssd_mobilenetv1_model-*` (fallback, better for small faces)
- `face_landmark_68_model-*` (landmarks)
- `face_recognition_model-*` (128D descriptors)

## Important Implementation Notes

1. **Architecture Patterns** (Repository + Service + Decorator):
   - **Repositories**: Handle all database operations (PhotoRepository, FaceRepository, ChallengeRepository)
   - **Services**: Contain business logic and orchestrate workflows (PhotoService, FaceService, UploadService, ChallengeService)
   - **Decorators**: Composable middleware for cross-cutting concerns (error handling, rate limiting, auth)
   - **Never use deprecated storage files** (`photoStorage.js`, `faceStorage.js`) - they only exist for backward compatibility in tests

2. **Google Drive Folder Organization**:
   - Main photos: Root of configured Drive folder
   - Face thumbnails: `faces/` subfolder (auto-created)
   - Pose challenges: `challenges/` subfolder (auto-created)
   - All images served via proxy: `/api/image/[driveId]`
   - Production-safe: All storage persists on Vercel serverless

3. **Face IDs**:
   - Human-friendly numbering: `person_1`, `person_2`, `person_3` (not person_0)
   - Use `mainFaceId` for primary person filtering in gallery
   - `faceIds[]` array contains all detected faces in a photo
   - Face thumbnails show actual cropped faces from photos (not placeholders)

4. **Photo Metadata & Timestamps**:
   - Database auto-generates: `id`, `createdAt`, `updatedAt`
   - Manual fields: `driveId`, `mainFaceId`, `faceIds[]`, `faceBoxes[]`, `poseId`, `uploaderId`, `timestamp`
   - Timestamps displayed in gallery: `new Date(photo.timestamp).toLocaleDateString()`
   - Gallery filters by face (mainFaceId + faceIds) and pose

5. **Image Serving & Caching**:
   - All images: 1-year browser cache (`Cache-Control: public, max-age=31536000, immutable`)
   - Face crops: 120x120px @ 90% quality (optimized for retina displays)
   - Smart scaling for Drive-resized images
   - Direct streaming from Google Drive (no local storage)

6. **Client vs Server Face Detection**:
   - Prefer client-side detection to avoid Node.js TextEncoder issues
   - Server-side detection is a simplified hash-based fallback
   - Multi-model detection strategy: TinyFaceDetector (fast) + SSD MobileNet (accurate)
   - Face matching threshold: 0.45-0.55 Euclidean distance (adaptive based on sample count)

7. **Testing**:
   - 143 tests total (100% pass rate)
   - Repository tests: 79 tests (PhotoRepository, FaceRepository, ChallengeRepository)
   - Service tests: 64 tests (PhotoService, FaceService, UploadService, ChallengeService)
   - Use `jest-mock-extended` for Prisma mocking
   - Mock Google Drive operations in all tests
