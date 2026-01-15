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

        // Process each detected face SEQUENTIALLY to avoid race conditions
        // CRITICAL: We must save each face descriptor immediately after matching
        // so the next face can match against it. Otherwise, all faces will match
        // against an empty database and all get assigned the same ID.
        const results = [];
        for (const detection of sortedDetections) {
            const descriptor = Array.from(detection.descriptor);
            const faceId = await matchFaceDescriptor(descriptor);
            const box = {
                x: Math.round(detection.detection.box.x),
                y: Math.round(detection.detection.box.y),
                width: Math.round(detection.detection.box.width),
                height: Math.round(detection.detection.box.height)
            };

            // Save descriptor immediately so next face can match against it
            try {
                await fetch('/api/faces', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        faceId,
                        descriptor,
                        box
                    })
                });
                console.log(`[Client Face Detection] Saved descriptor for ${faceId}`);
            } catch (error) {
                console.error(`[Client Face Detection] Failed to save descriptor for ${faceId}:`, error);
            }

            results.push({ descriptor, faceId, box });
        }

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
 * Calculate average descriptor from array of descriptors
 * @param {Array<number[]>} descriptors - Array of 128-dimensional face descriptors
 * @returns {number[]} - Average descriptor
 */
function calculateAverageDescriptor(descriptors) {
    if (!descriptors || descriptors.length === 0) return null;
    if (descriptors.length === 1) return descriptors[0];

    const descriptorLength = descriptors[0].length;
    const avgDescriptor = new Array(descriptorLength).fill(0);

    // Sum all descriptors
    for (const descriptor of descriptors) {
        for (let i = 0; i < descriptorLength; i++) {
            avgDescriptor[i] += descriptor[i];
        }
    }

    // Calculate average
    for (let i = 0; i < descriptorLength; i++) {
        avgDescriptor[i] /= descriptors.length;
    }

    return avgDescriptor;
}

/**
 * Match a face descriptor against known faces (with multi-descriptor averaging)
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

        let bestMatch = null;
        let bestDistance = Infinity;

        for (const known of knownFaces) {
            let distance;

            // Use average descriptor if multiple samples exist
            if (known.descriptors && known.descriptors.length > 0) {
                const avgDescriptor = calculateAverageDescriptor(known.descriptors);
                distance = faceapi.euclideanDistance(descriptor, avgDescriptor);
            } else {
                // Fallback to single descriptor
                distance = faceapi.euclideanDistance(descriptor, known.descriptor);
            }

            if (distance < bestDistance) {
                bestDistance = distance;
                bestMatch = known;
            }
        }

        // Adaptive thresholds based on sample count
        // Lower thresholds = stricter matching (less false positives)
        // Typical same-person distance: 0.2-0.3, different people: 0.4+
        let threshold;
        const sampleCount = bestMatch?.sampleCount || bestMatch?.descriptors?.length || 1;

        if (sampleCount <= 2) {
            // Very strict for few samples (avoid false positives)
            threshold = 0.30;
        } else if (sampleCount <= 4) {
            // Strict threshold for moderate samples
            threshold = 0.32;
        } else {
            // Still strict even with many samples
            threshold = 0.35;
        }

        if (bestMatch && bestDistance < threshold) {
            console.log(`[Client Face Detection] Matched to ${bestMatch.faceId} (distance: ${bestDistance.toFixed(3)}, threshold: ${threshold}, samples: ${sampleCount})`);
            return bestMatch.faceId;
        }

        // New face - assign next available ID
        const nextId = `person_${knownFaces.length}`;
        console.log(`[Client Face Detection] New face detected: ${nextId} (best distance: ${bestDistance.toFixed(3)}, threshold: ${threshold})`);
        return nextId;

    } catch (error) {
        console.error('[Client Face Detection] Error matching face:', error);
        // Fallback to hash-based ID
        const hash = descriptor.reduce((sum, val) => sum + val, 0) % 5;
        return `person_${Math.floor(hash)}`;
    }
}
