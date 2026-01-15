const fs = require('fs');
const path = require('path');

// Import after defining paths
const dataDir = path.join(process.cwd(), 'data');
const facesFile = path.join(dataDir, 'faces.json');
const photosFile = path.join(dataDir, 'photos.json');

console.log('[Cleanup] Starting orphaned thumbnail cleanup...');

// Load data
const faces = JSON.parse(fs.readFileSync(facesFile, 'utf-8'));
const photos = JSON.parse(fs.readFileSync(photosFile, 'utf-8'));

console.log(`[Cleanup] Found ${faces.length} faces and ${photos.length} photos`);

// Find orphaned faces (faces not in any photo)
const orphanedFaces = faces.filter(face => {
    const faceId = face.faceId;
    
    // Check if this face appears in any photo
    const hasPhotos = photos.some(photo => {
        const photoFaces = photo.faceIds || [photo.mainFaceId || photo.faceId].filter(Boolean);
        return photoFaces.includes(faceId);
    });
    
    return !hasPhotos;
});

console.log(`[Cleanup] Found ${orphanedFaces.length} orphaned faces`);

if (orphanedFaces.length > 0) {
    console.log('[Cleanup] Orphaned faces:', orphanedFaces.map(f => f.faceId).join(', '));
    
    // Remove orphaned faces from faces.json
    const cleanedFaces = faces.filter(face => !orphanedFaces.find(o => o.faceId === face.faceId));
    
    fs.writeFileSync(facesFile, JSON.stringify(cleanedFaces, null, 2));
    console.log(`[Cleanup] Removed ${orphanedFaces.length} orphaned faces from faces.json`);
    
    // Note: We can't delete from Google Drive from this script without OAuth setup
    console.log('[Cleanup] Note: Thumbnail files in Google Drive need to be deleted manually or through the API');
    console.log('[Cleanup] Orphaned thumbnail Drive IDs:');
    orphanedFaces.forEach(face => {
        if (face.thumbnailDriveId) {
            console.log(`  - ${face.faceId}: ${face.thumbnailDriveId}`);
        }
    });
} else {
    console.log('[Cleanup] No orphaned faces found. All clean! ✓');
}
