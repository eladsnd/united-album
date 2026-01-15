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
   - Metadata (including face IDs, bounding boxes, pose ID) saved to `data/photos.json` via `lib/photoStorage.js`
   - Face descriptors optionally saved to `data/faces.json` via `lib/faceStorage.js`

2. **Face Detection Strategy**:
   - **Client-side** (preferred): `utils/clientFaceDetection.js` uses face-api.js with TinyFaceDetector and SSD MobileNet models
   - **Server-side** (fallback): `utils/faceDetection.js` provides hash-based face IDs (temporary workaround for TextEncoder issues)
   - Multi-face support: detects all faces, identifies primary face by size
   - Face matching: 0.45 Euclidean distance threshold for recognition

3. **Storage Architecture**:
   - **Google Drive**: Image file storage via OAuth 2.0
   - **Local JSON files**:
     - `data/photos.json`: Photo metadata (driveId, mainFaceId, faceIds[], faceBoxes[], poseId, timestamp)
     - `data/faces.json`: Face descriptors for recognition (faceId, descriptor, metadata, photoCount)
     - `data/challenges.json`: Pose challenge definitions

4. **Image Serving**:
   - Photos accessed through proxy API: `/api/image/[id]/route.js`
   - Face thumbnails dynamically cropped: `/api/face-crop/[driveId]/route.js`
   - Uses Google Drive API file streams

### Key Modules

- **`lib/googleDrive.js`**: Google Drive OAuth integration (upload, list, stream files)
- **`lib/photoStorage.js`**: JSON-based photo metadata persistence with deduplication by driveId
- **`lib/faceStorage.js`**: Face descriptor storage and matching
- **`utils/clientFaceDetection.js`**: Browser-based face detection with dual-model strategy
- **`components/FaceGallery.js`**: Face-filtered photo gallery with scrollable face selector
- **`components/UploadSection.js`**: Photo upload with client-side face detection

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

1. **Face IDs**:
   - Use `mainFaceId` for primary person filtering
   - `faceIds[]` array contains all detected faces in a photo
   - Format: `person_0`, `person_1`, etc.

2. **Google Drive Integration**:
   - Files set to public (anyone with link) after upload
   - Proxy URLs used instead of direct Drive links for Next.js Image optimization

3. **Photo Metadata**:
   - Always deduplicate by `driveId` when saving
   - Include `faceBoxes` array for dynamic cropping
   - Timestamp in ISO format

4. **Client vs Server Face Detection**:
   - Prefer client-side detection to avoid Node.js TextEncoder issues
   - Server-side detection is a simplified hash-based fallback
   - Multi-model detection strategy improves face detection rate
