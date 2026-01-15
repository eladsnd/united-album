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

// Calculate average descriptor from array of descriptors
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

// Save or update a face descriptor (stores multiple samples per person)
export function saveFaceDescriptor(faceId, descriptor, metadata = {}) {
    ensureDataDir();

    const faces = loadFaces();

    // Check if face already exists
    const existingIndex = faces.findIndex(f => f.faceId === faceId);

    if (existingIndex !== -1) {
        // Update existing face - append new descriptor
        const existingFace = faces[existingIndex];

        // Ensure descriptors is an array
        const descriptors = Array.isArray(existingFace.descriptors)
            ? existingFace.descriptors
            : [existingFace.descriptor || descriptor].filter(Boolean);

        // Add new descriptor (max 5 samples)
        descriptors.push(descriptor);
        if (descriptors.length > 5) {
            descriptors.shift(); // Remove oldest sample
        }

        const faceData = {
            faceId,
            descriptors, // Store array of descriptors
            descriptor: calculateAverageDescriptor(descriptors), // Keep average for backward compatibility
            metadata,
            lastSeen: new Date().toISOString(),
            photoCount: existingFace.photoCount + 1,
            sampleCount: descriptors.length
        };

        faces[existingIndex] = faceData;
        console.log(`[Face Storage] Updated face: ${faceId} (${descriptors.length} samples)`);
    } else {
        // New face
        const faceData = {
            faceId,
            descriptors: [descriptor], // Store as array
            descriptor, // Keep single for backward compatibility
            metadata,
            lastSeen: new Date().toISOString(),
            photoCount: 1,
            sampleCount: 1
        };

        faces.push(faceData);
        console.log(`[Face Storage] Added new face: ${faceId} (1 sample)`);
    }

    fs.writeFileSync(FACES_FILE, JSON.stringify(faces, null, 2));
    return faces[existingIndex !== -1 ? existingIndex : faces.length - 1];
}

// Get average descriptor for a face
export function getAverageDescriptor(faceId) {
    const face = getFaceById(faceId);
    if (!face) return null;

    if (face.descriptors && face.descriptors.length > 0) {
        return calculateAverageDescriptor(face.descriptors);
    }

    return face.descriptor;
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
