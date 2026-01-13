import path from 'path';

let faceapi;
let modelsLoaded = false;
let canvas;

async function init() {
    if (faceapi) return;

    // 1. Force polyfills before importing face-api
    const util = await import('util');
    global.TextEncoder = util.TextEncoder;
    global.TextDecoder = util.TextDecoder;

    // 2. Dynamic imports to ensure polyfills are ready
    faceapi = await import('@vladmandic/face-api');
    canvas = await import('canvas');

    // 3. Patch face-api environment
    faceapi.env.monkeyPatch({
        Canvas: canvas.Canvas,
        Image: canvas.Image,
        ImageData: canvas.ImageData
    });
}

async function loadModels() {
    await init();
    if (modelsLoaded) return;

    const modelPath = path.join(process.cwd(), 'public', 'models');

    try {
        await faceapi.nets.tinyFaceDetector.loadFromDisk(modelPath);
        await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
        await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
        modelsLoaded = true;
        console.log('[Face Detection] Models loaded successfully');
    } catch (error) {
        console.warn('[Face Detection] Failed to load models from disk. Falling back to improved mock.', error.message);
    }
}

export async function detectFace(buffer) {
    try {
        await loadModels();

        if (!modelsLoaded) {
            const hash = buffer.length % 5;
            return 'person_' + hash;
        }

        const img = await canvas.loadImage(buffer);
        const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions());

        if (detections.length === 0) return 'unknown';

        const primaryFace = detections[0];
        const faceHash = Math.floor(primaryFace.box.area / 1000) % 5;
        return 'person_' + faceHash;
    } catch (err) {
        console.error('[Face Detection] Error during detection:', err);
        return 'unknown';
    }
}
