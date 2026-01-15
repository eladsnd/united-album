# Face Recognition Test Fixtures

This directory contains test images for comprehensive face recognition testing.

## Test Files

### Group Photo
- **`group-photo-7-people.jpg`** - Photo containing 7 different people
- Used to test multi-face detection capability

### Individual Face Crops
- **`person-1-face.png`** through **`person-7-face.png`** - Cropped face images
- Each contains a single person's face
- Used to test face matching against the group photo

## Test Suites

### Fast Sequential Processing Test (Recommended for CI)
Validates the fix for the race condition bug without running ML models:

```bash
npm test -- faceRecognition.sequential.test.js  # ~4 seconds
```

This test verifies:
- ✅ 7 faces get 7 unique person IDs (sequential processing)
- ✅ Demonstrates the bug when processed in parallel
- ✅ Fast enough for CI/CD pipelines

### Full Integration Test (CPU-based, Slow)
Runs actual face detection ML models:

```bash
npm test -- faceRecognition.integration.test.js  # ~2-3 minutes on CPU
```

## What the Tests Verify

1. **Face Detection** - Detects all 7 faces in the group photo
2. **Descriptor Extraction** - Extracts 128-dimensional descriptors from each face
3. **Bounding Box Accuracy** - Validates face location coordinates
4. **Unique Person Identification** - Ensures 7 different people get unique IDs (person_0 through person_6)
5. **No False Matches** - Verifies threshold prevents different people from matching
6. **Face Cropping** - Tests cropped faces match their counterparts in group photo
7. **Size Sorting** - Validates main face identification (largest face first)

## Expected Results

- ✅ 7 faces detected in group photo
- ✅ 7 unique person IDs assigned
- ✅ Each face has valid bounding box
- ✅ Each face has 128-dimensional descriptor
- ✅ Cropped faces match group photo faces (with 0.4 threshold)
- ✅ Faces sorted by size (largest = main face)

## Matching Thresholds

- **Same person**: ~0.2-0.3 Euclidean distance
- **Different people**: ~0.4+ Euclidean distance
- **Test threshold**: 0.35 (strict, prevents false positives)
- **Crop match threshold**: 0.4 (slightly relaxed for cropped vs full photo)

## Manual Browser Testing (FAST - Recommended)

Since face detection is much faster in the browser (uses WebGL/GPU), the best way to test is manually:

1. **Start the dev server**:
   ```bash
   npm run dev
   ```

2. **Upload the group photo** (`group-photo-7-people.jpg`):
   - Go to http://localhost:3000
   - Upload the group photo
   - Check browser console for face detection logs

3. **Verify results**:
   - Should detect **7 faces**
   - Console should show: `[Client Face Detection] Detected 7 face(s)`
   - Should assign **7 unique IDs**: `person_0` through `person_6`
   - Gallery should show 7 face thumbnails with actual cropped faces
   - Each thumbnail should show count of `1`
   - Clicking any face should show the same photo (all 7 are in it)

4. **Check data files**:
   ```bash
   cat data/photos.json
   cat data/faces.json
   ```

   - `photos.json` should have `faceIds: ["person_0", "person_1", ... "person_6"]`
   - `faces.json` should have 7 unique face entries
   - Each face should have descriptors array length = 128

## Automated Testing (SLOW - CI only)

The Node.js integration tests are very slow because they use CPU instead of GPU.

Run automated tests with:
```bash
# Fast: Just validates fixtures exist
npm test -- faceRecognition.fixtures.test.js

# Slow: Full ML face detection (~2-3 minutes)
npm test -- faceRecognition.integration.test.js
```

For faster automated testing, install TensorFlow Node backend:
```bash
npm install @tensorflow/tfjs-node
```

This will use native TensorFlow C++ bindings (still slower than browser WebGL).
