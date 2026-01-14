/**
 * Client-side face detection utility using face-api.js
 * Runs in the browser to avoid server-side TextEncoder issues
 */

import * as faceapi from 'face-api.js';

let modelsLoaded = false;

/**
 * Load face-api.js models from public directory
 */
export async function loadFaceModels() {
    if (modelsLoaded) return true;

    try {
        const MODEL_URL = '/models';

        // Load all required models
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL), // Add SSD MobileNet
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);

        modelsLoaded = true;
        console.log('[Client Face Detection] Models loaded successfully');
        return true;
    } catch (error) {
        console.error('[Client Face Detection] Failed to load models:', error);
        return false;
    }
}

/**
 * Extract face descriptor from an image file
 * @param {File} imageFile - The image file to analyze
 * @returns {Promise<{descriptors: Array, faceIds: Array<string>, mainFaceId: string, boxes: Array}>}
 */
export async function detectFaceInBrowser(imageFile) {
    try {
        // Ensure models are loaded
        const loaded = await loadFaceModels();
        if (!loaded) {
            throw new Error('Face detection models not loaded');
        }

        // Create image element from file
        const img = await faceapi.bufferToImage(imageFile);

        // Try multiple detection strategies for better results
        let detections = null;

        // Strategy 1: TinyFaceDetector (fast, good for clear faces)
        console.log('[Client Face Detection] Trying TinyFaceDetector...');
        detections = await faceapi
            .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptors();

        // Strategy 2: If no faces found, try SSD MobileNet (better for small/distant faces)
        if (!detections || detections.length === 0) {
            console.log('[Client Face Detection] No faces with Tiny, trying SSD MobileNet...');
            detections = await faceapi
                .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                .withFaceLandmarks()
                .withFaceDescriptors();
        }

        if (!detections || detections.length === 0) {
            console.log('[Client Face Detection] No faces detected with any model');
            return { descriptors: [], faceIds: ['unknown'], mainFaceId: 'unknown', boxes: [] };
        }

        console.log(`[Client Face Detection] Detected ${detections.length} face(s)`);

        // Sort faces by size (area) to identify the main/primary face
        const sortedDetections = detections.sort((a, b) => {
            const areaA = a.detection.box.width * a.detection.box.height;
            const areaB = b.detection.box.width * b.detection.box.height;
            return areaB - areaA; // Largest first
        });

        // Process each detected face
        const results = await Promise.all(
            sortedDetections.map(async (detection) => {
                const descriptor = Array.from(detection.descriptor);
                const faceId = await matchFaceDescriptor(descriptor);
                const box = {
                    x: Math.round(detection.detection.box.x),
                    y: Math.round(detection.detection.box.y),
                    width: Math.round(detection.detection.box.width),
                    height: Math.round(detection.detection.box.height)
                };
                return { descriptor, faceId, box };
            })
        );

        const descriptors = results.map(r => r.descriptor);
        const faceIds = results.map(r => r.faceId);
        const boxes = results.map(r => r.box);
        const mainFaceId = faceIds[0]; // Largest face is the main face

        console.log(`[Client Face Detection] Main face: ${mainFaceId}, All faces: ${faceIds.join(', ')}`);
        return { descriptors, faceIds, mainFaceId, boxes };

    } catch (error) {
        console.error('[Client Face Detection] Error:', error);
        return { descriptors: [], faceIds: ['unknown'], mainFaceId: 'unknown', boxes: [] };
    }
}

/**
 * Match a face descriptor against known faces
 * @param {number[]} descriptor - 128-dimensional face descriptor
 * @returns {Promise<string>} - Face ID (person_0, person_1, etc.)
 */
async function matchFaceDescriptor(descriptor) {
    try {
        // Fetch known faces from server
        const response = await fetch('/api/faces');
        const knownFaces = await response.json();

        if (knownFaces.length === 0) {
            // First face - assign person_0
            return 'person_0';
        }

        // Calculate Euclidean distance to each known face
        const MATCH_THRESHOLD = 0.45; // Stricter matching (was 0.6)
        let bestMatch = null;
        let bestDistance = Infinity;

        for (const known of knownFaces) {
            const distance = faceapi.euclideanDistance(descriptor, known.descriptor);

            if (distance < bestDistance) {
                bestDistance = distance;
                bestMatch = known;
            }
        }

        if (bestMatch && bestDistance < MATCH_THRESHOLD) {
            console.log(`[Client Face Detection] Matched to ${bestMatch.faceId} (distance: ${bestDistance.toFixed(3)})`);
            return bestMatch.faceId;
        }

        // New face - assign next available ID
        const nextId = `person_${knownFaces.length}`;
        console.log(`[Client Face Detection] New face detected: ${nextId} (best distance: ${bestDistance.toFixed(3)})`);
        return nextId;

    } catch (error) {
        console.error('[Client Face Detection] Error matching face:', error);
        // Fallback to hash-based ID
        const hash = descriptor.reduce((sum, val) => sum + val, 0) % 5;
        return `person_${Math.floor(hash)}`;
    }
}
