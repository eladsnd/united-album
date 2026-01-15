# Phase 1: Admin Authentication System - Implementation Summary

## Overview
Simple password-based authentication system for admin operations using environment variables and session tokens.

## Files Created

### 1. Environment Configuration
**File**: `.env.example` (updated)
- Added `ADMIN_PASSWORD` variable for admin authentication

### 2. Core Authentication Library
**File**: `/Users/elad_b/IdeaProjects/united-album/lib/adminAuth.js`

Exports the following utilities:

#### Functions:
- `verifyAdminPassword(password)` - Compare password against environment variable
  - Uses timing-safe comparison to prevent timing attacks
  - Returns boolean

- `generateAdminToken()` - Create session token with 24-hour expiry
  - Format: `${hash}_${timestamp}`
  - Hash created using HMAC-SHA256
  - Returns string token

- `verifyAdminToken(token)` - Validate admin session token
  - Verifies token structure
  - Validates hash integrity using HMAC
  - Checks 24-hour expiry
  - Returns boolean

- `getTokenExpiryMs()` - Get token expiry time (24 hours in milliseconds)
  - Returns number (86400000)

- `isAdminAuthenticated(request)` - Middleware helper for API routes
  - Extracts Bearer token from Authorization header
  - Validates token
  - Returns boolean

#### Security Features:
- Timing-safe comparisons prevent timing attacks
- HMAC-SHA256 for token hash generation
- Token expiry validation (24 hours)
- Cryptographically secure hash generation

### 3. Authentication API Endpoint
**File**: `/Users/elad_b/IdeaProjects/united-album/app/api/admin/auth/route.js`

#### POST /api/admin/auth
Authenticates admin users and returns session token

**Request**:
```json
{
  "password": "admin-password"
}
```

**Success Response (200)**:
```json
{
  "success": true,
  "token": "hash_timestamp",
  "expiresIn": 86400000,
  "message": "Authentication successful"
}
```

**Error Responses**:
- 400: Password missing or empty
- 401: Invalid password
- 500: Server error or admin not configured

#### GET /api/admin/auth
Returns API information (for testing/documentation)

### 4. Test Suite
**File**: `/Users/elad_b/IdeaProjects/united-album/__tests__/adminAuth.test.js`

Comprehensive test coverage (22 tests, all passing):

- Password verification (correct, incorrect, edge cases)
- Token generation (format, uniqueness)
- Token validation (valid, invalid, expired, tampered)
- Token expiry configuration
- Request authentication helper

**Test Results**: ✓ All 22 tests passing

### 5. Usage Documentation
**File**: `/Users/elad_b/IdeaProjects/united-album/lib/ADMIN_AUTH_USAGE.md`

Complete guide covering:
- Setup instructions
- Client-side implementation examples
- Server-side API route protection
- React component example
- Security best practices
- API response examples

## Implementation Details

### Token Format
```
{hash}_{timestamp}
```
- Hash: HMAC-SHA256(secret, timestamp) - 64 hex characters
- Timestamp: Unix timestamp in milliseconds
- Example: `a1b2c3d4...f5e6d7c8_1705334400000`

### Token Generation Process
1. Get current timestamp
2. Derive secret from ADMIN_PASSWORD using SHA256
3. Create HMAC-SHA256 hash of timestamp using secret
4. Combine hash and timestamp with underscore separator

### Token Verification Process
1. Parse token into hash and timestamp components
2. Validate timestamp is valid number
3. Check token age (must be < 24 hours, not future)
4. Regenerate expected hash using timestamp
5. Compare hashes using timing-safe comparison

### Security Measures
1. **Timing-Safe Comparisons**: Prevents timing attacks on password/token verification
2. **HMAC-SHA256**: Cryptographically secure hash for token integrity
3. **Token Expiry**: 24-hour automatic expiration
4. **No External Dependencies**: Uses Node.js crypto module only
5. **Session Storage**: Tokens cleared when browser closes

## Usage Example

### Client-Side Login
```javascript
const response = await fetch('/api/admin/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: 'admin-password' })
});

const { token } = await response.json();
sessionStorage.setItem('admin_token', token);
```

### Protected API Route
```javascript
import { isAdminAuthenticated } from '@/lib/adminAuth';

export async function DELETE(request) {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }
  // Admin operation here
}
```

### Making Authenticated Request
```javascript
const token = sessionStorage.getItem('admin_token');

await fetch('/api/admin/delete-photo', {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ photoId: '123' })
});
```

## Next Steps (Future Phases)

This authentication system is ready to be used for:
- Photo deletion API endpoints
- Face management operations
- Challenge administration
- Any admin-only operations

To protect a new admin endpoint:
1. Import `isAdminAuthenticated` from `@/lib/adminAuth`
2. Call it at the start of your route handler
3. Return 401 if not authenticated
4. Proceed with admin operation if authenticated

## Dependencies
- Node.js `crypto` module (built-in)
- No external authentication libraries required

## Configuration Required
Add to `.env`:
```env
ADMIN_PASSWORD=your-secure-password-here
```

**Important**: Use a strong password (12+ characters, mixed case, numbers, symbols)
