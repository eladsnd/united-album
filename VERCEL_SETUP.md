# Vercel Deployment Setup Guide

## Current Deployment Issue

The deployment is failing because the database is not yet configured on Vercel. Follow these steps to fix it:

## Step 1: Add Vercel Postgres

1. Go to your Vercel Dashboard: https://vercel.com/dashboard
2. Click on your project (united-album)
3. Go to the **Storage** tab
4. Click **Create Database**
5. Select **Postgres**
6. Choose a name (e.g., "united-album-db")
7. Select the **Free** plan (256MB included)
8. Click **Create**

**IMPORTANT**: Vercel will automatically set the `DATABASE_URL` environment variable to a PostgreSQL connection string. This means:
- Local development uses SQLite (`file:./dev.db`)
- Production uses PostgreSQL (auto-configured by Vercel)

## Step 2: Verify Environment Variables

After creating the database, verify these environment variables are set in your Vercel project:

1. Go to **Settings** → **Environment Variables**
2. Check that these are present:

**Auto-added by Vercel Postgres:**
- ✅ `DATABASE_URL` - PostgreSQL connection string (auto-added when you created the database)

**You need to add manually:**
- ⚠️ `GOOGLE_CLIENT_ID` - Your Google OAuth client ID
- ⚠️ `GOOGLE_CLIENT_SECRET` - Your Google OAuth client secret
- ⚠️ `GOOGLE_REFRESH_TOKEN` - Your Google OAuth refresh token
- ⚠️ `GOOGLE_DRIVE_FOLDER_ID` - Default upload folder ID
- ⚠️ `ADMIN_PASSWORD` - Admin panel password

## Step 3: Redeploy

After adding all environment variables:

1. Go to the **Deployments** tab
2. Find the failed deployment
3. Click the **⋯** menu → **Redeploy**
4. Check **Use existing Build Cache** (faster)
5. Click **Redeploy**

## What Happens During Deployment

The build script in `package.json` automatically:

```json
"build": "prisma generate && prisma migrate deploy && next build"
```

1. `prisma generate` - Generates Prisma Client
2. `prisma migrate deploy` - Runs database migrations (creates tables)
3. `next build` - Builds the Next.js app

**Important**: The migrations will automatically create all tables in your PostgreSQL database. You don't need to manually run any SQL.

## Step 4: Verify Deployment

After successful deployment:

1. Visit your deployed site URL
2. Try uploading a photo
3. Check if admin panel works at `/admin`
4. Verify face recognition is working

## Troubleshooting

### "Prisma schema validation" error
- **Cause**: DATABASE_URL not set or incorrect
- **Fix**: Make sure you created Vercel Postgres and it auto-added DATABASE_URL

### "403 Forbidden" on uploads
- **Cause**: Google OAuth credentials missing
- **Fix**: Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN

### "Admin authentication failed"
- **Cause**: ADMIN_PASSWORD not set
- **Fix**: Add ADMIN_PASSWORD environment variable

## Database Management

**View database contents:**
```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Pull DATABASE_URL from Vercel
vercel env pull .env.production

# Run Prisma Studio with production database
DATABASE_URL="<paste from .env.production>" npx prisma studio
```

**Run migrations manually (if needed):**
```bash
DATABASE_URL="<paste from .env.production>" npx prisma migrate deploy
```

## Local vs Production

| Environment | Database | Provider | URL |
|-------------|----------|----------|-----|
| **Local** | SQLite | `sqlite` | `file:./dev.db` |
| **Vercel** | PostgreSQL | `postgresql` | Auto-set by Vercel Postgres |

The schema file uses `provider = "sqlite"` for local development. When Vercel detects a PostgreSQL `DATABASE_URL`, Prisma automatically adapts. You don't need to change the schema file.

## Next Steps

Once deployment succeeds:
1. Test all features on production site
2. Share the URL with wedding guests
3. Monitor usage in Vercel Dashboard → Analytics

## Support

- Vercel Docs: https://vercel.com/docs/storage/vercel-postgres
- Prisma Docs: https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel
