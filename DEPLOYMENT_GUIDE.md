# Production Deployment Guide - Vercel + PostgreSQL

Complete guide to deploy United Album to Vercel with PostgreSQL database.

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
5. **IMPORTANT**: Do NOT deploy yet - click "Environment Variables" first

### Option B: Via Vercel CLI

```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Initialize project (from project root)
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name: united-album (or your choice)
# - Directory: ./ (current)
# - Override settings? No
```

## Step 3: Add Environment Variables in Vercel

Go to **Project Settings → Environment Variables** and add ALL of these:

### Google Drive Credentials (REQUIRED)

```bash
# Variable Name: GOOGLE_CLIENT_ID
# Value: <your-client-id>.apps.googleusercontent.com
# Environments: Production, Preview, Development

# Variable Name: GOOGLE_CLIENT_SECRET
# Value: <your-client-secret>
# Environments: Production, Preview, Development

# Variable Name: GOOGLE_REFRESH_TOKEN
# Value: <your-refresh-token>
# Environments: Production, Preview, Development

# Variable Name: GOOGLE_DRIVE_FOLDER_ID
# Value: <your-drive-folder-id>
# Environments: Production, Preview, Development
```

### Admin Authentication (REQUIRED)

```bash
# Variable Name: ADMIN_PASSWORD
# Value: <your-admin-password>
# Environments: Production, Preview, Development
```

### Database URL (Will be added automatically by Vercel Postgres)

```bash
# Variable Name: DATABASE_URL
# Value: (Leave empty - will be auto-populated by Vercel Postgres)
# OR manually add after creating Vercel Postgres database
```

## Step 4: Enable Vercel Postgres

### Via Vercel Dashboard

1. Go to your project dashboard
2. Click **"Storage"** tab
3. Click **"Create Database"**
4. Select **"Postgres"**
5. Choose region (closest to your users)
6. Click **"Create"**
7. Vercel will automatically:
   - Create a PostgreSQL database
   - Add `DATABASE_URL` environment variable
   - Add `POSTGRES_*` helper variables

### Via Vercel CLI

```bash
# Create Postgres database
vercel postgres create united-album-db

# Link database to project
vercel link
```

## Step 5: Run Database Migrations

### Option A: Via Vercel CLI (Recommended)

```bash
# Pull environment variables (including DATABASE_URL)
vercel env pull .env.production

# Generate Prisma client
npx prisma generate

# Run migrations against production database
npx prisma migrate deploy

# Optional: Seed data if needed
# node scripts/seedProduction.js
```

### Option B: Via Vercel Dashboard

1. Go to **Project Settings → Environment Variables**
2. Copy the `DATABASE_URL` value
3. Create temporary `.env.production.local` file:
   ```bash
   DATABASE_URL="<paste-the-value-here>"
   ```
4. Run migrations:
   ```bash
   npx prisma migrate deploy
   ```
5. Delete `.env.production.local` (never commit this)

### Option C: Via GitHub Actions (Advanced)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install Vercel CLI
        run: npm i -g vercel

      - name: Pull Vercel Environment
        run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}

      - name: Build Project
        run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}

      - name: Run Migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Deploy to Vercel
        run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

## Step 6: Deploy Application

### Via Vercel Dashboard

1. Go to **Deployments** tab
2. Click **"Deploy"** or trigger automatic deployment by pushing to GitHub
3. Wait for build to complete (2-5 minutes)
4. Click on deployment URL when ready

### Via Vercel CLI

```bash
# Deploy to production
vercel --prod

# The CLI will:
# 1. Build your application
# 2. Upload build artifacts
# 3. Deploy to production domain
# 4. Output: https://united-album.vercel.app (or your custom domain)
```

## Step 7: Verify Deployment

### Check List

