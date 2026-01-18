#!/usr/bin/env node

/**
 * Data Migration Script: JSON to Database
 *
 * Migrates existing data from JSON files to SQLite/PostgreSQL database using Prisma.
 * This script:
 * 1. Reads data from data/photos.json, data/faces.json, data/challenges.json
 * 2. Validates and transforms data to match Prisma schema
 * 3. Inserts all records into the database
 * 4. Reports success/failures
 *
 * Usage:
 *   node scripts/migrateToDatabase.js
 *
 * Safety:
 *   - Does NOT delete JSON files (keeps as backup)
 *   - Can be run multiple times (uses upsert for idempotency)
 *   - Validates all data before insertion
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../lib/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JSON file paths
const PHOTOS_FILE = path.join(__dirname, '../data/photos.json');
const FACES_FILE = path.join(__dirname, '../data/faces.json');
const CHALLENGES_FILE = path.join(__dirname, '../data/challenges.json');

/**
 * Load and parse JSON file
 */
function loadJSON(filepath, defaultValue = []) {
  try {
    if (!fs.existsSync(filepath)) {
      console.log(`⚠️  File not found: ${filepath}`);
      return defaultValue;
    }

    const content = fs.readFileSync(filepath, 'utf8');
    if (!content.trim()) {
      console.log(`⚠️  Empty file: ${filepath}`);
      return defaultValue;
    }

    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Error loading ${filepath}:`, error.message);
    return defaultValue;
  }
}

/**
 * Migrate photos from JSON to database
 */
async function migratePhotos(photos) {
  console.log(`\n📸 Migrating ${photos.length} photos...`);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const photo of photos) {
    try {
      // Transform data to match Prisma schema
      const photoData = {
        name: photo.name || 'unknown.jpg',
        driveId: photo.driveId,
        url: photo.url || `/api/image/${photo.driveId}`,
        mainFaceId: photo.mainFaceId || 'unknown',
        // Convert arrays to JSON strings for SQLite compatibility
        faceIds: Array.isArray(photo.faceIds)
          ? JSON.stringify(photo.faceIds)
          : photo.faceIds || '[]',
        faceBoxes: Array.isArray(photo.faceBoxes)
          ? JSON.stringify(photo.faceBoxes)
          : photo.faceBoxes || '[]',
        poseId: photo.poseId || 'unknown_pose',
        uploaderId: photo.uploaderId || null,
        timestamp: photo.timestamp ? new Date(photo.timestamp) : new Date(),
      };

      // Validate required fields
      if (!photoData.driveId) {
        throw new Error('Missing driveId');
      }

      // Use upsert for idempotency (can run migration multiple times)
      await prisma.photo.upsert({
        where: { driveId: photoData.driveId },
        update: photoData,
        create: photoData,
      });

      successCount++;
      console.log(`  ✅ Photo ${successCount}/${photos.length}: ${photoData.driveId}`);
    } catch (error) {
      errorCount++;
      errors.push({
        type: 'photo',
        data: photo,
        error: error.message,
      });
      console.error(`  ❌ Failed to migrate photo ${photo.driveId || 'unknown'}:`, error.message);
    }
  }

  return { successCount, errorCount, errors };
}

/**
 * Migrate faces from JSON to database
 */
async function migrateFaces(faces) {
  console.log(`\n👤 Migrating ${faces.length} faces...`);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const face of faces) {
    try {
      // Transform data to match Prisma schema
      const faceData = {
        faceId: face.faceId,
        // Convert arrays/objects to JSON strings for SQLite compatibility
        descriptors: Array.isArray(face.descriptors)
          ? JSON.stringify(face.descriptors)
          : face.descriptors || '[]',
        descriptor: Array.isArray(face.descriptor)
          ? JSON.stringify(face.descriptor)
          : face.descriptor || '[]',
        metadata: typeof face.metadata === 'object' && face.metadata !== null
          ? JSON.stringify(face.metadata)
          : face.metadata || '{}',
        thumbnailDriveId: face.thumbnailDriveId || null,
        lastSeen: face.lastSeen ? new Date(face.lastSeen) : new Date(),
        photoCount: face.photoCount || 0,
        sampleCount: face.sampleCount || 0,
      };

      // Validate required fields
      if (!faceData.faceId) {
        throw new Error('Missing faceId');
      }

      // Use upsert for idempotency
      await prisma.face.upsert({
        where: { faceId: faceData.faceId },
        update: faceData,
        create: faceData,
      });

      successCount++;
      console.log(`  ✅ Face ${successCount}/${faces.length}: ${faceData.faceId}`);
    } catch (error) {
      errorCount++;
      errors.push({
        type: 'face',
        data: face,
        error: error.message,
      });
      console.error(`  ❌ Failed to migrate face ${face.faceId || 'unknown'}:`, error.message);
    }
  }

  return { successCount, errorCount, errors };
}

/**
 * Migrate challenges from JSON to database
 */
async function migrateChallenges(challenges) {
  console.log(`\n🎯 Migrating ${challenges.length} challenges...`);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const challenge of challenges) {
    try {
      // Transform data to match Prisma schema
      const challengeData = {
        id: challenge.id,
        title: challenge.title,
        instruction: challenge.instruction,
        image: challenge.image,
        folderId: challenge.folderId || null,
      };

      // Validate required fields
      if (!challengeData.id || !challengeData.title || !challengeData.instruction || !challengeData.image) {
        throw new Error('Missing required fields (id, title, instruction, or image)');
      }

      // Use upsert for idempotency
      await prisma.challenge.upsert({
        where: { id: challengeData.id },
        update: challengeData,
        create: challengeData,
      });

      successCount++;
      console.log(`  ✅ Challenge ${successCount}/${challenges.length}: ${challengeData.id}`);
    } catch (error) {
      errorCount++;
      errors.push({
        type: 'challenge',
        data: challenge,
        error: error.message,
      });
      console.error(`  ❌ Failed to migrate challenge ${challenge.id || 'unknown'}:`, error.message);
    }
  }

  return { successCount, errorCount, errors };
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('🚀 Starting database migration...\n');
  console.log('━'.repeat(60));

  const startTime = Date.now();
  const allErrors = [];

  try {
    // Load JSON data
    console.log('\n📂 Loading JSON files...');
    const photos = loadJSON(PHOTOS_FILE, []);
    const faces = loadJSON(FACES_FILE, []);
    const challenges = loadJSON(CHALLENGES_FILE, []);

    console.log(`  - Photos: ${photos.length} records`);
    console.log(`  - Faces: ${faces.length} records`);
    console.log(`  - Challenges: ${challenges.length} records`);

    if (photos.length === 0 && faces.length === 0 && challenges.length === 0) {
      console.log('\n⚠️  No data to migrate. All JSON files are empty or missing.');
      return;
    }

    // Migrate data
    const photoResults = await migratePhotos(photos);
    const faceResults = await migrateFaces(faces);
    const challengeResults = await migrateChallenges(challenges);

    // Collect all errors
    allErrors.push(...photoResults.errors, ...faceResults.errors, ...challengeResults.errors);

    // Summary
    console.log('\n' + '━'.repeat(60));
    console.log('\n📊 Migration Summary:\n');

    const totalSuccess = photoResults.successCount + faceResults.successCount + challengeResults.successCount;
    const totalErrors = photoResults.errorCount + faceResults.errorCount + challengeResults.errorCount;
    const totalRecords = photos.length + faces.length + challenges.length;

    console.log(`Photos:     ${photoResults.successCount}/${photos.length} migrated ✅`);
    console.log(`Faces:      ${faceResults.successCount}/${faces.length} migrated ✅`);
    console.log(`Challenges: ${challengeResults.successCount}/${challenges.length} migrated ✅`);
    console.log(`\nTotal:      ${totalSuccess}/${totalRecords} migrated ✅`);

    if (totalErrors > 0) {
      console.log(`\n⚠️  ${totalErrors} errors occurred during migration`);
      console.log('\nError details:');
      allErrors.forEach((err, index) => {
        console.log(`\n${index + 1}. ${err.type.toUpperCase()} Error:`);
        console.log(`   Data: ${JSON.stringify(err.data, null, 2)}`);
        console.log(`   Error: ${err.error}`);
      });
    }

    // Verify database counts
    console.log('\n📈 Database verification:\n');
    const dbPhotos = await prisma.photo.count();
    const dbFaces = await prisma.face.count();
    const dbChallenges = await prisma.challenge.count();

    console.log(`Photos in database:     ${dbPhotos}`);
    console.log(`Faces in database:      ${dbFaces}`);
    console.log(`Challenges in database: ${dbChallenges}`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  Migration completed in ${duration}s`);

    if (totalSuccess === totalRecords) {
      console.log('\n✅ Migration successful! All data has been migrated to the database.');
      console.log('\n💡 Next steps:');
      console.log('   1. Verify data with: npx prisma studio');
      console.log('   2. Run database tests: npm test -- __tests__/database/');
      console.log('   3. Keep JSON files as backup until deployment is verified');
    } else {
      console.log('\n⚠️  Migration completed with errors. Please review the error details above.');
    }
  } catch (error) {
    console.error('\n❌ Fatal error during migration:', error);
    throw error;
  } finally {
    // Disconnect Prisma client
    await prisma.$disconnect();
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('\n' + '━'.repeat(60) + '\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
