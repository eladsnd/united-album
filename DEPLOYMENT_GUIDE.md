# Wedding Deployment Guide - Free & Reliable

## 🎯 Your Requirements
- ✅ **Free hosting**
- ✅ **Reliable during wedding day**
- ✅ **Handle multiple guests uploading photos**
- ✅ **Face recognition working**

---

## ⚠️ CRITICAL ISSUE: Persistent Storage

**Your app has a MAJOR problem for deployment:**

Your app stores data in local JSON files (`data/photos.json`, `data/faces.json`). Most free hosting platforms use **ephemeral storage** - all data gets deleted when:
- Server restarts
- New deployment
- Server sleeps (free tier)

**This means**: All uploaded photos will be LOST! 🚨

---

## 🏆 RECOMMENDED SOLUTION: Vercel + PostgreSQL (Free)

### Why This is Best for Your Wedding

**✅ Vercel (Frontend + Backend)**
- Free tier: Perfect for events
- Next.js native support (your app!)
- Auto-scaling (handles traffic spikes)
- 100GB bandwidth/month (enough for ~200 guests)
- Global CDN (fast worldwide)

**✅ Vercel Postgres (Database)**
- Free tier: 256MB storage
- Persistent storage (data survives restarts)
- ~500 photos capacity
- ACID transactions (no data loss)

**✅ Google Drive (Photo Storage)**
- Already integrated in your app! ✅
- Unlimited storage (your Google account)
- Photos persist forever

---

## 📊 Deployment Architecture

```
┌─────────────────┐
│   Wedding Day   │
│  (200 Guests)   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│   Vercel (Free Tier)    │
│  Next.js App Hosting    │
│  - Auto-scaling         │
│  - Global CDN           │
│  - 100GB bandwidth      │
└──────┬──────────────┬───┘
       │              │
       ▼              ▼
┌─────────────┐  ┌──────────────┐
│   Vercel    │  │ Google Drive │
│  Postgres   │  │  (Photos)    │
│  (Metadata) │  │   Unlimited  │
│   256MB     │  │              │
└─────────────┘  └──────────────┘
```

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Migrate from JSON Files to Database (REQUIRED)

**Why**: JSON files will be deleted on Vercel. You MUST use a database.

I'll need to create database migrations for:
- `photos` table (metadata)
- `faces` table (face descriptors)
- `challenges` table (pose challenges)

**Time needed**: 2-3 hours to refactor

### Step 2: Sign up for Vercel

1. Go to https://vercel.com
2. Sign up with GitHub (free)
3. Import your repository
4. Vercel auto-detects Next.js ✅

### Step 3: Add Vercel Postgres Database

1. In Vercel dashboard → Storage → Create Database
2. Choose "Postgres" → Free tier (256MB)
3. Copy connection string to `.env`

### Step 4: Set Environment Variables

In Vercel dashboard → Settings → Environment Variables:

```
GOOGLE_CLIENT_ID=your_value
GOOGLE_CLIENT_SECRET=your_value
GOOGLE_REFRESH_TOKEN=your_value
GOOGLE_DRIVE_FOLDER_ID=your_value
ADMIN_PASSWORD=your_value
POSTGRES_URL=auto_filled_by_vercel
```

### Step 5: Deploy

```bash
git push origin main
```

Vercel auto-deploys on every push! 🎉

---

## 💰 FREE TIER LIMITS (Vercel + Postgres)

| Resource | Free Tier | Your Wedding Needs | ✅/❌ |
|----------|-----------|-------------------|-------|
| **Bandwidth** | 100GB/month | ~20GB (200 guests) | ✅ |
| **Database Storage** | 256MB | ~50MB (500 photos metadata) | ✅ |
| **Database Rows** | Unlimited | ~1000 rows | ✅ |
| **Photo Storage** | Google Drive (unlimited) | Your Google account | ✅ |
| **Concurrent Users** | Unlimited | 50-100 at wedding | ✅ |
| **Uptime** | 99.9% | Wedding day critical | ✅ |
| **Cold Starts** | None (always warm) | Must be instant | ✅ |

**Verdict**: ✅ **Free tier is PERFECT for your wedding**

---

## 🔥 CRITICAL: Pre-Wedding Testing

### 2 Weeks Before Wedding

1. **Deploy to Vercel**
2. **Run stress test** (simulate 50 concurrent uploads)
3. **Test face recognition** on production
4. **Verify Google Drive integration**
5. **Test admin panel**
6. **Check mobile responsiveness**

### 1 Week Before

1. **Final deployment freeze** (no more changes!)
2. **Share URL with close family** (beta testers)
3. **Monitor for 7 days** (stability check)

### 1 Day Before

