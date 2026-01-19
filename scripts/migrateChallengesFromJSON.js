/**
 * Migration Script: Migrate challenges from JSON to Database
 *
 * This script reads challenges from data/challenges.json and creates
 * them in the PostgreSQL database via Prisma.
 *
 * Run with: node scripts/migrateChallengesFromJSON.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../lib/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrateChallenges() {
  try {
    console.log('[Migration] Starting challenges migration from JSON to database...\n');

    // Read challenges from JSON file
    const jsonPath = path.join(__dirname, '../data/challenges.json');
    if (!fs.existsSync(jsonPath)) {
      console.error('[Migration] ❌ challenges.json not found at:', jsonPath);
      process.exit(1);
    }

    const jsonContent = fs.readFileSync(jsonPath, 'utf8');
    const challenges = JSON.parse(jsonContent);

    console.log(`[Migration] Found ${challenges.length} challenges in JSON file\n`);

    // Migrate each challenge
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const challenge of challenges) {
      try {
        // Check if challenge already exists
        const existing = await prisma.challenge.findUnique({
          where: { id: challenge.id },
        });

        if (existing) {
          // Update existing challenge
          await prisma.challenge.update({
            where: { id: challenge.id },
            data: {
              title: challenge.title,
              instruction: challenge.instruction,
              image: challenge.image,
              folderId: challenge.folderId || null,
              order: challenge.order || 0,
            },
          });
          console.log(`[Migration] ✓ Updated: "${challenge.title}" (${challenge.id})`);
          updated++;
        } else {
          // Create new challenge
          await prisma.challenge.create({
            data: {
              id: challenge.id,
              title: challenge.title,
              instruction: challenge.instruction,
              image: challenge.image,
              folderId: challenge.folderId || null,
              order: challenge.order || 0,
            },
          });
          console.log(`[Migration] ✓ Created: "${challenge.title}" (${challenge.id})`);
          created++;
        }
      } catch (error) {
        console.error(`[Migration] ❌ Failed to migrate "${challenge.title}":`, error.message);
        skipped++;
      }
    }

    console.log('\n[Migration] ========== Summary ==========');
    console.log(`[Migration] ✓ Created: ${created}`);
    console.log(`[Migration] ✓ Updated: ${updated}`);
    console.log(`[Migration] ❌ Skipped: ${skipped}`);
    console.log(`[Migration] Total: ${challenges.length}`);
    console.log('[Migration] ============================\n');
    console.log('[Migration] ✅ Migration complete!');

  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateChallenges();
