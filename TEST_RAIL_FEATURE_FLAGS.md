# Test Rail: Feature Flag System

**Branch**: `docs/improve-claude-md` (or current branch)
**Target**: `main`
**Date**: 2026-01-26

This document provides a comprehensive testing checklist for the new Feature Flag System before merging to main.

---

## Prerequisites

- [ ] Database migrated successfully (`npx prisma db push` completed without errors)
- [ ] Migration script executed (`node scripts/migrateFeatureFlags.js`)
- [ ] Dev server running (`npm run dev`)
- [ ] Admin credentials available

---

## 1. Database & Schema Tests

### 1.1 AppSettings Model
- [ ] **Verify schema changes**
  ```bash
  npx prisma studio
  # Navigate to AppSettings table
  # Verify fields: gamification, events, faceDetection, photoLikes, bulkUpload
  ```

- [ ] **Check default values**
  - [ ] Single `app_settings` record exists
  - [ ] `gamification`: false
  - [ ] `events`: true
  - [ ] `faceDetection`: true
  - [ ] `photoLikes`: true
  - [ ] `bulkUpload`: true

### 1.2 Migration Script
- [ ] **Run migration script again** (should be idempotent)
  ```bash
  node scripts/migrateFeatureFlags.js
  ```
  - [ ] No errors thrown
  - [ ] Preserves existing flag values
  - [ ] Displays final state correctly

---

## 2. Backend Service Layer Tests

### 2.1 FeatureFlagService

Create test file: `__tests__/lib/services/FeatureFlagService.test.js`