1. **DO NOT DEPLOY** (too risky!)
2. **Print QR code** with URL
3. **Have backup plan** (what if server goes down?)

---

## 🆘 BACKUP PLAN (If Vercel Fails)

### Option 1: Railway.app (Free)
- Similar to Vercel
- 5GB bandwidth/month (smaller, but works)
- PostgreSQL included
- Deploy in 5 minutes

### Option 2: Local Laptop as Server
- Run `npm start` on your laptop
- Use ngrok for public URL: `ngrok http 3000`
- **Risky**: Laptop must stay on all day
- Free ngrok tier: 1 concurrent connection (too limited)

### Option 3: Family Member's Laptop
- Same as above, but delegated
- **Problem**: Requires technical knowledge

---

## 🚨 DEPLOYMENT BLOCKERS (What You Need to Fix FIRST)

### 1. **Database Migration** (CRITICAL - 2-3 hours)
Replace JSON files with Postgres:
- `lib/photoStorage.js` → Use SQL queries
- `lib/faceStorage.js` → Use SQL queries
- `data/*.json` → Migrate to database tables

### 2. **File Locking Compatibility** (30 min)
`proper-lockfile` won't work on Vercel (ephemeral filesystem).
Solution: Use database transactions instead.

### 3. **Environment Variables** (5 min)
Ensure all secrets are in Vercel environment variables, not `.env.local`.

### 4. **Build Optimization** (30 min)
- Remove unused dependencies
- Optimize images
- Reduce bundle size

---

## 📱 ALTERNATIVE: Serverless-Friendly Architecture

If you want to AVOID database migration, consider:

**Option: Vercel + Upstash Redis** (Free)
- Upstash Redis: 10,000 requests/day (free)
- Stores metadata in Redis (key-value store)
- Photos still in Google Drive
- Fast, simple, no SQL needed

**Pros**:
- Faster to set up (1 hour vs 3 hours)
- No SQL knowledge needed
- Key-value is simpler than JSON

**Cons**:
- 10,000 requests/day limit (might hit during wedding)
- Less robust than Postgres

---

## 🎯 MY RECOMMENDATION

### For Your Wedding (Best Option)

**1. Use Vercel + Vercel Postgres** ✅
- Most reliable for wedding day
- Free tier is perfect for your needs
- Auto-scaling handles traffic spikes
- No cold starts (always instant)

**2. Migrate to Database NOW** (2-3 hours work)
- I can help you refactor the code
- Use Prisma ORM (simplifies database queries)
- Run migration script to import existing data

**3. Deploy 2 Weeks Before Wedding**
- Test with family/friends
- Monitor stability
- Fix any issues before wedding day

**4. Freeze Deployments 1 Week Before**
- No changes after this point!
- Only deploy emergency fixes
- Print QR codes with final URL

---

## 🛠️ NEXT STEPS (What I Can Help With)

**Immediate (Required for Deployment)**:
1. ✅ Migrate from JSON files to PostgreSQL (2-3 hours)
2. ✅ Replace file locking with database transactions (30 min)
3. ✅ Set up Prisma ORM (30 min)
4. ✅ Create database migration script (1 hour)
5. ✅ Test deployment on Vercel (30 min)

**Optional (Nice to Have)**:
6. Add database indexes for performance
7. Add database backups
8. Set up monitoring/alerts
9. Create wedding day runbook

---

## 💡 WEDDING DAY TIPS

### Before Ceremony
- [ ] Deploy app (should be done 2 weeks prior!)
- [ ] Print QR codes on each table
- [ ] Brief 1-2 tech-savvy friends on troubleshooting
- [ ] Have admin password ready

### During Wedding
- [ ] Monitor app every 30 min (assign someone)
- [ ] Have backup phone with mobile hotspot (if WiFi fails)
- [ ] Keep laptop nearby with local copy (emergency backup)

### After Wedding
- [ ] Download all photos from Google Drive
- [ ] Export database as backup
- [ ] Keep app running for 1 week (guests upload late photos)

---

## ❓ QUESTIONS TO ANSWER

Before I start the database migration:

1. **When is your wedding?** (How much time do we have?)
2. **How many guests?** (Helps size the database)
3. **Do you have technical help on wedding day?** (Friend who can troubleshoot)
4. **What's your backup plan if the app fails?** (Disposable cameras? Phone numbers to text photos?)

---

## 🎉 FINAL VERDICT

**Can you deploy for free?** ✅ **YES**

**Will it work reliably during wedding?** ✅ **YES** (with database migration)

**What's the catch?** You MUST migrate from JSON files to database first (2-3 hours work).

**When should we start?** NOW - Aim to deploy 2 weeks before wedding for testing.

---

**Next Step**: Tell me when your wedding is, and I'll create a timeline for deployment! 🚀
