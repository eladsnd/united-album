/**
 * Clean Database Script
 *
 * Removes all test/junk data from the database and resets it to a clean state.
 * This script will:
 * 1. Delete all Challenge records (poses)
 * 2. Delete all Face records
 * 3. Delete all Photo records
 *
 * Run with: node scripts/cleanDatabase.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDatabase() {
  console.log('🧹 Starting database cleanup...\n');

  try {
    // Delete all challenges (poses)
    const deletedChallenges = await prisma.challenge.deleteMany({});
    console.log(`✅ Deleted ${deletedChallenges.count} challenge records`);

    // Delete all faces
    const deletedFaces = await prisma.face.deleteMany({});
    console.log(`✅ Deleted ${deletedFaces.count} face records`);

    // Delete all photos
    const deletedPhotos = await prisma.photo.deleteMany({});
    console.log(`✅ Deleted ${deletedPhotos.count} photo records`);

    console.log('\n✨ Database cleaned successfully!');
    console.log('📊 All tables are now empty and ready for fresh data.');

  } catch (error) {
    console.error('❌ Error cleaning database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDatabase();