✅ **Environment Variables**:
```bash
# Via Vercel CLI
vercel env ls

# Should show:
# - GOOGLE_CLIENT_ID (Production, Preview, Development)
# - GOOGLE_CLIENT_SECRET (Production, Preview, Development)
# - GOOGLE_REFRESH_TOKEN (Production, Preview, Development)
# - GOOGLE_DRIVE_FOLDER_ID (Production, Preview, Development)
# - ADMIN_PASSWORD (Production, Preview, Development)
# - DATABASE_URL (Production - auto-added by Vercel Postgres)
```

✅ **Database Connection**:
```bash
# View database tables via Prisma Studio
npx prisma studio --browser none

# Or check via Vercel Dashboard → Storage → Database
```

✅ **Application Health**:
- Visit production URL: `https://your-project.vercel.app`
- Check main page loads (3D pose carousel visible)
- Try uploading a test photo
- Verify face detection works
- Check admin panel: `https://your-project.vercel.app/admin`
- Test photo likes and infinite scroll

### Test Checklist

| Feature | Test | Expected Result |
|---------|------|-----------------|
| Main Page | Visit `/` | 3D carousel with pose challenges |
| Photo Upload | Upload photo via pose challenge | Photo appears in gallery |
| Face Detection | Upload photo with faces | Faces detected and tagged |
| Face Gallery | Click face filter | Photos filtered by person |
| Photo Likes | Click heart icon | Like count increments |
| Infinite Scroll | Scroll to bottom | More photos load automatically |
| Admin Login | Visit `/admin` with password | Access granted |
| Admin Poses | Create/edit/delete pose | Changes reflected immediately |
| Photo Delete | Delete photo (admin/owner) | Photo removed from gallery |
| Download Album | Click download button | ZIP file downloads |

## Step 8: Database Management (Post-Deployment)

### View Database with Prisma Studio

```bash
# Pull production DATABASE_URL
vercel env pull .env.production

# Open Prisma Studio
npx prisma studio
```

### Run Migrations (After Schema Changes)

```bash
# 1. Update schema in prisma/schema.prisma
# 2. Create migration locally
npx prisma migrate dev --name your_migration_name

# 3. Commit migration files
git add prisma/migrations/
git commit -m "feat: Add new migration"
git push origin main

# 4. Vercel will auto-deploy, but migrations won't run automatically
# 5. Manually run migrations in production:
vercel env pull .env.production
npx prisma migrate deploy
```

### Reset Database (DESTRUCTIVE)

```bash
# ⚠️  WARNING: Deletes all data!
vercel env pull .env.production
npx prisma migrate reset
```

## Troubleshooting

### Issue 1: Build Fails with "DATABASE_URL not found"

**Solution**: Ensure Vercel Postgres is enabled and DATABASE_URL is added to environment variables.

```bash
# Check environment variables
vercel env ls

# If DATABASE_URL missing, add manually from Vercel Dashboard → Storage → Postgres
```

### Issue 2: 401 Google Drive Errors

**Solution**: Verify Google Drive credentials are correct.

```bash
# Check environment variables in Vercel Dashboard
# Ensure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN match .env.local
```

### Issue 3: Migrations Fail with "relation already exists"

**Solution**: Database already has tables. Either:

```bash
# Option A: Drop tables and re-run migrations
# Via Vercel Dashboard → Storage → Query tab
DROP TABLE IF EXISTS "PhotoLike" CASCADE;
DROP TABLE IF EXISTS "Photo" CASCADE;
DROP TABLE IF EXISTS "Face" CASCADE;
DROP TABLE IF EXISTS "Challenge" CASCADE;

# Then run migrations
npx prisma migrate deploy

# Option B: Use migrate resolve (mark as applied)
npx prisma migrate resolve --applied <migration_name>
```

### Issue 4: Photos Don't Load After Deployment

**Solution**: Check Google Drive folder permissions.

```bash
# Ensure GOOGLE_DRIVE_FOLDER_ID has correct permissions
# Folder should be accessible by the service account/OAuth credentials
```

### Issue 5: Face Detection Not Working

**Solution**: Check model files exist in `public/models/`.

