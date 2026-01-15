/**
 * Script to clean up orphaned face thumbnails
 *
 * Orphaned thumbnails occur when:
 * 1. A photo is deleted from Google Drive directly (bypassing the app)
 * 2. The face thumbnail remains in faces.json but the file is gone
 *
 * Usage: node scripts/cleanupOrphanedThumbnails.js
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf-8');
    envFile.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            process.env[match[1].trim()] = match[2].trim();
        }
    });
}

const FACES_FILE = path.join(process.cwd(), 'data', 'faces.json');

async function getDriveClient() {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    return google.drive({ version: 'v3', auth: oauth2Client });
}

async function checkFileExists(drive, fileId) {
    try {
        await drive.files.get({ fileId, fields: 'id' });
        return true;
    } catch (error) {
        if (error.code === 404) {
            return false;
        }
        throw error;
    }
}

async function cleanupOrphanedThumbnails() {
    console.log('Starting orphaned thumbnail cleanup...\n');

    // Load faces
    const faces = JSON.parse(fs.readFileSync(FACES_FILE, 'utf-8'));
    console.log(`Loaded ${faces.length} faces\n`);

    const drive = await getDriveClient();
    const cleanedFaces = [];
    let orphanedCount = 0;

    for (const face of faces) {
        if (!face.thumbnailDriveId) {
            // No thumbnail to check
            cleanedFaces.push(face);
            continue;
        }

        // Check if thumbnail file exists in Drive
        const exists = await checkFileExists(drive, face.thumbnailDriveId);

        if (exists) {
            console.log(`✓ ${face.faceId}: thumbnail exists (${face.thumbnailDriveId})`);
            cleanedFaces.push(face);
        } else {
            console.log(`✗ ${face.faceId}: thumbnail MISSING (${face.thumbnailDriveId}) - removing thumbnailDriveId`);
            // Keep the face but remove the orphaned thumbnail reference
            const { thumbnailDriveId, ...faceWithoutThumbnail } = face;
            cleanedFaces.push(faceWithoutThumbnail);
            orphanedCount++;
        }
    }

    // Save cleaned faces
    fs.writeFileSync(FACES_FILE, JSON.stringify(cleanedFaces, null, 2));

    console.log(`\n✅ Cleanup complete!`);
    console.log(`  - Total faces: ${faces.length}`);
    console.log(`  - Orphaned thumbnails removed: ${orphanedCount}`);
    console.log(`  - Faces saved: ${FACES_FILE}`);

    if (orphanedCount > 0) {
        console.log('\nNote: Next time these faces are detected, new thumbnails will be created.');
    }
}

cleanupOrphanedThumbnails().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
