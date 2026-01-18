import fs from 'fs';
import path from 'path';
import lockfile from 'proper-lockfile';

const PHOTOS_FILE = path.join(process.cwd(), 'data', 'photos.json');

// Ensure data directory exists
function ensureDataDir() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

// Load existing photos with corruption recovery
function loadPhotos() {
    ensureDataDir();

    if (!fs.existsSync(PHOTOS_FILE)) {
        return [];
    }

    try {
        const data = fs.readFileSync(PHOTOS_FILE, 'utf-8');

        // Validate JSON before parsing
        if (!data || data.trim().length === 0) {
            console.warn('[Photo Storage] Empty file, returning []');
            return [];
        }

        const photos = JSON.parse(data);

        // Validate structure
        if (!Array.isArray(photos)) {
            console.error('[Photo Storage] Invalid data structure (not array), attempting backup restoration...');
            return restoreFromBackup() || [];
        }

        return photos;
    } catch (error) {
        if (error instanceof SyntaxError) {
            console.error('[Photo Storage] Corrupted JSON file:', error.message);
            console.error('[Photo Storage] Attempting backup restoration...');
            return restoreFromBackup() || [];
        } else {
            // File system error, permission error, etc. - re-throw to expose real problem
            console.error('[Photo Storage] File system error:', error);
            throw error;
        }
    }
}

// Restore from backup file
function restoreFromBackup() {
    const backupPath = `${PHOTOS_FILE}.backup`;

    if (fs.existsSync(backupPath)) {
        try {
            const data = fs.readFileSync(backupPath, 'utf-8');
            const photos = JSON.parse(data);

            if (!Array.isArray(photos)) {
                console.error('[Photo Storage] Backup also has invalid structure');
                return null;
            }

            // Copy backup to main file
            fs.copyFileSync(backupPath, PHOTOS_FILE);

            console.log(`[Photo Storage] ✅ Restored from backup (${photos.length} photos)`);
            return photos;
        } catch (backupError) {
            console.error('[Photo Storage] Backup also corrupted:', backupError.message);
            return null;
        }
    }

    console.error('[Photo Storage] No backup file found');
    return null;
}

/**
 * Save a new photo with file locking to prevent race conditions
 *
 * CRITICAL FIX: Prevents concurrent writes from overwriting each other
 *
 * Scenario BEFORE fix:
 * T1: Request A reads [p1]
 * T2: Request B reads [p1]
 * T3: Request A writes [p1, p2]
 * T4: Request B writes [p1, p3] ← OVERWRITES p2!
 *
 * Scenario AFTER fix:
 * T1: Request A acquires lock
 * T2: Request B waits for lock
 * T3: Request A reads [p1], writes [p1, p2], releases lock
 * T4: Request B acquires lock, reads [p1, p2], writes [p1, p2, p3] ✅
 */
export async function savePhoto(photo) {
    ensureDataDir();

    // Ensure file exists before locking
    if (!fs.existsSync(PHOTOS_FILE)) {
        fs.writeFileSync(PHOTOS_FILE, '[]');
    }

    let release;
    try {
        // Acquire lock with retries
        release = await lockfile.lock(PHOTOS_FILE, {
            retries: {
                retries: 5,      // Try 5 times
                factor: 2,       // Exponential backoff
                minTimeout: 100, // Start at 100ms
                maxTimeout: 1000 // Max 1s between retries
            },
            stale: 10000 // Consider lock stale after 10s
        });

        console.log('[Photo Storage] Lock acquired for write operation');

        // Critical section - locked
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

        // Create backup before writing
        if (fs.existsSync(PHOTOS_FILE)) {
            fs.copyFileSync(PHOTOS_FILE, `${PHOTOS_FILE}.backup`);
        }

        fs.writeFileSync(PHOTOS_FILE, JSON.stringify(photos, null, 2));
        console.log(`[Photo Storage] Successfully wrote to photos.json (${photos.length} total)`);

        return photo;
    } catch (error) {
        if (error.code === 'ELOCKED') {
            console.error('[Photo Storage] File is locked by another process after retries');
            throw new Error('Unable to save photo - file locked. Please try again.');
        }
        console.error('[Photo Storage] Failed to save photo:', error);
        throw error;
    } finally {
        if (release) {
            await release();
            console.log('[Photo Storage] Lock released');
        }
    }
}

