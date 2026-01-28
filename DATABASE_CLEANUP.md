# Database Cleanup - Legacy Test Data Removed

## Issue
Legacy test poses (Kebab, Snake, Camel) from `__tests__/database/challenge.test.js` were showing in admin panel.

## Root Cause
Test fixtures leaked into development databases. Multiple database files existed:
- `./dev.db` (empty, unused)
- `./prisma/dev.db` (contained legacy data) ← **App was using this one**
- `./prisma/prisma/dev.db` (old duplicate)

## Fix Applied

1. **Deleted legacy poses from all databases:**
```sql
DELETE FROM Challenge WHERE id IN ('kebab-case-id', 'snake_case_id', 'camelCaseId');
```

2. **Consolidated to single database:**
   - Kept: `./dev.db` (as per `.env` configuration)
   - Removed: `./prisma/dev.db` and `./prisma/prisma/dev.db`

3. **Restarted dev server** to pick up clean database

## Verification

✅ Database: `SELECT COUNT(*) FROM Challenge;` returns `0`
✅ API: `GET /api/admin/poses` returns empty array
✅ Dev server restarted with clean database

## For Users Seeing Cached Data

If you still see the legacy poses in your browser:

**Hard refresh your browser:**
- **Chrome/Edge:** `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- **Firefox:** `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)
- **Safari:** `Cmd+Option+R` (Mac)

Or:
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

## Technical Notes

- Database files are `.gitignore`d (correct practice)
- App uses `DATABASE_URL` from `.env` which points to `file:./dev.db`
- Test data should never leak to dev environment (tests should use separate DB)

---

**Status:** ✅ RESOLVED  
**Verification:** Backend confirmed clean, browser cache refresh needed
