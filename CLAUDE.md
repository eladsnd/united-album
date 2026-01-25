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
npm run test:coverage    # Generate test coverage report
npm run test:api         # Run API tests only (__tests__/api)
npm run test:e2e         # Run Playwright end-to-end tests
npm run test:e2e:ui      # Run Playwright tests with UI
npm run test:all         # Run all tests (Jest + Playwright)

# Run specific test file
npm test -- PhotoRepository.test.js
npm test -- lib/services/PhotoService.test.js

# Database
npx prisma generate      # Regenerate Prisma client after schema changes
npx prisma db push       # Push schema changes to database (development)
npx prisma migrate dev   # Create and apply migration (development)
npx prisma studio        # Open Prisma Studio database GUI (localhost:5555)

# Utilities
node scripts/seedProduction.js  # Seed database with initial pose challenges
node scripts/resetTestData.js   # Reset test data
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
- **`data/photos.json`** and **`data/faces.json`**: ⚠️ LEGACY - JSON file storage replaced by Prisma database. These files may exist for backward compatibility but all new code uses the database via repositories.

### UI Structure

- **Sidebar navigation**: Challenge view, Gallery, Mobile QR access
- **3D Carousel**: Pose challenges with prev/active/next visible items
- **Face Gallery**: Filter by person (mainFaceId) or pose, with face thumbnail scrolling

## Environment Setup

Required environment variables (see `.env.example`):
```bash
# Required
GOOGLE_CLIENT_ID=         # From Google Cloud Console
GOOGLE_CLIENT_SECRET=     # From Google Cloud Console
GOOGLE_REFRESH_TOKEN=     # OAuth refresh token
GOOGLE_DRIVE_FOLDER_ID=   # Default upload folder
ADMIN_PASSWORD=           # Admin panel password

# Optional - Database (defaults to SQLite in development)
DATABASE_URL=             # PostgreSQL connection string for production (Vercel Postgres)

# Optional - Face Detection
FACE_MATCH_THRESHOLD=0.50 # Face matching sensitivity (0.45-0.55 range)
FACE_MAX_SAMPLES=5        # Max face descriptors to store per person
```

**Important Notes**:
- Upload API returns 401 if OAuth credentials are missing
- Copy `.env.example` to `.env.local` and fill in your values
- `.env.local` is gitignored and will not be committed

## Testing Conventions

- Tests located in `__tests__/` directory
- Uses Jest with jsdom environment for unit tests
- Uses Playwright for end-to-end tests (`__tests__/e2e/`)
- Testing Library for React components
- Uses `jest-mock-extended` for Prisma mocking in repository/service tests
- Test structure:
  - `__tests__/repositories/` - Repository layer tests (BaseRepository, PhotoRepository, FaceRepository, ChallengeRepository)
  - `__tests__/lib/services/` - Service layer tests (PhotoService, FaceService, UploadService, ChallengeService)
  - `__tests__/api/` - API endpoint integration tests
  - `__tests__/e2e/` - End-to-end Playwright tests
- Run specific test: `npm test -- <test-file-name>` (e.g., `npm test -- PhotoRepository.test.js`)
- All Google Drive operations should be mocked in tests to avoid external API calls

## Face Detection Models

Client-side face detection requires model files in `public/models/`:
- `tiny_face_detector_model-*` (primary, fast)
- `ssd_mobilenetv1_model-*` (fallback, better for small faces)
- `face_landmark_68_model-*` (landmarks)
- `face_recognition_model-*` (128D descriptors)

## Common Development Workflows

### Adding a New API Endpoint

1. Create handler function with business logic only
2. Use `withApi` decorator for cross-cutting concerns:
   ```javascript
   import { withApi } from '@/lib/api/decorators';

   async function handleRequest(request) {
     // Your business logic here
     return NextResponse.json({ data: 'response' });
   }

   // Apply decorators
   export const POST = withApi(handleRequest, {
     rateLimit: 'api',    // or 'upload', 'admin'
     adminOnly: false     // set true for admin-only endpoints
   });
   ```
3. Throw custom errors from `lib/api/errors.js` instead of returning error responses
4. Use repositories for database access, services for business logic

### Adding a New Database Model

1. Update `prisma/schema.prisma` with new model
2. Run `npx prisma generate` to update Prisma client
3. Run `npx prisma db push` (dev) or `npx prisma migrate dev` (production)
4. Create repository extending `BaseRepository`:
   ```javascript
   export class MyRepository extends BaseRepository {
     getModel() { return 'myModel'; }
     serialize(data) { /* JSON.stringify arrays */ }
     deserialize(record) { /* JSON.parse arrays */ }
   }
   ```
5. Create service class for business logic using the repository
6. Write tests for both repository and service layers

### Modifying Face Detection Logic

- Client-side detection: Edit `utils/clientFaceDetection.js`
- Face matching threshold: Adjust `FACE_MATCH_THRESHOLD` in `.env.local`
- Face descriptor storage: Modify `lib/repositories/FaceRepository.js`
- Face matching algorithm: Update `lib/services/FaceService.js`

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

7. **Database Schema (Prisma)**:
   - **Photo model**: Stores photo metadata with JSON fields (faceIds, faceBoxes) for SQLite/PostgreSQL compatibility
   - **Face model**: Stores face descriptors and metadata with rolling window of samples
   - **Challenge model**: Stores pose challenge definitions with order field for sorting
   - **PhotoLike model**: Stores photo likes with cascade delete on photo deletion
   - After schema changes: Run `npx prisma generate` then `npx prisma db push` (dev) or `npx prisma migrate dev` (production-ready)
   - Use `npx prisma studio` to inspect database visually

8. **Testing**:
   - Repository tests: PhotoRepository, FaceRepository, ChallengeRepository, BaseRepository
   - Service tests: PhotoService, FaceService, UploadService, ChallengeService
   - API tests: All API endpoints have integration tests
   - E2E tests: Playwright tests for critical user flows
   - Use `jest-mock-extended` for Prisma mocking
   - Mock Google Drive operations in all tests to avoid external API calls

## Deployment Notes

**Production Environment (Vercel)**:
- Database: PostgreSQL (Vercel Postgres) - automatically provisioned
- Schema deployment: Uses `prisma db push` instead of migrations (see `package.json` build script)
- Environment variables: Set all `.env.local` variables in Vercel dashboard
- Google Drive folder structure persists across deployments (not ephemeral)
- Face detection models must be in `public/models/` (committed to git)

**First-Time Production Setup**:
1. Deploy to Vercel from GitHub
2. Add Vercel Postgres addon
3. Set environment variables (Google OAuth, Drive folder ID, admin password)
4. Run `node scripts/seedProduction.js` to populate initial pose challenges
5. Verify Google Drive OAuth token hasn't expired (regenerate if needed)

**Build Process**:
- Build command runs: `prisma generate` → `prisma db push` → `next build`
- Uses `DATABASE_URL` env var or defaults to `file:./dev.db` (SQLite) for local dev
- `--accept-data-loss` flag used in `prisma db push` (safe for schema-first deployments)
