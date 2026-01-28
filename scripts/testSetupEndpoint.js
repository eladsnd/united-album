/**
 * Test Setup Endpoint
 *
 * Quick script to verify the /api/super-admin/setup endpoint is working
 */

async function testEndpoint() {
  try {
    console.log('Testing /api/super-admin/setup endpoint...\n');

    const response = await fetch('http://localhost:3000/api/super-admin/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@test.com',
        password: 'test1234',
      }),
    });

    const contentType = response.headers.get('content-type');
    console.log('Response status:', response.status);
    console.log('Content-Type:', contentType);
    console.log('');

    if (contentType?.includes('application/json')) {
      const data = await response.json();
      console.log('✓ Endpoint is working! Response:');
      console.log(JSON.stringify(data, null, 2));

      if (data.success) {
        console.log('\n✓ Super admin setup is ready!');
        console.log('You can now run: node scripts/createSuperAdmin.js');
      } else if (data.error?.includes('already exists')) {
        console.log('\n✓ Super admin already exists!');
        console.log('Just log in at: http://localhost:3000/super-admin/login');
      }
    } else {
      const text = await response.text();
      if (text.includes('Export prisma')) {
        console.log('✗ Build error still present');
        console.log('The dev server needs to be restarted:');
        console.log('  1. Kill dev server (Ctrl+C)');
        console.log('  2. rm -rf .next');
        console.log('  3. npm run dev');
      } else {
        console.log('✗ Unexpected response:');
        console.log(text.substring(0, 200));
      }
    }
  } catch (error) {
    console.error('✗ Error:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\nMake sure dev server is running:');
      console.log('  npm run dev');
    }
  }
}

testEndpoint();