// Get all photos (no lock needed for reads)
export function getPhotos() {
    return loadPhotos();
}

/**
 * Update an existing photo by ID with file locking
 */
export async function updatePhoto(photoId, updates) {
    ensureDataDir();

    // Ensure file exists before locking
    if (!fs.existsSync(PHOTOS_FILE)) {
        fs.writeFileSync(PHOTOS_FILE, '[]');
    }

    let release;
    try {
        // Acquire lock
        release = await lockfile.lock(PHOTOS_FILE, {
            retries: {
                retries: 5,
                factor: 2,
                minTimeout: 100,
                maxTimeout: 1000
            },
            stale: 10000
        });

        console.log('[Photo Storage] Lock acquired for update operation');

        // Critical section - locked
        const photos = loadPhotos();
        const photoIndex = photos.findIndex(p => p.id === photoId);

        if (photoIndex === -1) {
            console.error(`[Photo Storage] Photo ${photoId} not found`);
            return null;
        }

        // Merge updates with existing photo
        photos[photoIndex] = {
            ...photos[photoIndex],
            ...updates
        };

        // Create backup before writing
        if (fs.existsSync(PHOTOS_FILE)) {
            fs.copyFileSync(PHOTOS_FILE, `${PHOTOS_FILE}.backup`);
        }

        fs.writeFileSync(PHOTOS_FILE, JSON.stringify(photos, null, 2));
        console.log(`[Photo Storage] Updated photo ${photoId} with:`, updates);

        return photos[photoIndex];
    } catch (error) {
        if (error.code === 'ELOCKED') {
            console.error('[Photo Storage] File is locked by another process');
            throw new Error('Unable to update photo - file locked. Please try again.');
        }
        console.error('[Photo Storage] Failed to update photo:', error);
        throw error;
    } finally {
        if (release) {
            await release();
            console.log('[Photo Storage] Lock released');
        }
    }
}

/**
 * Delete a photo by driveId with file locking
 */
export async function deletePhoto(driveId) {
    ensureDataDir();

    // Ensure file exists before locking
    if (!fs.existsSync(PHOTOS_FILE)) {
        return false;
    }

    let release;
    try {
        // Acquire lock
        release = await lockfile.lock(PHOTOS_FILE, {
            retries: {
                retries: 5,
                factor: 2,
                minTimeout: 100,
                maxTimeout: 1000
            },
            stale: 10000
        });

        console.log('[Photo Storage] Lock acquired for delete operation');

        // Critical section - locked
        const photos = loadPhotos();
        const filtered = photos.filter(p => p.driveId !== driveId);

        if (filtered.length < photos.length) {
            // Create backup before writing
            if (fs.existsSync(PHOTOS_FILE)) {
                fs.copyFileSync(PHOTOS_FILE, `${PHOTOS_FILE}.backup`);
            }

            fs.writeFileSync(PHOTOS_FILE, JSON.stringify(filtered, null, 2));
            console.log(`[Photo Storage] Deleted photo with driveId: ${driveId} (${filtered.length} remaining)`);
            return true;
        }

        return false;
    } catch (error) {
        if (error.code === 'ELOCKED') {
            console.error('[Photo Storage] File is locked by another process');
            throw new Error('Unable to delete photo - file locked. Please try again.');
        }
        console.error('[Photo Storage] Failed to delete photo:', error);
        throw error;
    } finally {
        if (release) {
            await release();
            console.log('[Photo Storage] Lock released');
        }
    }
}
