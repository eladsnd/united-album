/**
 * Face Recognition Integration Test
 *
 * Tests the complete face recognition pipeline:
 * 1. Detect 7 faces in group photo
 * 2. Extract face descriptors
 * 3. Match against individual cropped faces
 * 4. Verify 7 unique people are identified
 * 5. Test photo count accuracy
 */

import * as faceapi from 'face-api.js';
import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import fs from 'fs';

// Polyfill for face-api.js in Node environment
const { Canvas, Image, ImageData } = require('canvas');
global.HTMLCanvasElement = Canvas;
global.HTMLImageElement = Image;
global.ImageData = ImageData;

describe('Face Recognition Integration Tests', () => {
    const FIXTURES_DIR = path.join(__dirname, 'fixtures/face-recognition');
    const GROUP_PHOTO = path.join(FIXTURES_DIR, 'group-photo-7-people.jpg');
    const INDIVIDUAL_FACES = Array.from({ length: 7 }, (_, i) =>
        path.join(FIXTURES_DIR, `person-${i + 1}-face.png`)
    );

    let modelsLoaded = false;

    beforeAll(async () => {
        // Load face-api.js models
        const MODEL_URL = path.join(__dirname, '../public/models');

        console.log('[Test] Loading face detection models...');
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_URL),
            faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_URL)
        ]);

        modelsLoaded = true;
        console.log('[Test] ✓ Models loaded successfully');
    }, 30000); // 30 second timeout for model loading

    test('should load all test fixtures', () => {
        expect(fs.existsSync(GROUP_PHOTO)).toBe(true);
        INDIVIDUAL_FACES.forEach((facePath, i) => {
            expect(fs.existsSync(facePath)).toBe(true);
        });
    });

    test('should detect 7 faces in group photo', async () => {
        expect(modelsLoaded).toBe(true);

        const img = await loadImage(GROUP_PHOTO);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        console.log('[Test] Detecting faces in group photo...');
        const detections = await faceapi
            .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();

        console.log(`[Test] ✓ Detected ${detections.length} faces`);

        expect(detections).toBeDefined();
        expect(detections.length).toBe(7);
    }, 30000);

    test('should extract descriptors from all 7 detected faces', async () => {
        expect(modelsLoaded).toBe(true);

        const img = await loadImage(GROUP_PHOTO);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const detections = await faceapi
            .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();

        expect(detections.length).toBe(7);

        detections.forEach((detection, i) => {
            expect(detection.descriptor).toBeDefined();
            expect(detection.descriptor.length).toBe(128);
            console.log(`[Test] ✓ Person ${i + 1}: Descriptor length = ${detection.descriptor.length}`);
        });
    }, 30000);

    test('should extract bounding boxes for all faces', async () => {
        expect(modelsLoaded).toBe(true);

        const img = await loadImage(GROUP_PHOTO);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const detections = await faceapi
            .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();

        expect(detections.length).toBe(7);

        detections.forEach((detection, i) => {
            const box = detection.detection.box;
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.y).toBeGreaterThanOrEqual(0);
            expect(box.width).toBeGreaterThan(0);
            expect(box.height).toBeGreaterThan(0);

            console.log(`[Test] ✓ Person ${i + 1}: Box = {x: ${Math.round(box.x)}, y: ${Math.round(box.y)}, w: ${Math.round(box.width)}, h: ${Math.round(box.height)}}`);
        });
    }, 30000);

    test('should identify 7 unique people (no duplicate matches)', async () => {
        expect(modelsLoaded).toBe(true);

        const img = await loadImage(GROUP_PHOTO);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const detections = await faceapi
            .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();

        expect(detections.length).toBe(7);

        // Simulate matching logic
        const THRESHOLD = 0.35; // Same as our client-side threshold
        const knownFaces = [];
        const assignedIds = [];

        for (let i = 0; i < detections.length; i++) {
            const descriptor = Array.from(detections[i].descriptor);

            // Try to match against known faces
            let matched = false;
            for (let j = 0; j < knownFaces.length; j++) {
                const distance = faceapi.euclideanDistance(descriptor, knownFaces[j]);
                if (distance < THRESHOLD) {
                    assignedIds.push(`person_${j}`);
                    matched = true;
                    console.log(`[Test] ✓ Face ${i + 1} matched to person_${j} (distance: ${distance.toFixed(3)})`);
                    break;
                }
            }

            if (!matched) {
                // New person
                const newId = `person_${knownFaces.length}`;
                knownFaces.push(descriptor);
                assignedIds.push(newId);
                console.log(`[Test] ✓ Face ${i + 1} is NEW person: ${newId}`);
            }
        }

        // Verify all 7 people got unique IDs
        const uniqueIds = new Set(assignedIds);
        console.log(`[Test] Unique people identified: ${uniqueIds.size} (expected 7)`);
        console.log(`[Test] IDs assigned: ${assignedIds.join(', ')}`);

        expect(uniqueIds.size).toBe(7);
        expect(assignedIds.length).toBe(7);
    }, 30000);

    test('should match cropped faces to faces in group photo', async () => {
        expect(modelsLoaded).toBe(true);

        // Load group photo
        const groupImg = await loadImage(GROUP_PHOTO);
        const groupCanvas = createCanvas(groupImg.width, groupImg.height);
        const groupCtx = groupCanvas.getContext('2d');
        groupCtx.drawImage(groupImg, 0, 0);

        // Detect faces in group photo
        const groupDetections = await faceapi
            .detectAllFaces(groupCanvas, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();

        expect(groupDetections.length).toBe(7);

        // Extract descriptors from individual cropped faces
        const croppedDescriptors = [];
        for (let i = 0; i < INDIVIDUAL_FACES.length; i++) {
            const faceImg = await loadImage(INDIVIDUAL_FACES[i]);
            const faceCanvas = createCanvas(faceImg.width, faceImg.height);
            const faceCtx = faceCanvas.getContext('2d');
            faceCtx.drawImage(faceImg, 0, 0);

            const detection = await faceapi
                .detectSingleFace(faceCanvas, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (detection) {
                croppedDescriptors.push({
                    personNum: i + 1,
                    descriptor: Array.from(detection.descriptor)
                });
                console.log(`[Test] ✓ Extracted descriptor from person-${i + 1}-face.png`);
            }
        }

        expect(croppedDescriptors.length).toBeGreaterThan(0);

        // Match each cropped face to a face in the group photo
        const MATCH_THRESHOLD = 0.4; // Slightly more lenient for cropped vs full photo
        let matchCount = 0;

        croppedDescriptors.forEach(cropped => {
            let bestMatch = null;
            let bestDistance = Infinity;

            groupDetections.forEach((groupFace, idx) => {
                const distance = faceapi.euclideanDistance(
                    cropped.descriptor,
                    Array.from(groupFace.descriptor)
                );

                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestMatch = idx;
                }
            });

            if (bestDistance < MATCH_THRESHOLD) {
                matchCount++;
                console.log(`[Test] ✓ person-${cropped.personNum}-face.png matched to face #${bestMatch + 1} in group (distance: ${bestDistance.toFixed(3)})`);
            } else {
                console.log(`[Test] ✗ person-${cropped.personNum}-face.png NO MATCH (best distance: ${bestDistance.toFixed(3)})`);
            }
        });

        console.log(`[Test] Successfully matched ${matchCount}/${croppedDescriptors.length} cropped faces to group photo`);

        // At least 50% should match (some crops might be from different photos)
        expect(matchCount).toBeGreaterThan(croppedDescriptors.length * 0.5);
    }, 60000);

    test('should sort faces by size and identify main face', async () => {
        expect(modelsLoaded).toBe(true);

        const img = await loadImage(GROUP_PHOTO);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const detections = await faceapi
            .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();

        expect(detections.length).toBe(7);

        // Sort by face size (area)
        const sorted = detections.sort((a, b) => {
            const areaA = a.detection.box.width * a.detection.box.height;
            const areaB = b.detection.box.width * b.detection.box.height;
            return areaB - areaA; // Largest first
        });

        const mainFace = sorted[0];
        const mainArea = mainFace.detection.box.width * mainFace.detection.box.height;

        console.log(`[Test] ✓ Main face: ${Math.round(mainArea)} px² (largest)`);
        console.log(`[Test] ✓ All face sizes: ${sorted.map(d =>
            Math.round(d.detection.box.width * d.detection.box.height)
        ).join(', ')} px²`);

        // Verify sorting worked
        for (let i = 0; i < sorted.length - 1; i++) {
            const currArea = sorted[i].detection.box.width * sorted[i].detection.box.height;
            const nextArea = sorted[i + 1].detection.box.width * sorted[i + 1].detection.box.height;
            expect(currArea).toBeGreaterThanOrEqual(nextArea);
        }
    }, 30000);
});
