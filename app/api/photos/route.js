import { NextResponse } from 'next/server';
import { listDriveFiles } from '../../../lib/googleDrive';
import { getPhotos, savePhotos } from '../../../utils/photos';

export async function GET() {
    try {
        const localPhotos = getPhotos();

        // 1. Get all valid file IDs from Drive
        // Since we use the 'drive.file' scope, this will only return files created by our app.
        // We can list globally or by folder. Let's list globally to catch everything this app uploaded.
        const validDriveIds = await listDriveFiles();

        // 2. Filter and Update URLs
        const filteredPhotos = localPhotos.filter(p => {
            if (p.driveId === 'mock_drive_id') return true;
            return validDriveIds.has(p.driveId);
        });

        // 2.1 Deduplicate by driveId (keep the first occurrence)
        const seenIds = new Set();
        const syncedPhotos = filteredPhotos.filter(p => {
            if (p.driveId === 'mock_drive_id') return true;
            if (seenIds.has(p.driveId)) return false;
            seenIds.add(p.driveId);
            return true;
        }).map(p => {
            // Force URL to be our local proxy if driveId exists
            if (p.driveId && p.driveId !== 'mock_drive_id') {
                return { ...p, url: `/api/image/${p.driveId}` };
            }
            return p;
        });

        // 3. Update local storage if any were removed
        if (syncedPhotos.length !== localPhotos.length) {
            console.log(`[Photos API] Pruned ${localPhotos.length - syncedPhotos.length} deleted drive photos.`);
            savePhotos(syncedPhotos);
        }

        return NextResponse.json(syncedPhotos);
    } catch (error) {
        console.error('Error fetching/syncing photos:', error);
        // Fallback to local photos if Drive check fails
        return NextResponse.json(getPhotos());
    }
}
