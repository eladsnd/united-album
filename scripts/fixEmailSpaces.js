/**
 * Fix Email Spaces
 *
 * Removes trailing spaces from user emails in database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixEmails() {
  try {
    console.log('Finding users with email spaces...\n');

    const users = await prisma.user.findMany();

    for (const user of users) {
      const trimmedEmail = user.email.trim();

      if (trimmedEmail !== user.email) {
        console.log(`Fixing: "${user.email}" → "${trimmedEmail}"`);

        await prisma.user.update({
          where: { id: user.id },
          data: { email: trimmedEmail },
        });

        console.log('✓ Fixed!\n');
      }
    }

    console.log('Done!');
    console.log('\nYou can now log in with:');
    console.log('Email: the0elad@gmail.com (no spaces)');
    console.log('Password: Nami7827');
    console.log('\nVisit: http://localhost:3000/super-admin/login');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixEmails();
