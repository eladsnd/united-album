# Production Deployment Guide - Vercel + PostgreSQL

Complete guide to deploy United Album to Vercel with PostgreSQL database.

## Quick Start - Deployment Status ✅

**Latest Deployment**: January 2026
**Status**: Production Ready
**Database**: Vercel Postgres (PostgreSQL)
**Build Method**: `prisma db push` (bypasses migrations for fresh database)

### Recent Fixes Applied:
- ✅ Changed Prisma provider from SQLite to PostgreSQL
- ✅ Implemented `prisma db push` instead of `migrate deploy` (bypasses failed migration state)
- ✅ Removed redundant Babel config for faster builds
- ✅ Fixed "Pick a Pose Challenge" heading visibility
- ✅ All environment variables configured

---

## Prerequisites

✅ GitHub repository with latest code pushed
✅ Vercel account (free tier works)
✅ All environment variables from `.env.local`
✅ Google Drive API credentials configured

## Step 1: Push Latest Code to GitHub

```bash
# Ensure all changes are committed
git status

# Push to main branch
git push origin main
```

## Step 2: Create Vercel Project

### Option A: Via Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (leave default)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)
5. **IMPORTANT**: Do NOT deploy yet - add environment variables first

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Link project (from project root)
vercel link

# Follow prompts to link to existing project
```

## Step 3: Add Vercel Postgres Database

**CRITICAL**: Add the database BEFORE adding environment variables.

1. In Vercel dashboard, go to your project
2. Click **"Storage"** tab
3. Click **"Create Database"**
4. Select **"Postgres"**
5. Choose database name (e.g., `united-album-db`)
6. Select region closest to your users
7. Click **"Create"**

Vercel will automatically add these environment variables:
- `DATABASE_URL` (PostgreSQL connection string)
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`

## Step 4: Add Environment Variables

Go to **Settings** → **Environment Variables** and add these:

### Required Variables (5 total)

| Variable | Value Source | Note |
|----------|-------------|------|
| `GOOGLE_CLIENT_ID` | From `.env.local` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | From `.env.local` | Google OAuth Client Secret |
| `GOOGLE_REFRESH_TOKEN` | From `.env.local` | Google OAuth Refresh Token |
| `GOOGLE_DRIVE_FOLDER_ID` | From `.env.local` | Google Drive folder for uploads |
| `ADMIN_PASSWORD` | From `.env.local` | Admin panel access password |

**Environment**: Select **Production**, **Preview**, and **Development** for all variables.

### Auto-Added Variables (from Vercel Postgres)
- `DATABASE_URL` - Already added by Vercel Postgres
- `POSTGRES_URL` - Already added by Vercel Postgres
- `POSTGRES_PRISMA_URL` - Already added by Vercel Postgres

**Do NOT add these manually** - Vercel adds them automatically when you create the database.

## Step 5: Deploy Application

### Auto-Deploy (Recommended)

Vercel auto-deploys when you push to `main`:

```bash
git push origin main
```

Monitor deployment at: `https://vercel.com/your-username/united-album/deployments`

### Manual Deploy via CLI

```bash
# Deploy to production
vercel --prod

# Or just deploy (creates preview)
vercel
```

## Step 6: Database Schema Setup

The build process automatically runs:

```bash
prisma generate                              # Generate Prisma Client
prisma db push --accept-data-loss --skip-generate  # Sync schema to database
next build                                   # Build Next.js app
```

**Why `prisma db push` instead of migrations?**
- Bypasses failed migration states
- Directly syncs schema to fresh database
- Simpler for initial deployment
- No migration files needed

## Step 7: Verify Deployment

### Test Checklist

| Feature | Test | Expected Result |
|---------|------|-----------------|
| **Homepage** | Visit production URL | Wedding header + pose carousel loads |
| **Pose Challenges** | View carousel | 3D carousel with pose images |
| **Upload** | Upload a photo | Photo appears in Drive folder |
| **Face Detection** | Upload photo with faces | Faces detected and thumbnails created |
| **Gallery** | Click "Album Gallery" | Photos display in grid |
| **Face Filter** | Click face thumbnail | Filters to photos with that person |
| **Bulk Upload** | Upload multiple files | All files upload successfully |
| **Admin Panel** | Visit `/admin` | Password prompt appears |
| **Admin Login** | Enter admin password | Pose manager loads |
| **Admin CRUD** | Create/edit/delete pose | Operations work correctly |

### Common Issues & Solutions

#### 1. Build Fails: "Migration failed"

**Error**: `migrate found failed migrations in the target database`

**Solution**: Already fixed in latest code using `prisma db push`

```json
// package.json - Current working version
"build": "prisma generate && if [ -n \"$DATABASE_URL\" ]; then prisma db push --accept-data-loss --skip-generate; fi && next build"
```

#### 2. Build Fails: "URL must start with protocol file:"

**Error**: `the URL must start with the protocol 'file:'`

**Solution**: Already fixed - schema uses `provider = "postgresql"`

```prisma
// prisma/schema.prisma - Current working version
datasource db {
  provider = "postgresql"  // Not "sqlite"
  url      = env("DATABASE_URL")
}
```