```bash
# Models should be in git and deployed
ls public/models/

# Expected files:
# - tiny_face_detector_model-*
# - ssd_mobilenetv1_model-*
# - face_landmark_68_model-*
# - face_recognition_model-*
```

## Monitoring and Logs

### View Deployment Logs

```bash
# Via CLI
vercel logs <deployment-url>

# Via Dashboard
# Go to Deployments → Click deployment → View Function Logs
```

### View Runtime Logs

```bash
# Real-time logs
vercel logs --follow

# Filter by function
vercel logs --follow /api/upload
```

### Monitor Database

```bash
# Via Vercel Dashboard
# Storage → Postgres → Insights tab shows:
# - Query performance
# - Connection pool usage
# - Storage usage
```

## Custom Domain (Optional)

### Add Custom Domain

1. Go to **Project Settings → Domains**
2. Click **"Add Domain"**
3. Enter your domain (e.g., `album.yourwedding.com`)
4. Follow DNS configuration instructions
5. Wait for DNS propagation (5-60 minutes)

### Configure DNS (Example for Cloudflare)

```
Type: CNAME
Name: album (or @)
Target: cname.vercel-dns.com
Proxy: DNS only (or Proxied)
```

## Performance Optimization

### Enable Vercel Analytics (Optional)

```bash
# Install Vercel Analytics
npm install @vercel/analytics

# Add to app/layout.js
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### Enable Vercel Speed Insights (Optional)

```bash
npm install @vercel/speed-insights

# Add to app/layout.js
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
```

## Security Checklist

- ✅ All sensitive credentials in Vercel Environment Variables (not in code)
- ✅ `.env.local` in `.gitignore`
- ✅ ADMIN_PASSWORD is strong (minimum 12 characters)
- ✅ Google Drive folder has restricted permissions
- ✅ Database has SSL enabled (Vercel Postgres default)
- ✅ HTTPS enabled (Vercel default)
- ✅ Rate limiting enabled (lib/rateLimit.js)

## Cost Estimation (Vercel Free Tier)

| Resource | Free Tier Limit | Estimated Usage |
|----------|----------------|-----------------|
| Bandwidth | 100 GB/month | ~5-10 GB (depends on traffic) |
| Serverless Function Execution | 100 GB-Hours/month | ~1-5 GB-Hours |
| Postgres Database | 256 MB storage, 60 hours compute | ~1-10 MB storage |
| Build Minutes | 6000 minutes/month | ~10-20 minutes/month |

**Estimated Monthly Cost**: $0 (within free tier for typical wedding usage)

**When to Upgrade**:
- 500+ photos uploaded
- 1000+ daily visitors
- Multiple concurrent weddings

## Backup Strategy

### Database Backups

```bash
# Export production database (weekly recommended)
vercel env pull .env.production
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore from backup (if needed)
psql $DATABASE_URL < backup_20250118.sql
```

### Google Drive Backups

Photos are already in Google Drive - ensure:
- Google Drive folder is NOT accidentally deleted
- OAuth credentials are securely stored offline
- Multiple people have access credentials (redundancy)

## Post-Deployment Checklist

- [ ] Application deployed successfully
- [ ] Database migrations completed
- [ ] All environment variables configured
- [ ] Test photo upload works
- [ ] Face detection working
- [ ] Admin panel accessible
- [ ] Photo likes persisting
- [ ] Infinite scroll loading photos
- [ ] Download album functionality works
- [ ] Custom domain configured (if applicable)
- [ ] Backup strategy in place
- [ ] Team members have access credentials

## Support Resources

- **Vercel Documentation**: https://vercel.com/docs
- **Vercel Postgres Docs**: https://vercel.com/docs/storage/vercel-postgres
- **Prisma Deployment**: https://www.prisma.io/docs/guides/deployment
- **Next.js Deployment**: https://nextjs.org/docs/deployment

---

🎉 **Deployment Complete!** Your wedding photo album is now live at `https://your-project.vercel.app`
