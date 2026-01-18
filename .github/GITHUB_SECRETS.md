# GitHub Secrets Configuration

## Quick Reference - Copy These Values

Go to: https://github.com/eladsnd/united-album/settings/secrets/actions

Click **"New repository secret"** for each of these:

---

### Secret 1: VERCEL_ORG_ID

**Name:** `VERCEL_ORG_ID`

**Value:**
```
team_wnYPDoZGvLaXy7KF78UdDZb7
```

---

### Secret 2: VERCEL_PROJECT_ID

**Name:** `VERCEL_PROJECT_ID`

**Value:**
```
prj_wvRVwqEHisERPJUaxzIWI83yA94N
```

---

### Secret 3: VERCEL_TOKEN

**Name:** `VERCEL_TOKEN`

**Value:** Get from https://vercel.com/account/tokens

**Steps:**
1. Visit https://vercel.com/account/tokens
2. Click "Create Token"
3. Name: "GitHub Actions Deploy"
4. Scope: Full Account
5. Click "Create"
6. **Copy the token immediately** (you won't see it again!)
7. Paste it as the value for VERCEL_TOKEN secret

---

## How to Add Secrets

1. Go to https://github.com/eladsnd/united-album/settings/secrets/actions
2. Click **"New repository secret"**
3. Enter the **Name** (e.g., `VERCEL_ORG_ID`)
4. Paste the **Value** (from above)
5. Click **"Add secret"**
6. Repeat for all 3 secrets

---

## Verification

After adding all 3 secrets, you should see:
- ✅ VERCEL_ORG_ID
- ✅ VERCEL_PROJECT_ID
- ✅ VERCEL_TOKEN

Once these are added, GitHub Actions workflows will be able to deploy to Vercel automatically!
