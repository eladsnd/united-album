import fs from 'fs';
import path from 'path';

const FACES_FILE = path.join(process.cwd(), 'data', 'faces.json');

// Ensure data directory exists
function ensureDataDir() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

// Load known faces
function loadFaces() {
    ensureDataDir();

    if (!fs.existsSync(FACES_FILE)) {
        return [];
    }

    try {
        const data = fs.readFileSync(FACES_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('[Face Storage] Error loading faces:', error);
        return [];
    }
}

// Save or update a face descriptor
export function saveFaceDescriptor(faceId, descriptor, metadata = {}) {
    ensureDataDir();

    const faces = loadFaces();

    // Check if face already exists
    const existingIndex = faces.findIndex(f => f.faceId === faceId);

    const faceData = {
        faceId,
        descriptor,
        metadata,
        lastSeen: new Date().toISOString(),
        photoCount: existingIndex >= 0 ? faces[existingIndex].photoCount + 1 : 1
    };

    if (existingIndex !== -1) {
        faces[existingIndex] = faceData;
        console.log(`[Face Storage] Updated face: ${faceId}`);
    } else {
        faces.push(faceData);
        console.log(`[Face Storage] Added new face: ${faceId}`);
    }

    fs.writeFileSync(FACES_FILE, JSON.stringify(faces, null, 2));
    return faceData;
}

// Get all known faces
export function getAllFaces() {
    return loadFaces();
}

// Get a specific face by ID
export function getFaceById(faceId) {
    const faces = loadFaces();
    return faces.find(f => f.faceId === faceId);
}

// Delete a face
export function deleteFace(faceId) {
    const faces = loadFaces();
    const filtered = faces.filter(f => f.faceId !== faceId);

    if (filtered.length < faces.length) {
        fs.writeFileSync(FACES_FILE, JSON.stringify(filtered, null, 2));
        console.log(`[Face Storage] Deleted face: ${faceId}`);
        return true;
    }

    return false;
}
