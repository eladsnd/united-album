# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

United Album is a Next.js multi-tenant photo-sharing application for events (weddings, parties, corporate events). Features include pose challenges, AI face recognition, modular storage (Cloudinary/Google Drive), per-event feature flags, gamification, and client-side face detection.

**Multi-Tenancy**: The application supports multiple independent events with isolated data, separate admins, and per-event settings. Each event has its own photos, challenges, and feature configurations.

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
   - Photo uploads to storage (Cloudinary or Google Drive) via `lib/storage/operations.js`
   - Metadata (face IDs, bounding boxes, pose ID) saved to database via `lib/repositories/PhotoRepository.js`
   - Face descriptors saved to database via `lib/repositories/FaceRepository.js`
   - Timestamps automatically captured (`timestamp`, `createdAt`, `updatedAt`)

2. **Pose Challenge Management** (`app/api/admin/poses/route.js`):
   - Pose images uploaded via `uploadChallengeImage()` from `lib/storage/operations.js`
   - Challenge metadata stored in database via `lib/repositories/ChallengeRepository.js`
   - **IMPORTANT**: Store image URLs (not IDs) in database for provider compatibility
   - Organized folders: `united-album/challenges/`

3. **Face Detection Strategy**:
   - **Client-side** (preferred): `utils/clientFaceDetection.js` uses face-api.js with TinyFaceDetector and SSD MobileNet models
   - **Server-side** (fallback): `utils/faceDetection.js` provides hash-based face IDs
   - Multi-face support: detects all faces, identifies primary face by size
   - Face matching: 0.45 Euclidean distance threshold for recognition

