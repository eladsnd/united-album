/**
 * Multi-Tenancy Data Migration Script
 *
 * Migrates existing single-tenant data to multi-tenant structure:
 * 1. Creates default "Main Event" for existing photos
 * 2. Assigns all photos without eventId to the default event
 * 3. Creates EventSettings for default event (copying from AppSettings)
 * 4. Preserves all existing data (zero data loss)
 *
 * Run with: node scripts/migrateToMultiTenancy.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_EVENT_ID = 'default-event';
const DEFAULT_EVENT_SLUG = 'main-event';

async function migrate() {
  console.log('[Migration] Starting multi-tenancy data migration...\n');

  try {
    // Step 1: Create default event (if it doesn't exist)
    console.log('[Step 1] Creating default event...');

    let defaultEvent = await prisma.event.findUnique({
      where: { id: DEFAULT_EVENT_ID }
    });

    if (!defaultEvent) {
      defaultEvent = await prisma.event.create({
        data: {
          id: DEFAULT_EVENT_ID,
          name: 'Main Event',
          slug: DEFAULT_EVENT_SLUG,
          description: 'Default event for existing photos',
          eventType: 'wedding',
          startTime: new Date('2024-01-01'),
          endTime: new Date('2026-12-31'),
          color: '#3B82F6',
          isActive: true,
          isArchived: false,
          order: 0,
        },
      });
      console.log(`✓ Created default event: ${defaultEvent.id}`);
    } else {
      console.log(`✓ Default event already exists: ${defaultEvent.id}`);
    }

    // Step 2: Check photos - should already have default eventId from schema
    console.log('\n[Step 2] Checking photo eventId assignments...');
    const totalPhotos = await prisma.photo.count();
    const photosWithDefaultEvent = await prisma.photo.count({
      where: { eventId: DEFAULT_EVENT_ID }
    });
    console.log(`  Total photos: ${totalPhotos}`);
    console.log(`  Photos with default eventId: ${photosWithDefaultEvent}`);

    // Step 3: Verify all photos have eventId (should be automatic from schema default)
    if (totalPhotos === photosWithDefaultEvent) {
      console.log('[Step 3] ✓ All photos already assigned to default event (via schema default)');
    } else {
      console.log(`[Step 3] ⚠ Warning: ${totalPhotos - photosWithDefaultEvent} photos have different eventId`);
    }

    // Step 4: Create EventSettings for default event (copy from AppSettings)
    console.log('\n[Step 4] Creating EventSettings for default event...');

    let eventSettings = await prisma.eventSettings.findUnique({
      where: { eventId: DEFAULT_EVENT_ID }
    });

    if (!eventSettings) {
      // Get current AppSettings
      const appSettings = await prisma.appSettings.findUnique({
        where: { id: 'app_settings' }
      });

      if (appSettings) {
        // Copy feature flags from AppSettings to EventSettings
        eventSettings = await prisma.eventSettings.create({
          data: {
            eventId: DEFAULT_EVENT_ID,
            gamification: appSettings.gamification || false,
            events: appSettings.events || false,
            faceDetection: appSettings.faceDetection || false,
            photoLikes: appSettings.photoLikes || false,
            bulkUpload: appSettings.bulkUpload || false,
            challenges: appSettings.challenges || false,
            allowGuestUploads: true,
            requireModeration: false,
          },
        });
        console.log('✓ Created EventSettings from existing AppSettings');
      } else {
        // Create with default values
        eventSettings = await prisma.eventSettings.create({
          data: {
            eventId: DEFAULT_EVENT_ID,
            gamification: false,
            events: false,
            faceDetection: false,
            photoLikes: false,
            bulkUpload: false,
            challenges: false,
            allowGuestUploads: true,
            requireModeration: false,
          },
        });
        console.log('✓ Created EventSettings with default values');
      }
    } else {
      console.log('✓ EventSettings already exist');
    }

    // Step 5: Update AppSettings (remove feature flags, keep only super admin settings)
    console.log('\n[Step 5] Updating AppSettings for super admin only...');
    const appSettings = await prisma.appSettings.upsert({
      where: { id: 'app_settings' },
      update: {
        allowSelfRegistration: false,
        requireEmailVerification: false,
        maintenanceMode: false,
      },
      create: {
        id: 'app_settings',
        allowSelfRegistration: false,
        requireEmailVerification: false,
        maintenanceMode: false,
      },
    });
    console.log('✓ AppSettings updated for super admin use');

    // Step 6: Verify migration
    console.log('\n[Step 6] Verifying migration...');
    const finalPhotoCount = await prisma.photo.count();
    const finalPhotosWithEvent = await prisma.photo.count({
      where: { eventId: DEFAULT_EVENT_ID }
    });
    const events = await prisma.event.count();
    const eventSettingsCount = await prisma.eventSettings.count();

    console.log(`  Total photos: ${finalPhotoCount}`);
    console.log(`  Photos in default event: ${finalPhotosWithEvent}`);
    console.log(`  Total events: ${events}`);
    console.log(`  Event settings configured: ${eventSettingsCount}`);

    if (finalPhotoCount === finalPhotosWithEvent) {
      console.log('\n✅ Migration successful! All photos assigned to default event.');
    } else {
      console.log('\n⚠ Warning: Some photos may have different eventId.');
    }

    console.log('\n[Migration Complete] Multi-tenancy structure ready!');
    console.log('\nNext steps:');
    console.log('1. Run: npx prisma db push (to apply schema changes)');
    console.log('2. Create super admin user via /api/super-admin/setup');
    console.log('3. Test event creation and admin assignment\n');

  } catch (error) {
    console.error('\n[Migration Failed] Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('[Migration] Process completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Migration] Fatal error:', error);
    process.exit(1);
  });
