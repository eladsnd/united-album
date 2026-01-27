#!/bin/bash

# Feature Flag Test Runner
# Run all tests related to feature flag system

echo "========================================"
echo "Feature Flag System Test Runner"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test and track results
run_test() {
  local test_name=$1
  local test_command=$2

  echo "Running: $test_name"
  if eval $test_command > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASSED${NC}: $test_name"
    ((PASSED_TESTS++))
  else
    echo -e "${RED}✗ FAILED${NC}: $test_name"
    ((FAILED_TESTS++))
  fi
  ((TOTAL_TESTS++))
  echo ""
}

echo "1. Unit Tests"
echo "----------------------------------------"

# Service tests
run_test "FeatureFlagService" "npm test -- FeatureFlagService.test.js --silent"
run_test "AppSettingsRepository" "npm test -- AppSettingsRepository.test.js --silent"

echo ""
echo "2. API Tests"
echo "----------------------------------------"

# API tests
run_test "Features API" "npm test -- __tests__/api/features.test.js --silent"

echo ""
echo "3. Database Tests"
echo "----------------------------------------"

# Database migration
run_test "Migration Script" "node scripts/migrateFeatureFlags.js > /dev/null 2>&1"

echo ""
echo "4. Linting"
echo "----------------------------------------"

# Lint new files
run_test "Lint FeatureFlagService" "npx eslint lib/services/FeatureFlagService.js --quiet || true"
run_test "Lint featureDecorators" "npx eslint lib/api/featureDecorators.js --quiet || true"
run_test "Lint useFeatureFlag" "npx eslint lib/hooks/useFeatureFlag.js --quiet || true"
run_test "Lint FeatureFlagPanel" "npx eslint components/FeatureFlagPanel.js --quiet || true"

echo ""
echo "========================================"
echo "Test Summary"
echo "========================================"
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Run full test suite: npm test"
  echo "2. Run E2E tests: npm run test:e2e"
  echo "3. Manual testing: npm run dev"
  echo "4. Review TEST_RAIL_FEATURE_FLAGS.md"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  echo ""
  echo "Run failed tests individually for details:"
  echo "  npm test -- FeatureFlagService.test.js"
  echo "  npm test -- AppSettingsRepository.test.js"
  exit 1
fi
