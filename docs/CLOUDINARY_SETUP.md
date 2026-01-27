# Cloudinary Setup Guide

This guide will help you migrate from Google Drive to Cloudinary for **FREE 25GB storage** with no OAuth headaches!

## Why Cloudinary?

| Feature | Cloudinary | Google Drive |
|---------|-----------|--------------|
| **Free Storage** | 25 GB | 15 GB |
| **Free Bandwidth** | 25 GB/month | Unlimited |
| **Authentication** | API Key (never expires!) ✅ | OAuth (expires every 6 months) ❌ |
| **Setup Time** | 5 minutes | 30 minutes |
| **Speed** | Very fast (CDN) | Slower |
| **Image Optimization** | Built-in ✅ | Manual |
| **Reliability** | Production-grade | Personal cloud |

**Bottom line:** More storage, simpler auth, faster performance, all FREE!

## Step 1: Sign Up for Cloudinary (2 minutes)

1. Go to [Cloudinary Free Sign Up](https://cloudinary.com/users/register/free)
2. Fill in your details (name, email, password)
3. Click **"Create Account"**
4. Verify your email address

**That's it!** No credit card required, no trial period, forever free.

## Step 2: Get Your Credentials (1 minute)

1. Go to [Cloudinary Console](https://console.cloudinary.com/)
2. You'll see your **Dashboard** with credentials:
   ```
   Cloud name: your-cloud-name
   API Key: 123456789012345
   API Secret: AbCdEfGhIjKlMnOpQrStUvWxYz
   ```
3. Click the "eye" icon to reveal your API Secret

**Keep these safe!** You'll need them in the next step.

## Step 3: Update Your `.env.local` (1 minute)

Add these lines to your `.env.local` file:

```bash
# Switch to Cloudinary
STORAGE_PROVIDER=cloudinary

# Cloudinary Credentials
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=AbCdEfGhIjKlMnOpQrStUvWxYz
```

**Replace** the values with your actual credentials from Step 2.

## Step 4: Restart Your Dev Server (10 seconds)

```bash
# Stop your dev server (Ctrl+C)
npm run dev
```

Look for this confirmation in the terminal:
```
[Storage] Initializing cloudinary adapter...
[Storage] ✓ cloudinary adapter ready
```

**That's it!** You're now using Cloudinary! 🎉

## Step 5: Test It (1 minute)

1. Go to `http://localhost:3000/admin`
2. Navigate to **Pose Challenges** tab
3. Click **"+ Add New Pose"**
4. Upload an image
5. If successful: `Pose created successfully!` ✅

Check your [Cloudinary Media Library](https://console.cloudinary.com/console/media_library) - you should see the uploaded image!

## Production Deployment (Vercel)

### Add Environment Variables to Vercel

1. Go to your Vercel Dashboard
2. Select your project
3. Navigate to **Settings** → **Environment Variables**
4. Add these variables:
   ```
   STORAGE_PROVIDER = cloudinary
   CLOUDINARY_CLOUD_NAME = your-cloud-name
   CLOUDINARY_API_KEY = 123456789012345
   CLOUDINARY_API_SECRET = AbCdEfGhIjKlMnOpQrStUvWxYz
   ```
5. Click **Save**
6. **Redeploy** your application

**Important:** Changes to environment variables require a redeploy!

## Migrating Existing Photos (Optional)

If you have existing photos in Google Drive and want to migrate them to Cloudinary:

### Option 1: Keep Both (Recommended)
- New uploads → Cloudinary
- Old photos → Still served from Google Drive
- No migration needed!

Our system handles this automatically - photos keep their original storage provider.

### Option 2: Manual Migration
1. Download all photos from Google Drive
2. Re-upload them through the admin panel
3. Old Google Drive files can be deleted

### Option 3: Automated Migration Script (Coming Soon)
We'll add a migration script that:
- Downloads from Google Drive
- Uploads to Cloudinary
- Updates database URLs
- Run with: `npm run migrate-storage`

## Switching Back to Google Drive

Want to switch back? Just change one line in `.env.local`:

```bash
STORAGE_PROVIDER=drive  # Switch back to Google Drive
```

Both providers work side-by-side! The abstraction layer handles everything.

## Advanced Features

### Image Transformations

Cloudinary supports on-the-fly image transformations:

```javascript
// In your code
const url = storage.getUrl(fileId, {
  width: 800,
  height: 600,
  crop: 'fill',
  quality: 'auto'
});
```

This generates a URL like:
```
https://res.cloudinary.com/your-cloud/image/upload/q_auto,c_fill,w_800,h_600/united-album/photo.jpg
```

Cloudinary automatically:
- Resizes the image
- Optimizes quality
- Serves from global CDN
- Caches for fast delivery

**All FREE on the free tier!**

### Face Crop Optimization

Update `/api/face-crop/[driveId]/route.js` to use Cloudinary's face detection:

```javascript
const url = storage.getUrl(fileId, {
  width: 120,
  height: 120,
  crop: 'thumb',
  gravity: 'face'  // Auto-detect and crop around faces!
});
```

No server-side processing needed - Cloudinary does it all!

## Troubleshooting

### Error: "Cloudinary credentials missing"

**Problem:** Environment variables not set correctly

**Solution:**
1. Double-check `.env.local` has all three variables:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
2. Restart dev server: `npm run dev`

### Error: "Upload failed: Invalid signature"

**Problem:** API Secret is incorrect

**Solution:**
1. Go to [Cloudinary Console](https://console.cloudinary.com/)
2. Click the "eye" icon to reveal your API Secret
3. Copy it exactly (no extra spaces!)
4. Update `.env.local`
5. Restart dev server

### Error: "No storage provider available"

**Problem:** Both Cloudinary and Google Drive credentials are missing

**Solution:**
1. Set up at least one provider (Cloudinary recommended)
2. Make sure `STORAGE_PROVIDER` matches your configured provider

### Images not showing after migration

**Problem:** URLs still pointing to old provider

**Solution:**
- Old photos keep their original URLs
- Only new uploads use the new provider
- Both work simultaneously!

If you want all photos on Cloudinary, you need to re-upload them.

## Free Tier Limits

**Cloudinary Free Forever Plan:**
- ✅ 25 GB storage
- ✅ 25 GB bandwidth/month (transfer)
- ✅ 25,000 transformations/month
- ✅ Unlimited image operations
- ✅ Free SSL
- ✅ Global CDN

**What happens if you exceed limits?**
- Storage: Can upgrade to paid plan ($99/month for 100GB)
- Bandwidth: Can upgrade or optimize images to reduce size
- Transformations: Rarely hit (25k is a lot!)

**For a wedding album (~1000 photos):**
- Storage used: ~10-15 GB (well within 25 GB limit)
- Bandwidth: Depends on views, but 25 GB = ~10,000 full photo downloads
- **Conclusion:** Free tier is MORE than enough! 🎉

## Monitoring Usage

Check your usage anytime:

1. Go to [Cloudinary Console](https://console.cloudinary.com/)
2. Click **"Reports"** in the sidebar
3. View:
   - Storage used
   - Bandwidth consumed
   - Transformations count

## Security Best Practices

✅ **DO:**
- Keep `.env.local` gitignored (already configured)
- Use strong API secrets
- Rotate credentials periodically
- Monitor usage for unexpected spikes

❌ **DON'T:**
- Commit API secrets to GitHub
- Share credentials publicly
- Use the same credentials for multiple projects
- Expose API secrets in client-side code

## Getting Help

- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [Cloudinary Support](https://support.cloudinary.com/)
- [Cloudinary Community](https://community.cloudinary.com/)
- Check GitHub issues for this repository

---

**🎉 Congratulations!** You're now using Cloudinary with 25GB free storage and zero OAuth headaches!

Got questions? Open an issue on GitHub and we'll help you out! 😊
