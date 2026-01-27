/**
 * Migration Script: Initialize Feature Flags
 *
 * Sets default values for new feature flags.
 * Enables features by default that were always on before (events, faceDetection, photoLikes, bulkUpload).
 * Preserves existing gamification setting if it exists.
 *
 * Run with: node scripts/migrateFeatureFlags.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  console.log('[Migration] Starting feature flag migration...');

  try {
    // Get existing settings
    const settings = await prisma.appSettings.findUnique({
      where: { id: 'app_settings' },
    });

    if (!settings) {
      console.log('[Migration] No settings found, creating with defaults');
      await prisma.appSettings.create({
        data: {
          id: 'app_settings',
          gamification: false,
          events: true,  // Enable by default (was always on)
          faceDetection: true,  // Enable by default (was always on)
          photoLikes: true,  // Enable by default (was always on)
          bulkUpload: true,  // Enable by default (was always on)
        },
      });
      console.log('[Migration] ✅ Created settings with default feature flags');
    } else {
      console.log('[Migration] Updating existing settings');
      // Preserve gamification setting if it exists (from old gamifyMode field)
      // Set other features to enabled by default
      await prisma.appSettings.update({
        where: { id: 'app_settings' },
        data: {
          // gamification: already set by Prisma migration (renamed from gamifyMode)
          events: settings.events !== undefined ? settings.events : true,
          faceDetection: settings.faceDetection !== undefined ? settings.faceDetection : true,
          photoLikes: settings.photoLikes !== undefined ? settings.photoLikes : true,
          bulkUpload: settings.bulkUpload !== undefined ? settings.bulkUpload : true,
        },
      });
      console.log('[Migration] ✅ Updated settings with new feature flags');
    }

    // Display final state
    const finalSettings = await prisma.appSettings.findUnique({
      where: { id: 'app_settings' },
    });

    console.log('\n[Migration] Final feature flag state:');
    console.log('  - Gamification:', finalSettings.gamification);
    console.log('  - Events:', finalSettings.events);
    console.log('  - Face Detection:', finalSettings.faceDetection);
    console.log('  - Photo Likes:', finalSettings.photoLikes);
    console.log('  - Bulk Upload:', finalSettings.bulkUpload);

    console.log('\n[Migration] ✅ Migration complete!');
  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
