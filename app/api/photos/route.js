import { NextResponse } from 'next/server';
import { listFiles, isGoogleDrive } from '../../../lib/storage/operations';
import { PhotoRepository } from '../../../lib/repositories/PhotoRepository.js';

export async function GET(request) {
    try {
        // Parse pagination params from URL
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');

        // Calculate skip value for pagination
        const skip = (page - 1) * limit;

        const photoRepo = new PhotoRepository();

        // Get total count for pagination metadata
        const totalCount = await photoRepo.count();

        // Get paginated photos
        const localPhotos = await photoRepo.findMany({
            orderBy: { timestamp: 'desc' },
            skip: skip,
            take: limit,
        });

        // Sync with storage provider (provider-agnostic)
        let syncedPhotos = localPhotos;

        // Only sync with Google Drive (Cloudinary doesn't need this)
        if (isGoogleDrive()) {
            try {
                // 1. Get all valid file IDs from storage provider
                const validFileIds = await listFiles();

                // 2. Filter photos that still exist in storage
                const filteredPhotos = localPhotos.filter(p => {
                    if (p.driveId === 'mock_drive_id') return true;
                    return validFileIds.has(p.driveId);
                });

                // 2.1 Deduplicate by driveId (keep the first occurrence)
                const seenIds = new Set();
                syncedPhotos = filteredPhotos.filter(p => {
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
                    console.log(`[Photos API] Pruning ${removedCount} deleted photos from database.`);

                    // Find photos that were removed
                    const syncedDriveIds = new Set(syncedPhotos.map(p => p.driveId));
                    const photosToRemove = localPhotos.filter(p => !syncedDriveIds.has(p.driveId));

                    // Delete each removed photo from database
                    for (const photo of photosToRemove) {
                        try {
                            await photoRepo.deleteByDriveId(photo.driveId);
                            console.log(`[Photos API] Deleted orphaned photo: ${photo.driveId}`);
                        } catch (error) {
                            console.error(`[Photos API] Failed to delete photo ${photo.driveId}:`, error);
                        }
                    }
                }
            } catch (syncError) {
                console.warn('[Photos API] Storage sync failed, using database only:', syncError.message);
                // Continue with local photos if sync fails
            }
        }

        // Calculate pagination metadata
        const totalPages = Math.ceil(totalCount / limit);
        const hasMore = page < totalPages;

        return NextResponse.json({
            photos: syncedPhotos,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages,
                hasMore
            }
        });
    } catch (error) {
        console.error('Error fetching/syncing photos:', error);
        // Fallback to local photos if Drive check fails
        try {
            const photoRepo = new PhotoRepository();
            const fallbackPhotos = await photoRepo.findAll();
            return NextResponse.json({
                photos: fallbackPhotos,
                pagination: {
                    page: 1,
                    limit: fallbackPhotos.length,
                    totalCount: fallbackPhotos.length,
                    totalPages: 1,
                    hasMore: false
                }
            });
        } catch (fallbackError) {
            console.error('Error fetching fallback photos:', fallbackError);
            return NextResponse.json({
                photos: [],
                pagination: {
                    page: 1,
                    limit: 0,
                    totalCount: 0,
                    totalPages: 0,
                    hasMore: false
                }
            });
        }
    }
}
