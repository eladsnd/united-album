const fs = require('fs');
const path = require('path');

const facesPath = path.join(__dirname, '../data/faces.json');
const photosPath = path.join(__dirname, '../data/photos.json');

function cleanup() {
    if (!fs.existsSync(facesPath) || !fs.existsSync(photosPath)) {
        console.log('Data files not found.');
        return;
    }

    try {
        const faces = JSON.parse(fs.readFileSync(facesPath, 'utf-8'));
        const photos = JSON.parse(fs.readFileSync(photosPath, 'utf-8'));

        console.log(`Original faces count: ${faces.length}`);

        const usedFaceIds = new Set();

        photos.forEach(photo => {
            // Check legacy faceId
            if (photo.faceId) usedFaceIds.add(photo.faceId);
            // Check mainFaceId
            if (photo.mainFaceId) usedFaceIds.add(photo.mainFaceId);
            // Check faceIds array
            if (Array.isArray(photo.faceIds)) {
                photo.faceIds.forEach(id => usedFaceIds.add(id));
            }
        });

        // Filter faces
        const cleanFaces = faces.filter(face => {
            const isUsed = usedFaceIds.has(face.faceId);
            return isUsed;
        });

        console.log(`Cleaned faces count: ${cleanFaces.length}`);
        console.log(`Removed ${faces.length - cleanFaces.length} unused faces.`);

        // Part 2: Merge similar faces
        console.log('Checking for duplicate faces to merge...');
        // const faceapi = require('@vladmandic/face-api'); // REMOVED: Custom implementation used instead

        // Simple euclidean distance implementation since we can't easily load face-api in this script
        function euclideanDistance(desc1, desc2) {
            return Math.sqrt(
                desc1
                    .map((val, i) => val - desc2[i])
                    .reduce((sum, diff) => sum + diff * diff, 0)
            );
        }

        const MERGE_THRESHOLD = 0.45;
        const mergedMap = new Map(); // oldId -> newId

        // Sort faces by photoCount (descending) so we keep the most popular ones
        cleanFaces.sort((a, b) => (b.photoCount || 0) - (a.photoCount || 0));

        const finalFaces = [];
        const processedIds = new Set();

        for (const face of cleanFaces) {
            if (processedIds.has(face.faceId)) continue;

            // This face is a "keeper" unless we find it's a duplicate of an already kept face
            // But since we sorted by popularity, we treat this as a potential "primary" 
            // and look for ANY other faces that are close to it to merge INTO it.

            finalFaces.push(face);
            processedIds.add(face.faceId);

            for (const otherFace of cleanFaces) {
                if (processedIds.has(otherFace.faceId)) continue;

                const distance = euclideanDistance(face.descriptor, otherFace.descriptor);
                if (distance < MERGE_THRESHOLD) {
                    console.log(`Merging ${otherFace.faceId} into ${face.faceId} (distance: ${distance.toFixed(3)})`);
                    mergedMap.set(otherFace.faceId, face.faceId);
                    processedIds.add(otherFace.faceId);

                    // Update photo count
                    face.photoCount = (face.photoCount || 0) + (otherFace.photoCount || 0);
                    // Update last seen
                    if (new Date(otherFace.lastSeen) > new Date(face.lastSeen)) {
                        face.lastSeen = otherFace.lastSeen;
                    }
                }
            }
        }

        console.log(`Merged ${mergedMap.size} duplicate faces.`);
        console.log(`Final unique faces count: ${finalFaces.length}`);

        // Part 3: Update photos with new merged IDs
        let photosUpdated = 0;
        photos.forEach(photo => {
            let changed = false;

            // Update mainFaceId
            if (mergedMap.has(photo.mainFaceId)) {
                photo.mainFaceId = mergedMap.get(photo.mainFaceId);
                changed = true;
            }

            // Update legacy faceId
            if (mergedMap.has(photo.faceId)) {
                photo.faceId = mergedMap.get(photo.faceId);
                changed = true;
            }

            // Update faceIds array
            if (Array.isArray(photo.faceIds)) {
                const newIds = photo.faceIds.map(id => mergedMap.has(id) ? mergedMap.get(id) : id);
                // unique ids only
                const uniqueIds = [...new Set(newIds)];
                if (JSON.stringify(uniqueIds) !== JSON.stringify(photo.faceIds)) {
                    photo.faceIds = uniqueIds;
                    changed = true;
                }
            }

            if (changed) photosUpdated++;
        });

        console.log(`Updated ${photosUpdated} photos with merged IDs.`);

        // Write back everything
        fs.writeFileSync(facesPath, JSON.stringify(finalFaces, null, 2));
        fs.writeFileSync(photosPath, JSON.stringify(photos, null, 2));
        console.log('Successfully cleaned and merged faces!');

    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

cleanup();
