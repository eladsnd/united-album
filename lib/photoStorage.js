import fs from 'fs';
import path from 'path';

const PHOTOS_FILE = path.join(process.cwd(), 'data', 'photos.json');

// Ensure data directory exists
function ensureDataDir() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

// Load existing photos
function loadPhotos() {
    ensureDataDir();

    if (!fs.existsSync(PHOTOS_FILE)) {
        return [];
    }

    try {
        const data = fs.readFileSync(PHOTOS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('[Photo Storage] Error loading photos:', error);
        return [];
    }
}

// Save a new photo (with deduplication)
export function savePhoto(photo) {
    ensureDataDir();

    const photos = loadPhotos();

    // Check for duplicates by driveId
    const existingIndex = photos.findIndex(p => p.driveId === photo.driveId);

    if (existingIndex !== -1) {
        console.log(`[Photo Storage] Updating existing photo with driveId: ${photo.driveId}`);
        photos[existingIndex] = photo;
    } else {
        console.log(`[Photo Storage] Adding new photo with driveId: ${photo.driveId}`);
        photos.push(photo);
    }

    fs.writeFileSync(PHOTOS_FILE, JSON.stringify(photos, null, 2));
    return photo;
}

// Get all photos
export function getPhotos() {
    return loadPhotos();
}

// Delete a photo by driveId
export function deletePhoto(driveId) {
    const photos = loadPhotos();
    const filtered = photos.filter(p => p.driveId !== driveId);

    if (filtered.length < photos.length) {
        fs.writeFileSync(PHOTOS_FILE, JSON.stringify(filtered, null, 2));
        console.log(`[Photo Storage] Deleted photo with driveId: ${driveId}`);
        return true;
    }

    return false;
}
