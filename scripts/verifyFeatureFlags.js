/**
 * Feature Flag System Verification Script
 *
 * Quick verification that the feature flag system is working correctly.
 * Run with: node scripts/verifyFeatureFlags.js
 */

import { PrismaClient } from '@prisma/client';
import { FeatureFlagService } from '../lib/services/FeatureFlagService.js';
import { AppSettingsRepository } from '../lib/repositories/AppSettingsRepository.js';

const prisma = new PrismaClient();

async function verify() {
  console.log('======================================');
  console.log('Feature Flag System Verification');
  console.log('======================================\n');

  let passed = 0;
  let failed = 0;

  try {
    // Test 1: Database Schema
    console.log('1. Checking database schema...');
    const settings = await prisma.appSettings.findUnique({
      where: { id: 'app_settings' },
    });

    if (!settings) {
      console.log('   ✗ FAILED: No settings record found');
      console.log('   → Run: node scripts/migrateFeatureFlags.js');
      failed++;
    } else if (
      settings.gamification !== undefined &&
      settings.events !== undefined &&
      settings.faceDetection !== undefined &&
      settings.photoLikes !== undefined &&
      settings.bulkUpload !== undefined
    ) {
      console.log('   ✓ PASSED: All feature flags present');
      console.log(`     - gamification: ${settings.gamification}`);
      console.log(`     - events: ${settings.events}`);
      console.log(`     - faceDetection: ${settings.faceDetection}`);
      console.log(`     - photoLikes: ${settings.photoLikes}`);
      console.log(`     - bulkUpload: ${settings.bulkUpload}`);
      passed++;
    } else {
      console.log('   ✗ FAILED: Some feature flags missing');
      failed++;
    }

    // Test 2: AppSettingsRepository
    console.log('\n2. Testing AppSettingsRepository...');
    const repo = new AppSettingsRepository();
    const repoSettings = await repo.getSettings();

    if (repoSettings && repoSettings.id === 'app_settings') {
      console.log('   ✓ PASSED: AppSettingsRepository working');
      passed++;
    } else {
      console.log('   ✗ FAILED: AppSettingsRepository not working');
      failed++;
    }

    // Test 3: AppSettingsRepository.getFeatureFlag()
    console.log('\n3. Testing getFeatureFlag() method...');
    const gamificationFlag = await repo.getFeatureFlag('gamification');

    if (typeof gamificationFlag === 'boolean') {
      console.log(`   ✓ PASSED: getFeatureFlag() returns boolean (${gamificationFlag})`);
      passed++;
    } else {
      console.log(`   ✗ FAILED: getFeatureFlag() returned ${typeof gamificationFlag}`);
      failed++;
    }

    // Test 4: FeatureFlagService
    console.log('\n4. Testing FeatureFlagService...');
    const service = new FeatureFlagService();
    const allFlags = await service.getAllFlags();

    if (
      allFlags &&
      typeof allFlags.gamification === 'boolean' &&
      typeof allFlags.events === 'boolean' &&
      typeof allFlags.faceDetection === 'boolean' &&
      typeof allFlags.photoLikes === 'boolean' &&
      typeof allFlags.bulkUpload === 'boolean'
    ) {
      console.log('   ✓ PASSED: FeatureFlagService.getAllFlags() working');
      console.log('     Flags:', allFlags);
      passed++;
    } else {
      console.log('   ✗ FAILED: FeatureFlagService.getAllFlags() not working');
      failed++;
    }

    // Test 5: FeatureFlagService.isEnabled()
    console.log('\n5. Testing isEnabled() method...');
    const gamifyEnabled = await service.isEnabled('gamification');
    const eventsEnabled = await service.isEnabled('events');

    if (
      typeof gamifyEnabled === 'boolean' &&
      typeof eventsEnabled === 'boolean'
    ) {
      console.log('   ✓ PASSED: isEnabled() returns boolean');
      console.log(`     - gamification: ${gamifyEnabled}`);
      console.log(`     - events: ${eventsEnabled}`);
      passed++;
    } else {
      console.log('   ✗ FAILED: isEnabled() not returning boolean');
      failed++;
    }

    // Test 6: Non-existent feature
    console.log('\n6. Testing non-existent feature...');
    const nonExistent = await service.isEnabled('nonExistent');

    if (nonExistent === false) {
      console.log('   ✓ PASSED: Non-existent feature returns false');
      passed++;
    } else {
      console.log(`   ✗ FAILED: Non-existent feature returned ${nonExistent}`);
      failed++;
    }

    // Test 7: Caching
    console.log('\n7. Testing caching...');
    const before = Date.now();
    await service.isEnabled('gamification'); // First call (DB query)
    await service.isEnabled('gamification'); // Second call (should use cache)
    const duration = Date.now() - before;

    if (duration < 100) {
      console.log(`   ✓ PASSED: Caching working (${duration}ms for 2 calls)`);
      passed++;
    } else {
      console.log(`   ✗ FAILED: Caching may not be working (${duration}ms)`);
      failed++;
    }

    // Test 8: Update flag (optional - only if safe)
    console.log('\n8. Testing updateFlag() [read-only check]...');
    console.log('   ℹ  Skipping write test to preserve data');
    console.log('   → Test manually in admin panel');
    // passed++; // Don't count as passed or failed

    // Summary
    console.log('\n======================================');
    console.log('Verification Summary');
    console.log('======================================');
    console.log(`Total Tests: ${passed + failed}`);
    console.log(`✓ Passed: ${passed}`);
    console.log(`✗ Failed: ${failed}`);

    if (failed === 0) {
      console.log('\n✓ All tests passed! Feature flag system is working correctly.');
      console.log('\nNext steps:');
      console.log('1. Start dev server: npm run dev');
      console.log('2. Open admin panel: http://localhost:3000/admin');
      console.log('3. Navigate to "Feature Flags" tab');
      console.log('4. Test toggling features on/off');
      console.log('5. Review TEST_RAIL_FEATURE_FLAGS.md for full test plan');
      process.exit(0);
    } else {
      console.log('\n✗ Some tests failed. Please review the errors above.');
      console.log('\nTroubleshooting:');
      console.log('- Ensure database is migrated: npx prisma db push');
      console.log('- Run migration: node scripts/migrateFeatureFlags.js');
      console.log('- Check database connection in .env.local');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n✗ ERROR:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
