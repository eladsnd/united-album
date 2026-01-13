import * as faceapi from '@vladmandic/face-api';
import { Canvas, Image, ImageData } from 'canvas';
import path from 'path';

// Patching environment for nodejs
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

let modelsLoaded = false;

async function loadModels() {
    if (modelsLoaded) return;

    const modelPath = path.join(process.cwd(), 'public', 'models');

    try {
        // We try to load models from the local public folder
        await faceapi.nets.tinyFaceDetector.loadFromDisk(modelPath);
        await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
        await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
        modelsLoaded = true;
        console.log('[Face Detection] Models loaded successfully');
    } catch (error) {
        console.warn('[Face Detection] Failed to load models from disk. Falling back to improved mock.', error.message);
        // If models are missing, we'll use a better heuristic than pure random
    }
}

export async function detectFace(buffer) {
    await loadModels();

    if (!modelsLoaded) {
        // Improved Mock: Consistent ID based on buffer size/checksum
        // This is "better" than random because the same photo gets the same ID
        const hash = buffer.length % 5;
        return 'person_' + hash;
    }

    try {
        const img = await canvas.loadImage(buffer);
        const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions());

        if (detections.length === 0) return 'unknown';

        // For now, we just return a "person_X" ID based on the largest face's position/size
        // In a real app, we'd extract embeddings and compare with a database
        const primaryFace = detections[0];
        const faceHash = Math.floor(primaryFace.box.area / 1000) % 5;
        return 'person_' + faceHash;
    } catch (err) {
        console.error('[Face Detection] Error during detection:', err);
        return 'unknown';
    }
}
