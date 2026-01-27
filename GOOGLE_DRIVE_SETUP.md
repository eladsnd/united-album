# Google Drive OAuth Setup Guide

This guide will help you fix the `invalid_grant` error and set up Google Drive OAuth properly for both local development and production.

## Problem: `invalid_grant` Error

You're seeing this error because:
- Your Google refresh token has expired (tokens expire after ~6 months of inactivity)
- OAuth credentials were revoked
- Environment variables are missing or incorrect

## Solution: Regenerate Refresh Token

### Step 1: Check Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Make sure you have an OAuth 2.0 Client ID created
3. If not, click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"** → **"Web application"**
4. Add authorized redirect URI: `http://localhost:3000/oauth2callback`
5. Copy your **Client ID** and **Client Secret**

### Step 2: Enable Google Drive API

1. Go to [Google Drive API Library](https://console.cloud.google.com/apis/library/drive.googleapis.com)
2. Click **"ENABLE"**
3. Wait for activation (takes ~30 seconds)

### Step 3: Generate New Refresh Token

Run our helper script:

```bash
node scripts/getGoogleRefreshToken.js
```

Follow the prompts:
1. Enter your Client ID
2. Enter your Client Secret
3. Open the authorization URL in your browser
4. Sign in to Google and grant permissions
5. Copy the code from the redirect URL (after `?code=`)
6. Paste the code back into the terminal
7. Copy the refresh token to your `.env.local` file

### Step 4: Update Environment Variables

**Local Development (`/.env.local`):**
```bash
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REFRESH_TOKEN=your_new_refresh_token_here
GOOGLE_DRIVE_FOLDER_ID=your_folder_id_here
```

**Production (Vercel Dashboard):**
1. Go to your Vercel project
2. Navigate to **Settings** → **Environment Variables**
3. Update all four variables above
4. Redeploy your application

### Step 5: Get Google Drive Folder ID

1. Open [Google Drive](https://drive.google.com)
2. Create a folder for your wedding photos (or use existing)
3. Open the folder
4. Copy the folder ID from the URL:
   ```
   https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j
                                          ↑ This is your folder ID
   ```
5. Add it to your `.env.local`:
   ```bash
   GOOGLE_DRIVE_FOLDER_ID=1a2b3c4d5e6f7g8h9i0j
   ```

## Troubleshooting

### Error: "redirect_uri_mismatch"

**Problem:** The redirect URI in your OAuth consent screen doesn't match

**Solution:**
1. Go to [Credentials](https://console.cloud.google.com/apis/credentials)
2. Click on your OAuth 2.0 Client ID
3. Add **Authorized redirect URIs**:
   - `http://localhost:3000/oauth2callback` (for local development)
   - `https://your-domain.vercel.app/oauth2callback` (for production)
4. Click **SAVE**
5. Wait 5 minutes for changes to propagate
6. Run the script again

### Error: "access_denied"

**Problem:** You didn't grant the required permissions

**Solution:**
1. Make sure you click "Allow" for all permissions
2. If you see "This app isn't verified", click **"Advanced"** → **"Go to [App Name] (unsafe)"**
3. Grant all requested permissions

### Error: "invalid_client"

**Problem:** Client ID or Client Secret is incorrect

**Solution:**
1. Double-check your credentials in `.env.local`
2. Make sure there are no extra spaces or quotes
3. Regenerate credentials if needed from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

### No Refresh Token Received

**Problem:** You already authorized this app before

**Solution:**
1. Go to [Google Account Permissions](https://myaccount.google.com/permissions)
2. Find your app and click **"Remove Access"**
3. Wait 1 minute
4. Run the script again
5. Make sure to click "Allow" for all permissions

### Production Still Failing

**Problem:** Environment variables not updated in Vercel

**Solution:**
1. Verify all environment variables are set in Vercel Dashboard
2. **Redeploy** your application (don't just save env vars)
3. Check Vercel logs for any error messages:
   ```bash
   vercel logs --follow
   ```

## Testing the Fix

### Local Development

1. Restart your dev server:
   ```bash
   npm run dev
   ```

2. Go to `/admin` → **Pose Challenges** tab

3. Try creating a new pose challenge with an image

4. If successful, you'll see: `Pose created successfully!`

### Production

1. Deploy to Vercel:
   ```bash
   vercel --prod
   ```

2. Check Vercel logs:
   ```bash
   vercel logs --follow
   ```

3. Test pose challenge creation in production admin panel

4. Verify images are uploaded to Google Drive

## Security Best Practices

✅ **DO:**
- Keep your `.env.local` file gitignored
- Use strong passwords for admin access
- Regularly rotate OAuth credentials (every 6 months)
- Set up Google Drive folder permissions properly

❌ **DON'T:**
- Commit `.env.local` to version control
- Share your refresh token publicly
- Use the same credentials for multiple projects
- Disable OAuth consent screen verification

## Common Questions

**Q: How often do I need to regenerate the refresh token?**
A: Refresh tokens don't expire if used regularly. If your app hasn't made API calls for ~6 months, you'll need to regenerate.

**Q: Can I use the same OAuth credentials for development and production?**
A: Yes, but you need to add both redirect URIs (localhost and Vercel domain) to your OAuth consent screen.

**Q: Why do I need Google Drive API when I'm using Prisma for database?**
A: Google Drive stores the actual image files. Prisma stores metadata (URLs, face data, etc.) but the images themselves are in Google Drive.

**Q: Can I use a different cloud storage provider?**
A: Yes, but you'll need to modify `lib/googleDrive.js` to use a different API (AWS S3, Cloudinary, etc.).

## Need More Help?

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Drive API Documentation](https://developers.google.com/drive/api/guides/about-sdk)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- Check GitHub issues for this repository