#### 3. 403 Error on Upload

**Cause**: Missing Google Drive credentials

**Solution**: Verify all 5 environment variables are set in Vercel:
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_REFRESH_TOKEN
- GOOGLE_DRIVE_FOLDER_ID
- ADMIN_PASSWORD

#### 4. Face Detection Not Working

**Cause**: Face models not loading from CDN

**Solution**: Check browser console for model loading errors. Models are loaded from public CDN.

#### 5. Photos Not Persisting

**Cause**: Database connection issue

**Solution**:
1. Check `DATABASE_URL` is set correctly
2. Verify Vercel Postgres is active
3. Check Vercel logs for database errors

## Database Management

### View Database with Prisma Studio (Local)

```bash
# Pull DATABASE_URL from Vercel
vercel env pull .env.production

# Start Prisma Studio
DATABASE_URL="<production-url>" npx prisma studio
```

### Reset Database (CAUTION: Deletes all data)

```bash
# Connect to production database
DATABASE_URL="<production-url>" npx prisma db push --force-reset
```

### Backup Database

```bash
# Export data using Prisma Studio
# Or use pg_dump with Vercel Postgres connection string
```

## Monitoring & Logs

### View Deployment Logs

1. Go to Vercel Dashboard
2. Click your project
3. Go to **Deployments** tab
4. Click on specific deployment
5. View **Build Logs** and **Function Logs**

### View Runtime Logs

1. In Vercel Dashboard, go to your project
2. Click **Logs** tab
3. Filter by function (e.g., `/api/upload`)

### Common Log Patterns

**Successful Upload**:
```
[Photo Storage] Lock acquired for write operation
[Photo Storage] Successfully wrote to photos.json (12 total)
[Photo Storage] Lock released
```

**Face Detection**:
```
[Face Detection] Detected 3 faces in photo
[Face Service] Uploading 3 face thumbnails to Drive
```

**Database Operation**:
```
prisma:query SELECT * FROM Photo WHERE driveId = '...'
```

## Performance Optimization

### Enable Vercel Analytics (Free)

1. Go to project settings
2. Click **Analytics** tab
3. Enable **Web Analytics**

### Enable Vercel Speed Insights

1. Install package:
```bash
npm install @vercel/speed-insights
```

2. Add to layout:
```javascript
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
```

## Security Checklist

- ✅ All environment variables marked as "Sensitive"
- ✅ Admin password is strong (12+ characters)
- ✅ Google Drive folder has restricted access
- ✅ OAuth refresh token is stored securely
- ✅ Database connection uses SSL
- ✅ API routes have rate limiting

## Custom Domain (Optional)

1. Go to project **Settings** → **Domains**
2. Add your custom domain
3. Configure DNS:
   - **A Record**: Point to Vercel's IP
   - **CNAME**: Point to `cname.vercel-dns.com`
4. Wait for SSL certificate (automatic)

## Backup Strategy

### Environment Variables Backup

Run the backup script:

```bash
./scripts/backup-env-vars.sh
```

Backup saved to: `~/.wedding-app-backups/env-backup-YYYYMMDD-HHMMSS.txt`

### Database Backup

**Option 1**: Manual export via Prisma Studio

**Option 2**: Scheduled pg_dump
```bash
# Add to cron job
0 2 * * * pg_dump $DATABASE_URL > ~/backups/db-$(date +%Y%m%d).sql
```

### Google Drive Files

Photos are already backed up in Google Drive. Ensure Drive folder has:
- Regular Google Drive backups enabled
- Shared with trusted account for redundancy

## Cost Estimate (Vercel Free Tier)

| Resource | Free Tier Limit | United Album Usage | Safe? |
|----------|----------------|-------------------|-------|
| **Bandwidth** | 100 GB/month | ~2-5 GB (50 guests) | ✅ Yes |
| **Serverless Executions** | 100 GB-hrs | ~5-10 GB-hrs | ✅ Yes |
| **Build Time** | 6000 mins/month | ~10 mins/month | ✅ Yes |
| **Postgres Storage** | 256 MB | ~1-2 MB | ✅ Yes |
| **Postgres Compute** | 60 hours/month | 720 hours needed | ⚠️ Upgrade needed |

**Recommendation**: Free tier works for testing. For wedding day (500+ photos, 50+ guests), upgrade to **Pro** ($20/month) for unlimited Postgres compute.

## Post-Deployment Checklist

- [ ] Homepage loads correctly
- [ ] All pose challenges visible
- [ ] Photo upload works
- [ ] Face detection works
- [ ] Gallery filtering works
- [ ] Admin panel accessible at `/admin`
- [ ] Admin password works
- [ ] Bulk upload works
- [ ] All environment variables set
- [ ] Database tables created
- [ ] SSL certificate active
- [ ] Backups configured

## Support & Troubleshooting

**Vercel Documentation**: https://vercel.com/docs
**Prisma Documentation**: https://www.prisma.io/docs
**Next.js Documentation**: https://nextjs.org/docs

**Project Issues**: Check deployment logs first, then Vercel function logs.

---

**Deployment Date**: January 2026
**Last Updated**: January 21, 2026
**Maintainer**: Claude Code
