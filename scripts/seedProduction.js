/**
 * Production Database Seeding Script
 *
 * Seeds the production database with initial pose challenges
 * from the existing challenges in public/challenges/
 *
 * Usage: node scripts/seedProduction.js
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function seedChallenges() {
  console.log('🌱 Seeding production database with pose challenges...\n');

  const challenges = [
    {
      id: 'back-to-back',
      title: 'גב אל גב',
      instruction: 'עמדו גב אל גב ותצטלמו ביחד',
      image: '/challenges/back-to-back.png',
      folderId: null,
    },
    {
      id: 'dip',
      title: 'טבילה רומנטית',
      instruction: 'צלמו רגע של טבילה רומנטית',
      image: '/challenges/dip.png',
      folderId: null,
    },
    {
      id: 'whisper',
      title: 'לחישה באוזן',
      instruction: 'לחשו סוד זה לזה ותצטלמו',
      image: '/challenges/whisper.png',
      folderId: null,
    },
  ];

  for (const challenge of challenges) {
    try {
      const result = await prisma.challenge.upsert({
        where: { id: challenge.id },
        update: challenge,
        create: challenge,
      });
      console.log(`✅ Seeded: ${challenge.title} (${challenge.id})`);
    } catch (error) {
      console.error(`❌ Failed to seed ${challenge.id}:`, error.message);
    }
  }

  console.log('\n✅ Database seeding complete!');
}

async function main() {
  try {
    await seedChallenges();
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
