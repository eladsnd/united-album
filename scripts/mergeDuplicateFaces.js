/**
 * Script to merge duplicate face IDs
 *
 * Usage: node scripts/mergeDuplicateFaces.js
 *
 * This script helps consolidate duplicate person IDs that should be the same person.
 * Based on user report:
 * - Person 6 and 8 are the same
 * - Person 9 and 5 are the same
 * - Person 7 and 10 are the same
 * - Person 11 and 4 are the same
 */

const fs = require('fs');
const path = require('path');

const PHOTOS_FILE = path.join(process.cwd(), 'data', 'photos.json');
const FACES_FILE = path.join(process.cwd(), 'data', 'faces.json');

// Define merge mappings: { duplicateId: keepId }
const MERGE_MAP = {
    'person_1': 'person_6'  // Merge person_1 into person_6
};

function mergeFaces() {
    console.log('Starting face merge process...\n');

    // Load data
    const photos = JSON.parse(fs.readFileSync(PHOTOS_FILE, 'utf-8'));
    const faces = JSON.parse(fs.readFileSync(FACES_FILE, 'utf-8'));

    console.log(`Loaded ${photos.length} photos and ${faces.length} faces\n`);

    // Update photos.json - replace face IDs
    let photosUpdated = 0;
    photos.forEach(photo => {
        let updated = false;

        // Update mainFaceId
        if (MERGE_MAP[photo.mainFaceId]) {
            console.log(`Photo ${photo.id}: mainFaceId ${photo.mainFaceId} → ${MERGE_MAP[photo.mainFaceId]}`);
            photo.mainFaceId = MERGE_MAP[photo.mainFaceId];
            updated = true;
        }

        // Update faceIds array
        if (photo.faceIds && Array.isArray(photo.faceIds)) {
            const originalIds = [...photo.faceIds];
            photo.faceIds = photo.faceIds.map(faceId =>
                MERGE_MAP[faceId] || faceId
            );

            // Remove duplicates after merging
            photo.faceIds = [...new Set(photo.faceIds)];

            if (JSON.stringify(originalIds) !== JSON.stringify(photo.faceIds)) {
                console.log(`Photo ${photo.id}: faceIds ${originalIds.join(', ')} → ${photo.faceIds.join(', ')}`);
                updated = true;
            }
        }

        if (updated) photosUpdated++;
    });

    console.log(`\nUpdated ${photosUpdated} photos\n`);

    // Update faces.json - merge descriptors and metadata
    const facesToRemove = Object.keys(MERGE_MAP);
    const updatedFaces = [];

    faces.forEach(face => {
        if (facesToRemove.includes(face.faceId)) {
            // This is a duplicate that will be merged
            const targetId = MERGE_MAP[face.faceId];
            const targetFace = faces.find(f => f.faceId === targetId);

            if (targetFace) {
                console.log(`Merging ${face.faceId} into ${targetId}`);

                // Merge descriptors
                const sourceDescriptors = face.descriptors || [face.descriptor];
                const targetDescriptors = targetFace.descriptors || [targetFace.descriptor];

                // Combine descriptors (max 5 samples)
                const combinedDescriptors = [...targetDescriptors, ...sourceDescriptors].slice(0, 5);

                // Update target face
                targetFace.descriptors = combinedDescriptors;
                targetFace.descriptor = calculateAverageDescriptor(combinedDescriptors);
                targetFace.sampleCount = combinedDescriptors.length;
                targetFace.photoCount = targetFace.photoCount + face.photoCount;

                // Keep the most recent lastSeen
                if (new Date(face.lastSeen) > new Date(targetFace.lastSeen)) {
                    targetFace.lastSeen = face.lastSeen;
                }

                console.log(`  → Combined ${combinedDescriptors.length} descriptors`);
            }
        } else {
            // Keep this face
            updatedFaces.push(face);
        }
    });

    console.log(`\nRemoved ${facesToRemove.length} duplicate faces\n`);

    // Save updated data
    fs.writeFileSync(PHOTOS_FILE, JSON.stringify(photos, null, 2));
    fs.writeFileSync(FACES_FILE, JSON.stringify(updatedFaces, null, 2));

    console.log('✅ Merge complete!');
    console.log(`  - Photos saved: ${PHOTOS_FILE}`);
    console.log(`  - Faces saved: ${FACES_FILE}`);
    console.log('\nPlease refresh your browser to see the updated face gallery.');
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

// Run the merge
mergeFaces();