- [ ] **Test `isEnabled(feature)`**
  - [ ] Returns `true` for enabled features
  - [ ] Returns `false` for disabled features
  - [ ] Returns `false` for non-existent features
  - [ ] Caching works (doesn't query DB on second call within 30s)

- [ ] **Test `getAllFlags()`**
  - [ ] Returns all 5 feature flags
  - [ ] Returns correct boolean values
  - [ ] Doesn't include timestamps/id

- [ ] **Test `updateFlag(feature, value)`**
  - [ ] Updates single flag successfully
  - [ ] Invalidates cache after update
  - [ ] Logs update message
  - [ ] Returns updated settings

- [ ] **Test `updateFlags(updates)`**
  - [ ] Updates multiple flags at once
  - [ ] Invalidates cache
  - [ ] Returns updated settings

### 2.2 AppSettingsRepository

Create test file: `__tests__/lib/repositories/AppSettingsRepository.test.js`

- [ ] **Test `getSettings()`**
  - [ ] Auto-creates settings if not exists
  - [ ] Returns existing settings
  - [ ] Includes all feature flags

- [ ] **Test `updateSettings(updates)`**
  - [ ] Updates partial settings
  - [ ] Preserves unchanged fields

- [ ] **Test `getFeatureFlag(name)`**
  - [ ] Returns correct boolean value
  - [ ] Returns false for non-existent flags

- [ ] **Test `setFeatureFlag(name, value)`**
  - [ ] Updates specific flag
  - [ ] Returns updated settings

- [ ] **Test backward compatibility methods**
  - [ ] `isGamifyModeEnabled()` works
  - [ ] `toggleGamifyMode()` works

### 2.3 GamificationService Refactor

- [ ] **Test gamification feature check**
  - [ ] `isGamifyModeEnabled()` uses FeatureFlagService
  - [ ] Points not awarded when gamification disabled
  - [ ] Points awarded when gamification enabled

---

## 3. API Endpoint Tests

### 3.1 Public Features API (`/api/features`)

**Manual Testing**:
```bash
# Get all features
curl http://localhost:3000/api/features

# Get specific feature
curl http://localhost:3000/api/features?feature=gamification
```

- [ ] **GET /api/features**
  - [ ] Returns all feature flags
  - [ ] Response format: `{ success: true, data: { gamification: false, ... } }`
  - [ ] No authentication required

- [ ] **GET /api/features?feature=gamification**
  - [ ] Returns specific feature
  - [ ] Response format: `{ success: true, data: { feature: "gamification", enabled: false } }`

### 3.2 Admin Settings API (`/api/admin/settings`)

**Manual Testing**:
```bash
# Get settings (requires admin token)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/admin/settings

# Update settings
curl -X PUT \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"gamification": true}' \
  http://localhost:3000/api/admin/settings
```

- [ ] **GET /api/admin/settings**
  - [ ] Requires admin authentication
  - [ ] Returns all feature flags (not full settings object)
  - [ ] Returns 401 without token

- [ ] **PUT /api/admin/settings**
  - [ ] Updates single flag
  - [ ] Updates multiple flags
  - [ ] Returns updated flags
  - [ ] Returns 401 without token

### 3.3 Feature-Gated APIs

#### Gamification (`/api/leaderboard`)

- [ ] **When gamification ENABLED**
  - [ ] GET /api/leaderboard returns leaderboard data
  - [ ] Response includes leaderboard array

- [ ] **When gamification DISABLED**
  - [ ] GET /api/leaderboard returns empty response
  - [ ] Response: `{ success: true, data: { gamification: false, data: [] } }`

#### Events APIs

**Disable events feature first**, then test:

- [ ] **GET /api/admin/events**
  - [ ] Returns message about feature being disabled
  - [ ] No error thrown

- [ ] **POST /api/admin/events**
  - [ ] Returns message about feature being disabled
  - [ ] Doesn't create event

- [ ] **GET /api/admin/events/[eventId]**
  - [ ] Returns message about feature being disabled

- [ ] **PUT /api/admin/events/[eventId]**
  - [ ] Returns message about feature being disabled

- [ ] **DELETE /api/admin/events/[eventId]**
  - [ ] Returns message about feature being disabled

- [ ] **POST /api/admin/events/auto-detect**
  - [ ] Returns message about feature being disabled

- [ ] **POST /api/admin/events/[eventId]/assign**
  - [ ] Returns message about feature being disabled

**Re-enable events feature**, then verify all endpoints work normally.

#### Photo Likes (`/api/photos/[photoId]/like`)

**Disable photoLikes feature first**, then test:

- [ ] **POST /api/photos/[photoId]/like**
  - [ ] Returns message about feature being disabled
  - [ ] Doesn't create like

- [ ] **GET /api/photos/[photoId]/like**
  - [ ] Returns message about feature being disabled

**Re-enable photoLikes feature**, then verify endpoints work normally.

---

## 4. Frontend Component Tests

### 4.1 FeatureFlagPanel Component

**Access**: http://localhost:3000/admin → "Feature Flags" tab

- [ ] **Visual Rendering**
  - [ ] All 5 features displayed with correct icons:
    - [ ] Gamification (Sparkles, orange)
    - [ ] Events (Calendar, blue)
    - [ ] Face Detection (ScanFace, purple)
    - [ ] Photo Likes (Heart, pink)
    - [ ] Bulk Upload (Upload, green)
  - [ ] Toggle buttons show current state (ON/OFF)
  - [ ] Descriptions are clear

- [ ] **Toggle Functionality**
  - [ ] Click toggle → button shows "Updating..."
  - [ ] State updates after API call completes
  - [ ] Visual toggle switches immediately
  - [ ] No page refresh needed

- [ ] **Error Handling**
  - [ ] Logout and try to access → redirected to login
  - [ ] Network error → graceful handling

### 4.2 Leaderboard Component

- [ ] **When gamification ENABLED**
  - [ ] Leaderboard renders on homepage
  - [ ] Shows top scorers
  - [ ] Auto-refreshes every 30 seconds

- [ ] **When gamification DISABLED**
  - [ ] Leaderboard does NOT render
  - [ ] No errors in console
  - [ ] Component unmounts cleanly

### 4.3 BulkUpload Component

**Access**: Component that shows bulk upload UI

- [ ] **When bulkUpload ENABLED**
  - [ ] Upload interface renders normally
  - [ ] File selection works
  - [ ] Upload process works

- [ ] **When bulkUpload DISABLED**
  - [ ] Shows "Bulk Upload Disabled" message
  - [ ] Warning icon displayed
  - [ ] No upload interface shown
  - [ ] No errors in console

### 4.4 useFeatureFlag Hook

Create test component:
```javascript
function TestComponent() {
  const { enabled, loading } = useFeatureFlag('gamification');
  return <div>{loading ? 'Loading...' : `Enabled: ${enabled}`}</div>;
}
```

- [ ] **Initial Load**
  - [ ] Shows loading state briefly
  - [ ] Fetches flag from API
  - [ ] Displays correct value

- [ ] **Auto-Refresh**
  - [ ] Toggle flag in admin panel
  - [ ] Component updates within 60 seconds (without page refresh)

- [ ] **Multiple Instances**
  - [ ] Multiple components using same flag don't conflict
  - [ ] All update when flag changes

---

## 5. Integration Tests

### 5.1 Admin Workflow

1. [ ] **Login to Admin Panel**
   - Navigate to http://localhost:3000/admin
   - Enter admin password
   - Verify successful login

2. [ ] **Navigate to Feature Flags Tab**
   - Click "Feature Flags" tab
   - Verify all 5 features displayed
   - Check current states match database

3. [ ] **Toggle Features On/Off**
   - Disable gamification → verify leaderboard disappears from homepage
   - Enable gamification → verify leaderboard appears
   - Disable events → verify event APIs return disabled message
   - Enable events → verify event APIs work again
   - Disable photoLikes → verify like buttons hidden/disabled
   - Enable photoLikes → verify like buttons work
   - Disable bulkUpload → verify upload UI shows disabled message
   - Enable bulkUpload → verify upload UI works

4. [ ] **Bulk Toggle**
   - Disable all features except events
   - Verify all UIs update correctly
   - Re-enable all features

### 5.2 Guest User Workflow

1. [ ] **Access Homepage** (http://localhost:3000)
   - [ ] Leaderboard shows when gamification enabled
   - [ ] Leaderboard hidden when gamification disabled

2. [ ] **Upload Photo**
   - [ ] Can upload when bulkUpload enabled
   - [ ] See disabled message when bulkUpload disabled

3. [ ] **Like Photos**
   - [ ] Can like/unlike when photoLikes enabled
   - [ ] Like buttons disabled when photoLikes disabled

### 5.3 Face Detection Flow

- [ ] **When faceDetection ENABLED**
  - [ ] Face detection runs on upload
  - [ ] Photos organized by faces
  - [ ] Face gallery works

- [ ] **When faceDetection DISABLED**
  - [ ] Photos still upload (without face detection)
  - [ ] Face gallery shows all photos or disabled message
  - [ ] No face detection errors

---

## 6. Edge Cases & Error Scenarios

### 6.1 Database Errors

- [ ] **Simulate DB connection failure**
  - [ ] Feature flag APIs return 500 error
  - [ ] Frontend shows graceful error message
  - [ ] No app crash

### 6.2 Cache Invalidation

- [ ] **Update flag via API**
  - [ ] Cache invalidated immediately
  - [ ] Next read gets fresh value from DB

- [ ] **Multiple concurrent updates**
  - [ ] Last update wins
  - [ ] No race conditions
  - [ ] Cache properly invalidated

### 6.3 Invalid Feature Names

- [ ] **Request non-existent feature**
  ```bash
  curl http://localhost:3000/api/features?feature=nonexistent
  ```
  - [ ] Returns `enabled: false`
  - [ ] No error thrown

### 6.4 Session & Authentication

- [ ] **Admin session expires**
  - [ ] Redirected to login
  - [ ] Can re-authenticate
  - [ ] Feature flags preserved

- [ ] **Invalid admin token**
  - [ ] 401 error for admin endpoints
  - [ ] Public endpoints still work

---

## 7. Performance Tests

### 7.1 Caching

- [ ] **First call to isEnabled()**
  - [ ] Queries database
  - [ ] Caches result for 30 seconds

- [ ] **Subsequent calls within 30s**
  - [ ] Returns from cache (no DB query)
  - [ ] Fast response time (<1ms)

- [ ] **After cache expiry (30s)**
  - [ ] Queries database again
  - [ ] Updates cache

### 7.2 API Response Times

- [ ] **GET /api/features**
  - [ ] Response time <100ms
  - [ ] Handles 10 concurrent requests

- [ ] **PUT /api/admin/settings**
  - [ ] Response time <200ms
  - [ ] Updates database successfully

---

## 8. Backward Compatibility

### 8.1 Legacy Code Paths

- [ ] **GamificationService.isGamifyModeEnabled()**
  - [ ] Still works (deprecated but functional)
  - [ ] Returns correct value

- [ ] **AppSettingsRepository.toggleGamifyMode()**
  - [ ] Still works (deprecated but functional)
  - [ ] Updates gamification flag

### 8.2 Data Migration

- [ ] **Existing production data**
  - [ ] Migration script handles existing settings
  - [ ] Preserves gamifyMode → gamification mapping
  - [ ] Doesn't overwrite manual changes

---

## 9. Code Quality Checks

### 9.1 Linting

```bash
npm run lint
```

- [ ] No linting errors in new files:
  - [ ] lib/services/FeatureFlagService.js
  - [ ] lib/api/featureDecorators.js
  - [ ] lib/hooks/useFeatureFlag.js
  - [ ] lib/utils/featureValidators.js
  - [ ] app/api/features/route.js
  - [ ] components/FeatureFlagPanel.js

### 9.2 Code Review Checklist

- [ ] No console.log() in production code (only console.error)
- [ ] All imports use correct paths
- [ ] No hardcoded values (use constants)
- [ ] Error handling in all async functions
- [ ] Proper JSDoc comments
- [ ] No duplicate code

---

## 10. Documentation Verification

- [ ] **CLAUDE.md updated**
  - [ ] Feature flag system documented
  - [ ] Usage examples provided
  - [ ] Architecture section updated

- [ ] **README updated** (if applicable)
  - [ ] Feature flags mentioned
  - [ ] Admin panel documented

- [ ] **API documentation**
  - [ ] /api/features documented
  - [ ] /api/admin/settings updated

---

## 11. Pre-Merge Checklist

### 11.1 Git

- [ ] All changes committed
- [ ] Commit messages clear and descriptive
- [ ] No merge conflicts with main
- [ ] Branch up-to-date with main

### 11.2 Build & Deploy

```bash
npm run build
```

- [ ] Build succeeds without errors
- [ ] No TypeScript errors (if applicable)
- [ ] No missing dependencies

### 11.3 Test Suite

```bash
npm test
npm run test:e2e
```

- [ ] All existing tests pass
- [ ] New tests added for feature flags
- [ ] Test coverage acceptable

---

## 12. Final Verification

### 12.1 Clean Install Test

```bash
# Simulate fresh production deployment
rm -rf node_modules
rm package-lock.json
npm install
npx prisma generate
npx prisma db push
node scripts/migrateFeatureFlags.js
npm run build
npm start
```

- [ ] Installation succeeds
- [ ] Database setup works
- [ ] Migration runs successfully
- [ ] Build completes
- [ ] App starts without errors

### 12.2 Production Readiness

- [ ] No sensitive data in code
- [ ] Environment variables documented
- [ ] Database migrations production-safe
- [ ] Rollback plan documented
- [ ] Feature flags set to safe defaults

---

## Test Execution Summary

**Date Tested**: ___________
**Tested By**: ___________
**Environment**: [ ] Local [ ] Staging [ ] Production

**Test Results**:
- Total Tests: ___ / 150+
- Passed: ___
- Failed: ___
- Skipped: ___

**Critical Issues Found**: ___________

**Approved for Merge**: [ ] Yes [ ] No

**Approver**: ___________
**Date**: ___________

---

## Quick Test Commands

```bash
# 1. Schema & Migration
npx prisma db push
node scripts/migrateFeatureFlags.js

# 2. Start Dev Server
npm run dev

# 3. Run Tests
npm test
npm run test:e2e

# 4. Lint Check
npm run lint

# 5. Build Check
npm run build

# 6. Manual Testing URLs
# - Admin Panel: http://localhost:3000/admin
# - Feature Flags API: http://localhost:3000/api/features
# - Homepage: http://localhost:3000
```

---

## Notes

- This test rail covers ~150+ test cases
- Estimated testing time: 2-3 hours for comprehensive testing
- Focus on critical paths first (sections 1-5)
- Document any issues found in GitHub Issues
- Retest after fixes before final merge

