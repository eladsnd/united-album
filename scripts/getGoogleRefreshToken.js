/**
 * Google OAuth Refresh Token Generator
 *
 * This script helps you generate a new Google refresh token for Google Drive API access.
 *
 * Prerequisites:
 * 1. Go to https://console.cloud.google.com/apis/credentials
 * 2. Create OAuth 2.0 Client ID (Web application)
 * 3. Add authorized redirect URI: http://localhost:3000/oauth2callback
 * 4. Copy your Client ID and Client Secret
 *
 * Usage:
 * 1. Run: node scripts/getGoogleRefreshToken.js
 * 2. Follow the prompts to enter your Client ID and Client Secret
 * 3. Open the authorization URL in your browser
 * 4. Grant permissions to your Google Drive
 * 5. Copy the code from the redirect URL
 * 6. Paste the code back into the terminal
 * 7. Copy the refresh token to your .env.local file
 */

import { google } from 'googleapis';
import readline from 'readline';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('\n🔐 Google OAuth Refresh Token Generator\n');
  console.log('Prerequisites:');
  console.log('1. Go to: https://console.cloud.google.com/apis/credentials');
  console.log('2. Create OAuth 2.0 Client ID (Web application)');
  console.log('3. Add authorized redirect URI: http://localhost:3000/oauth2callback');
  console.log('4. Enable Google Drive API: https://console.cloud.google.com/apis/library/drive.googleapis.com\n');

  // Get credentials
  const clientId = await question('Enter your Google Client ID: ');
  const clientSecret = await question('Enter your Google Client Secret: ');

  console.log('\n');

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    clientId.trim(),
    clientSecret.trim(),
    REDIRECT_URI
  );

  // Generate authorization URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force to get refresh token
  });

  console.log('📋 Step 1: Authorize this app by visiting this URL:\n');
  console.log(authUrl);
  console.log('\n');

  const code = await question('📋 Step 2: Enter the authorization code from the redirect URL: ');

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code.trim());

    if (tokens.refresh_token) {
      console.log('\n✅ Success! Your refresh token is:\n');
      console.log('━'.repeat(80));
      console.log(tokens.refresh_token);
      console.log('━'.repeat(80));
      console.log('\n📝 Add this to your .env.local file:\n');
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log('\n');
    } else {
      console.log('\n⚠️  No refresh token received.');
      console.log('This might happen if you already authorized this app before.');
      console.log('Try revoking access at: https://myaccount.google.com/permissions');
      console.log('Then run this script again.\n');
    }
  } catch (error) {
    console.error('\n❌ Error getting tokens:', error.message);
    console.error('Make sure the authorization code is correct and not expired.\n');
  }

  rl.close();
}

main().catch(console.error);
