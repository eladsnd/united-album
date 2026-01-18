import { NextResponse } from 'next/server';
import { listDriveFiles } from '../../../lib/googleDrive';
import { getPhotos, deletePhoto } from '../../../lib/photoStorage';
import prisma from '../../../lib/prisma';

export async function GET() {
    try {
        const localPhotos = await getPhotos();

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

        // 3. Remove deleted photos from database if any were removed
        if (syncedPhotos.length !== localPhotos.length) {
            const removedCount = localPhotos.length - syncedPhotos.length;
            console.log(`[Photos API] Pruning ${removedCount} deleted drive photos from database.`);

            // Find photos that were removed
            const syncedDriveIds = new Set(syncedPhotos.map(p => p.driveId));
            const photosToRemove = localPhotos.filter(p => !syncedDriveIds.has(p.driveId));

            // Delete each removed photo from database
            for (const photo of photosToRemove) {
                try {
                    await deletePhoto(photo.driveId);
                    console.log(`[Photos API] Deleted orphaned photo: ${photo.driveId}`);
                } catch (error) {
                    console.error(`[Photos API] Failed to delete photo ${photo.driveId}:`, error);
                }
            }
        }

        return NextResponse.json(syncedPhotos);
    } catch (error) {
        console.error('Error fetching/syncing photos:', error);
        // Fallback to local photos if Drive check fails
        try {
            return NextResponse.json(await getPhotos());
        } catch (fallbackError) {
            console.error('Error fetching fallback photos:', fallbackError);
            return NextResponse.json([]);
        }
    }
}
