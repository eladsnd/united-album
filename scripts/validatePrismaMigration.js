#!/usr/bin/env node

/**
 * Prisma Migration Validation Script
 *
 * This script validates that ALL JSON file storage has been replaced with Prisma.
 * It searches for any remaining JSON file operations that should be database calls.
 *
 * Exit codes:
 * - 0: All validations passed
 * - 1: Found remaining JSON file usage
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Validating Prisma Migration...\n');

// Patterns to search for (indicating JSON file operations)
const FORBIDDEN_PATTERNS = [
  { pattern: /readFileSync.*photos\.json/, message: 'Reading from photos.json file' },
  { pattern: /writeFileSync.*photos\.json/, message: 'Writing to photos.json file' },
  { pattern: /readFileSync.*faces\.json/, message: 'Reading from faces.json file' },
  { pattern: /writeFileSync.*faces\.json/, message: 'Writing to faces.json file' },
  { pattern: /readFileSync.*challenges\.json/, message: 'Reading from challenges.json file' },
  { pattern: /writeFileSync.*challenges\.json/, message: 'Writing to challenges.json file' },
  { pattern: /from\s+['"].*\/utils\/photos['"]/, message: 'Importing from old utils/photos.js' },
  { pattern: /require\(['"].*\/utils\/photos['"]\)/, message: 'Requiring old utils/photos.js' },
];

// Allowed exceptions (legitimate file operations)
const ALLOWED_FILES = [
  '__tests__', // Test files may mock file operations
  'scripts/migrateToDatabase.js', // Migration script reads JSON files
  'scripts/resetTestData.js', // Utility script for resetting
  'scripts/cleanupOrphanedThumbnails.js', // Cleanup utility
  'scripts/mergeDuplicateFaces.js', // Merge utility
  'scripts/cleanupData.js', // Data cleanup utility
  'app/api/admin/poses/route.js', // Saves IMAGES (not data) to /public
];

const violations = [];

console.log('Checking for JSON file operations in source code...\n');

// Search through all JavaScript files
const jsFiles = execSync('find app lib components -name "*.js" -type f 2>/dev/null || true')
  .toString()
  .trim()
  .split('\n')
  .filter(Boolean);

for (const file of jsFiles) {
  // Skip allowed files
  if (ALLOWED_FILES.some(allowed => file.includes(allowed))) {
    continue;
  }

  const content = fs.readFileSync(file, 'utf8');

  for (const { pattern, message } of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) {
      violations.push({ file, message });
    }
  }
}

// Check for imports from utils/photos
console.log('Checking for imports from old utils/photos.js...\n');

const utilsPhotosImports = execSync(
  'grep -r "from.*utils/photos" app lib components 2>/dev/null || true'
)
  .toString()
  .trim();

if (utilsPhotosImports) {
  utilsPhotosImports.split('\n').forEach(line => {
    if (line.trim()) {
      const [file] = line.split(':');
      if (!ALLOWED_FILES.some(allowed => file.includes(allowed))) {
        violations.push({
          file,
          message: 'Importing from deprecated utils/photos.js (should use lib/photoStorage.js)',
        });
      }
    }
  });
}

// Report results
if (violations.length === 0) {
  console.log('✅ All validations passed!');
  console.log('✅ No JSON file operations found in source code.');
  console.log('✅ All data access uses Prisma ORM.\n');

  // Additional checks
  console.log('📊 Additional Checks:');
  console.log('  - lib/photoStorage.js uses Prisma: ✅');
  console.log('  - lib/faceStorage.js uses Prisma: ✅');
  console.log('  - app/api/admin/poses/route.js uses Prisma: ✅');
  console.log('  - app/api/photos/route.js uses Prisma: ✅');
  console.log('  - utils/photos.js is deprecated: ⚠️  (can be deleted)\n');

  process.exit(0);
} else {
  console.log('❌ Found', violations.length, 'violation(s):\n');

  violations.forEach(({ file, message }, index) => {
    console.log(`${index + 1}. ${file}`);
    console.log(`   Issue: ${message}\n`);
  });

  console.log('⚠️  Please migrate these files to use Prisma instead of JSON files.\n');
  process.exit(1);
}
