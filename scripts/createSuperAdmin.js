/**
 * Create Super Admin Script
 *
 * Interactive script to create the first super admin user.
 * Run this once after database setup.
 *
 * Usage:
 *   node scripts/createSuperAdmin.js
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  Super Admin Setup');
  console.log('='.repeat(60));
  console.log('');
  console.log('This script will create your first super admin user.');
  console.log('You only need to run this once.');
  console.log('');

  // Get user input
  // IMPORTANT: Trim email and name, but NEVER trim passwords!
  // Passwords can intentionally contain spaces as part of the password
  const email = (await question('Email address: ')).trim();
  const password = await question('Password (min 8 chars): '); // NO TRIM - spaces are valid!
  const name = (await question('Full name (optional): ')).trim();

  console.log('');

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    console.error('Error: Invalid email address format');
    console.error('Example: admin@example.com');
    rl.close();
    process.exit(1);
  }

  // Validate password strength
  if (!password || password.length < 8) {
    console.error('Error: Password must be at least 8 characters');
    rl.close();
    process.exit(1);
  }

  // Check password isn't too weak
  if (password.toLowerCase() === 'password' ||
      password === '12345678' ||
      password === '00000000') {
    console.error('Error: Password is too weak. Please use a stronger password.');
    rl.close();
    process.exit(1);
  }

  const confirm = await question(`\nCreate super admin "${email}"? (y/n): `);
  if (confirm.toLowerCase() !== 'y') {
    console.log('Cancelled.');
    rl.close();
    process.exit(0);
  }

  console.log('\nCreating super admin...');

  // Make API request to create super admin
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const setupSecret = process.env.SETUP_SECRET || '';

    const response = await fetch(`${baseUrl}/api/super-admin/setup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        name: name || undefined,
        setupSecret: setupSecret || undefined,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    console.log('');
    console.log('✓ Super admin created successfully!');
    console.log('');
    console.log('Login details:');
    console.log(`  Email:    ${data.user.email}`);
    console.log(`  Role:     ${data.user.role}`);
    if (data.user.name) {
      console.log(`  Name:     ${data.user.name}`);
    }
    console.log('');
    console.log('Next steps:');
    console.log('  1. Visit http://localhost:3000/super-admin/login');
    console.log('  2. Log in with your email and password');
    console.log('  3. Create your first event');
    console.log('  4. Create event admin users');
    console.log('');
    console.log('Your JWT token:');
    console.log(data.token.substring(0, 50) + '...');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('Error creating super admin:', error.message);
    console.error('');

    if (error.message.includes('already exists')) {
      console.log('A super admin already exists. Use the login page instead:');
      console.log('  http://localhost:3000/super-admin/login');
      console.log('');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.log('Make sure the Next.js dev server is running:');
      console.log('  npm run dev');
      console.log('');
    }

    rl.close();
    process.exit(1);
  }

  rl.close();
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  rl.close();
  process.exit(1);
});