4. **Storage Architecture** (MODULAR - Provider Agnostic):
   - **Abstraction Layer**: `lib/storage/` with Strategy Pattern
     - `StorageAdapter.js`: Base interface for all providers
     - `CloudinaryAdapter.js`: Cloudinary implementation (recommended)
     - `GoogleDriveAdapter.js`: Google Drive wrapper
     - `index.js`: Factory pattern - switches providers via STORAGE_PROVIDER env var
     - `operations.js`: High-level API (uploadPhoto, deletePhoto, uploadChallengeImage, etc.)

   - **Provider Switching**: Change ONE environment variable to switch storage:
     ```bash
     STORAGE_PROVIDER=cloudinary  # or 'drive'
     ```

   - **Storage Providers**:
     - **Cloudinary** (Recommended): 25GB free, no OAuth expiration, auto-optimization, CDN
     - **Google Drive**: 15GB free, OAuth expires, slower

   - **Folder Organization**:
     - Photos: `united-album/photos/`
     - Challenges: `united-album/challenges/`
     - Faces: `united-album/faces/`

   - **Database (Prisma + PostgreSQL/SQLite)**:
     - Photo metadata: driveId, mainFaceId, faceIds[], faceBoxes[], poseId, timestamp
     - Face descriptors: faceId, descriptor, metadata, photoCount
     - Challenge definitions: id, title, instruction, **image (URL not ID!)**, folderId

   - **Image URL Storage**:
     - Cloudinary: Store direct CDN URL (https://res.cloudinary.com/...)
     - Google Drive: Store proxy URL (/api/image/{driveId})
     - **Never store IDs directly** - always use URLs for compatibility

5. **Image Serving**:
   - Cloudinary: Direct CDN URLs with transformations (auto-quality, WebP, resizing)
   - Google Drive: Proxy API `/api/image/[id]/route.js`
   - Face thumbnails: `/api/face-crop/[driveId]/route.js` (120x120px crops)
   - 1-year browser cache (`Cache-Control: public, max-age=31536000, immutable`)

6. **Multi-Tenancy Architecture** (NEW):
   - **Event Isolation**: Each event has separate photos, challenges, settings, and admins
   - **User Roles**: SUPER_ADMIN (creates events), EVENT_ADMIN (manages assigned event), GUEST (uploads photos)
   - **Data Scoping**: All queries filter by `eventId` to ensure data isolation
   - **Event Model**: Stores event metadata (name, slug, dates, branding, status)
   - **EventAdmin Join Table**: Many-to-many relationship between users and events
   - **Per-Event Settings**: EventSettings model replaces global AppSettings for feature flags
   - **URL Structure**: Events accessed via slug (e.g., `/events/sarah-john-wedding-2026`)

7. **Feature Flags** (`lib/services/FeatureFlagService.js`):
   - **Per-Event Feature Flags**: EventSettings model (replaces global AppSettings)
   - Available flags: challenges, gamification, events, faceDetection, photoLikes, bulkUpload
   - Each event has independent feature toggles
   - Admin panel UI: `/admin/events/[eventId]` → Feature Flags tab
   - Client-side hook: `useFeatureFlags(eventId)` from `lib/hooks/useFeatureFlag.js`
   - Global settings in AppSettings: maintenanceMode, allowSelfRegistration
   - **Use Case**: Disable challenges for photo-sharing-only events

### Key Modules

**Storage Abstraction Layer** (NEW - Provider Agnostic):
- **`lib/storage/operations.js`**: High-level API your code uses
  - `uploadPhoto(buffer, fileName)` - Upload photo to configured provider
  - `uploadChallengeImage(buffer, fileName)` - Upload challenge image
  - `uploadFaceThumbnail(buffer, fileName)` - Upload face crop
  - `deletePhoto(fileId)` - Delete from any provider
  - `getPhotoUrl(fileId, options)` - Get URL with transformations
  - `getProviderName()` - Returns 'cloudinary' or 'google-drive'
- **`lib/storage/CloudinaryAdapter.js`**: Cloudinary implementation with auto-optimization
- **`lib/storage/GoogleDriveAdapter.js`**: Google Drive wrapper (legacy support)
- **`lib/config/storage.js`**: Configuration for optimizations (auto-quality, WebP, sizes)
- **`lib/middleware/downloadRateLimit.js`**: Bandwidth protection (rate limiting + batching)

**Data Access Layer (Repositories)**:
- **`lib/repositories/PhotoRepository.js`**: Photo metadata CRUD with JSON serialization for SQLite, event-scoped queries
- **`lib/repositories/FaceRepository.js`**: Face descriptor storage with multi-descriptor averaging
- **`lib/repositories/ChallengeRepository.js`**: Pose challenge CRUD operations, supports global and event-specific challenges
- **`lib/repositories/EventRepository.js`**: Event CRUD operations, slug-based lookups, active event queries
- **`lib/repositories/BaseRepository.js`**: Template Method pattern for consistent CRUD
- **`lib/repositories/AppSettingsRepository.js`**: Global app settings (singleton pattern)
- **`lib/repositories/UserScoreRepository.js`**: Gamification scores per user

**Business Logic Layer (Services)**:
- **`lib/services/PhotoService.js`**: Photo deletion with orphaned face cleanup, event-scoped operations
- **`lib/services/FaceService.js`**: Face detection metadata updates and thumbnail management
- **`lib/services/UploadService.js`**: Photo upload workflow - uses `uploadPhoto()` from storage operations
- **`lib/services/ChallengeService.js`**: Pose challenge CRUD - uses `uploadChallengeImage()`, **stores URLs not IDs**, handles global vs event-specific challenges
- **`lib/services/EventService.js`**: Event management, slug generation, event activation/archival, admin assignment
- **`lib/services/FeatureFlagService.js`**: Per-event feature flag management with caching and defensive defaults
- **`lib/services/GamificationService.js`**: Points, leaderboard, and challenge completion tracking
- **`lib/services/MetadataService.js`**: EXIF metadata extraction from photos (capture time, device info)

**API Layer (Decorators)**:
- **`lib/api/decorators.js`**: Composable middleware (withApi, withErrorHandler, withRateLimit, withAdminAuth)
- **`lib/api/featureDecorators.js`**: Feature flag checking middleware (withFeature)
- **`lib/api/errors.js`**: Custom error classes (ValidationError, NotFoundError, etc.)

**Infrastructure**:
- **`lib/googleDrive.js`**: Google Drive OAuth integration (still used by GoogleDriveAdapter)
- **`lib/rateLimit.js`**: In-memory rate limiting (10 requests/min for uploads, 30/min for admin)
- **`lib/prisma.js`**: Prisma client singleton for database operations

**Face Detection**:
- **`utils/clientFaceDetection.js`**: Browser-based face detection with dual-model strategy

**UI Components**:
- **`components/FaceGallery.js`**: Face-filtered photo gallery with infinite scroll
- **`components/UploadSection.js`**: Photo upload with client-side face detection
- **`components/AdminPoseManager.js`**: Admin panel for pose challenge management
- **`components/FeatureFlagPanel.js`**: Admin UI for toggling features
- **`components/Sidebar.js`**: Navigation with feature-flag-based menu filtering
- **`components/Leaderboard.js`**: Gamification leaderboard (respects feature flag)

**Custom Hooks**:
- **`lib/hooks/useFeatureFlag.js`**: React hook for feature flag checking (defensive, never crashes)

### Deprecated Modules (Do Not Use)

- **`lib/photoStorage.js`**: ⚠️ DEPRECATED - Use PhotoRepository instead
- **`lib/faceStorage.js`**: ⚠️ DEPRECATED - Use FaceRepository instead
- **Direct Google Drive imports**: ⚠️ Use `lib/storage/operations.js` instead

## Environment Setup

Required environment variables (see `.env.example`):

```bash
# Storage Provider (choose one)
STORAGE_PROVIDER=cloudinary  # or 'drive' (defaults to cloudinary)

# Cloudinary (Recommended - 25GB free, no OAuth expiration)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Google Drive (Legacy - 15GB free, OAuth expires)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_DRIVE_FOLDER_ID=...

# Required
ADMIN_PASSWORD=...

# Optional - Database (defaults to SQLite in development)
DATABASE_URL=...  # PostgreSQL connection string for production

# Optional - Face Detection
FACE_MATCH_THRESHOLD=0.50
FACE_MAX_SAMPLES=5

# Optional - Storage Optimizations
CLOUDINARY_AUTO_QUALITY=true
CLOUDINARY_AUTO_FORMAT=true
CLOUDINARY_FACE_DETECTION=false
```

## Testing Conventions

- Tests located in `__tests__/` directory
- Uses Jest with jsdom environment for unit tests
- Uses Playwright for end-to-end tests (`__tests__/e2e/`)
- Testing Library for React components
- Uses `jest-mock-extended` for Prisma mocking
- Test structure:
  - `__tests__/repositories/` - Repository layer tests
  - `__tests__/lib/services/` - Service layer tests
  - `__tests__/api/` - API endpoint integration tests
  - `__tests__/e2e/` - End-to-end Playwright tests
- **IMPORTANT**: Mock all storage operations in tests to avoid external API calls

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

   export const POST = withApi(handleRequest, {
     rateLimit: 'api',    // or 'upload', 'admin'
     adminOnly: false     // set true for admin-only endpoints
   });
   ```
3. Throw custom errors from `lib/api/errors.js` instead of returning error responses
4. Use repositories for database access, services for business logic
5. Use storage operations (`uploadPhoto`, `deletePhoto`) never direct Drive calls

### Uploading Files to Storage

**ALWAYS use storage operations, NEVER direct Drive/Cloudinary calls:**

```javascript
// ✅ CORRECT - Provider agnostic
import { uploadPhoto, deletePhoto, uploadChallengeImage } from '@/lib/storage/operations';

const result = await uploadPhoto(buffer, 'photo.jpg');
const { id, url } = result;  // id for DB, url for display

// Store URL in database (NOT ID!)
await prisma.photo.create({
  data: { image: result.url }  // ✅ URL works with both providers
});

// ❌ WRONG - Direct provider usage
import { uploadToDrive } from '@/lib/googleDrive';  // DON'T DO THIS
```

### Switching Storage Providers

Change ONE environment variable:
```bash
# Switch to Cloudinary
STORAGE_PROVIDER=cloudinary

# Switch back to Google Drive
STORAGE_PROVIDER=drive
```

No code changes needed! All services use the abstraction layer.

### Adding a New Database Model

1. Update `prisma/schema.prisma` with new model
2. Run `npx prisma generate` to update Prisma client
3. Run `npx prisma db push` (dev) or `npx prisma migrate dev` (production)
4. Create repository extending `BaseRepository`
5. Create service class for business logic using the repository
6. Write tests for both repository and service layers

### Adding a New Feature Flag

1. Add field to `EventSettings` model in `prisma/schema.prisma` (NOT AppSettings - that's global)
2. Update `FeatureFlagService.FEATURES` constant
3. Update service methods to handle new flag
4. Add toggle to `components/admin/FeatureFlagPanel.js`
5. Use in components: `const { flags } = useFeatureFlags(eventId); if (flags?.myFeature) { ... }`
6. Run `npx prisma db push` to update schema

### Working with Events (Multi-Tenancy)

1. **Creating an Event**:
   ```javascript
   import { EventService } from '@/lib/services/EventService';
   const event = await EventService.createEvent({
     name: 'Sarah & John Wedding',
     eventType: 'wedding',
     startTime: new Date('2026-06-15'),
     endTime: new Date('2026-06-16'),
     color: '#FF69B4'
   }); // Auto-generates slug: "sarah-john-wedding-2026"
   ```

2. **Querying Event Data**:
   ```javascript
   // ALWAYS filter by eventId for event-scoped data
   const photos = await PhotoRepository.findMany({
     where: { eventId: event.id }
   });

   // Get global challenges + event-specific challenges
   const challenges = await ChallengeRepository.findMany({
     where: { OR: [{ isGlobal: true }, { eventId: event.id }] }
   });
   ```

3. **Assigning Event Admins**:
   ```javascript
   await EventService.assignAdmin(eventId, userId, 'admin');
   // Creates EventAdmin join record
   ```

## Important Implementation Notes

1. **Multi-Tenancy Data Isolation** (CRITICAL):
   - **ALWAYS** filter queries by `eventId` when accessing event-scoped data
   - **Event-scoped models**: Photo, Challenge (if not global), EventSettings
   - **Global models**: Face, User, AppSettings, UserScore
   - **URL routing**: Events accessed via `/events/[slug]` not `/events/[id]`
   - **Slug format**: Auto-generated from event name (e.g., "Sarah & John Wedding" → "sarah-john-wedding-2026")
   - **Default event**: Use `eventId: "default-event"` for legacy single-event mode
   - **Cascade deletion**: Deleting an event cascades to photos, settings, challenges, admin assignments
   - **User roles**: Check `user.role` before allowing event creation (SUPER_ADMIN) or event management (EVENT_ADMIN)
   - **Admin assignment**: Use EventAdmin join table to assign users to events

2. **Storage Abstraction** (CRITICAL):
   - **ALWAYS** use `lib/storage/operations.js` for file operations
   - **NEVER** import `googleDrive.js` or Cloudinary SDK directly in services
   - **Store URLs** in database (not IDs) - works with both providers
   - Provider switching via STORAGE_PROVIDER env var only
   - Cloudinary signature requires **alphabetically sorted params**

3. **Image URL Storage** (CRITICAL for Provider Compatibility):
   - **Cloudinary**: Returns direct CDN URL (https://res.cloudinary.com/...)
   - **Google Drive**: Returns proxy URL (/api/image/{driveId})
   - **Always store `uploadResult.url`** in database, NOT `uploadResult.id`
   - This ensures images load correctly regardless of active provider

4. **Feature Flags**:
   - All feature checks should be defensive (never crash)
   - Use `useFeatureFlags()` hook in components
   - Use `FeatureFlagService.isEnabledSafe()` in server code
   - Feature flag panel at `/admin` → Feature Flags
   - Challenges can be disabled for photo-sharing-only events

5. **Architecture Patterns** (Repository + Service + Decorator):
   - **Repositories**: Handle all database operations
   - **Services**: Contain business logic and orchestrate workflows
   - **Decorators**: Composable middleware for cross-cutting concerns
   - **Storage Operations**: High-level API for file operations

6. **Face IDs**:
   - Human-friendly numbering: `person_1`, `person_2`, `person_3` (not person_0)
   - Use `mainFaceId` for primary person filtering in gallery
   - `faceIds[]` array contains all detected faces in a photo
   - **IMPORTANT**: Faces are shared across events (global recognition)

7. **Photo Metadata & Timestamps**:
   - Database auto-generates: `id`, `createdAt`, `updatedAt`
   - **REQUIRED**: `eventId` (for multi-tenancy data isolation)
   - Manual fields: `driveId`, `url`, `mainFaceId`, `faceIds[]`, `faceBoxes[]`, `poseId`, `uploaderId`, `timestamp`
   - EXIF metadata: `capturedAt`, `deviceMake`, `deviceModel` (extracted by MetadataService)
   - Gallery filters by event, face (mainFaceId + faceIds), and pose

8. **Image Serving & Caching**:
   - Cloudinary: Direct CDN URLs with transformations (auto-quality, WebP, etc.)
   - Google Drive: Proxy through `/api/image/[id]`
   - 1-year browser cache for all images
   - Face crops: 120x120px @ 90% quality

9. **Client vs Server Face Detection**:
   - Prefer client-side detection to avoid Node.js TextEncoder issues
   - Multi-model detection strategy: TinyFaceDetector (fast) + SSD MobileNet (accurate)
   - Face matching threshold: 0.45-0.55 Euclidean distance

10. **Database Schema (Prisma)**:
   - **Multi-tenancy models**: User, Event, EventAdmin, EventSettings
   - **Photo model**: Includes `eventId` for data isolation, JSON fields (faceIds, faceBoxes) for SQLite/PostgreSQL compatibility
   - **Face model**: Global across events, rolling window of face descriptors
   - **Challenge model**: Supports global (`isGlobal: true`) and event-specific challenges, stores image **URLs** (not IDs!)
   - **EventSettings model**: Per-event feature flags (replaces global AppSettings)
   - **AppSettings model**: Global app settings (singleton pattern with id="app_settings")
   - **UserRole enum**: SUPER_ADMIN, EVENT_ADMIN, GUEST
   - After schema changes: `npx prisma generate` then `npx prisma db push`

11. **Error Messages**:
    - Use provider-agnostic messages ("Failed to upload image" NOT "Failed to upload to Google Drive")
    - Users should never see implementation details about storage provider

## Deployment Notes

**Production Environment (Vercel)**:
- Database: PostgreSQL (Vercel Postgres)
- Storage: Cloudinary (recommended) or Google Drive
- Schema deployment: Uses `prisma db push` instead of migrations
- Environment variables: Set in Vercel dashboard
- Face detection models: Must be in `public/models/` (committed to git)

**Build Process**:
- Build command: `prisma generate` → `prisma db push` → `next build`
- Uses `DATABASE_URL` env var or defaults to `file:./dev.db` (SQLite) for local dev
- `--accept-data-loss` flag used in `prisma db push` (safe for schema-first deployments)

## Documentation Files

Storage abstraction documentation (created recently):
- `CLOUDINARY_SETUP.md` - 5-minute Cloudinary setup guide
- `MIGRATION_GUIDE.md` - Code migration from Drive to abstraction
- `OPTIMIZATION_GUIDE.md` - Cloudinary features and bandwidth optimization
- `IMPLEMENTATION_COMPLETE.md` - Storage migration summary
- `lib/storage/README.md` - Technical API documentation
- `scripts/getGoogleRefreshToken.js` - OAuth token helper for Google Drive
