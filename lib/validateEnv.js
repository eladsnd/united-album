/**
 * Environment variable validation
 * Validates required environment variables on server startup
 */

const REQUIRED_ENV_VARS = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REFRESH_TOKEN',
    'GOOGLE_DRIVE_FOLDER_ID'
];

const OPTIONAL_ENV_VARS = [
    'NODE_ENV',
    'PORT'
];

export function validateEnvironment() {
    const missing = [];
    const warnings = [];

    // Check required variables
    for (const varName of REQUIRED_ENV_VARS) {
        if (!process.env[varName]) {
            missing.push(varName);
        }
    }

    // Check optional but recommended variables
    for (const varName of OPTIONAL_ENV_VARS) {
        if (!process.env[varName]) {
            warnings.push(varName);
        }
    }

    // If any required variables are missing, fail fast
    if (missing.length > 0) {
        console.error('❌ ENVIRONMENT VALIDATION FAILED');
        console.error('Missing required environment variables:');
        missing.forEach(varName => {
            console.error(`  - ${varName}`);
        });
        console.error('\nPlease create a .env.local file with the required variables.');
        console.error('See .env.example for reference.');
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Show warnings for optional variables
    if (warnings.length > 0) {
        console.warn('⚠️  Optional environment variables not set:');
        warnings.forEach(varName => {
            console.warn(`  - ${varName}`);
        });
    }

    // Validate format of Google Drive folder ID
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (folderId && !folderId.match(/^[a-zA-Z0-9_-]{20,}$/)) {
        console.warn('⚠️  GOOGLE_DRIVE_FOLDER_ID format looks incorrect');
        console.warn('   Expected: 33+ character alphanumeric ID');
        console.warn(`   Got: ${folderId}`);
    }

    console.log('✅ Environment validation passed');
    return true;
}

// Auto-validate on import (server-side only)
if (typeof window === 'undefined') {
    try {
        validateEnvironment();
    } catch (error) {
        // Don't crash during build/test
        if (process.env.NODE_ENV !== 'test' && process.env.NEXT_PHASE !== 'phase-production-build') {
            throw error;
        }
    }
}
