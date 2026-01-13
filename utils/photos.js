import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'photos.json');

export function getPhotos() {
    if (!fs.existsSync(DATA_FILE)) {
        return [];
    }
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
}

export function savePhoto(photo) {
    const photos = getPhotos();

    // Deduplication: Don't add if the driveId already exists
    if (photo.driveId && photos.some(p => p.driveId === photo.driveId)) {
        console.log(`[Photos Utility] Duplicate driveId detected: ${photo.driveId}. Skipping save.`);
        return;
    }

    photos.push(photo);
    savePhotos(photos);
}

export function savePhotos(photos) {
    const dataDir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(photos, null, 2));
}

export function deletePhoto(photoId) {
    const photos = getPhotos();
    const updatedPhotos = photos.filter(p => p.id !== photoId);
    savePhotos(updatedPhotos);
}
