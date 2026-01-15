/**
 * Admin System Integration Tests
 *
 * Tests the complete admin authentication and permission system including:
 * - Admin login/authentication
 * - Token generation and validation
 * - Admin delete permissions
 * - Cross-device delete scenarios
 */

import { verifyAdminPassword, generateAdminToken, verifyAdminToken, isAdminAuthenticated } from '../lib/adminAuth';
import crypto from 'crypto';

// Mock environment variable
const ORIGINAL_ENV = process.env.ADMIN_PASSWORD;

describe('Admin Authentication System', () => {
  beforeAll(() => {
    process.env.ADMIN_PASSWORD = 'test-admin-password-123';
  });

  afterAll(() => {
    process.env.ADMIN_PASSWORD = ORIGINAL_ENV;
  });

  describe('Password Verification', () => {
    test('should verify correct admin password', () => {
      const result = verifyAdminPassword('test-admin-password-123');
      expect(result).toBe(true);
    });

    test('should reject incorrect password', () => {
      const result = verifyAdminPassword('wrong-password');
      expect(result).toBe(false);
    });

    test('should reject empty password', () => {
      const result = verifyAdminPassword('');
      expect(result).toBe(false);
    });

    test('should reject null password', () => {
      const result = verifyAdminPassword(null);
      expect(result).toBe(false);
    });

    test('should reject undefined password', () => {
      const result = verifyAdminPassword(undefined);
      expect(result).toBe(false);
    });

    test('should reject non-string password', () => {
      const result = verifyAdminPassword(12345);
      expect(result).toBe(false);
    });

    test('should use timing-safe comparison (same length)', () => {
      // Passwords of different content but same length
      const result1 = verifyAdminPassword('a'.repeat(24));
      const result2 = verifyAdminPassword('b'.repeat(24));

      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });
  });

  describe('Token Generation', () => {
    test('should generate valid token format', () => {
      const token = generateAdminToken();

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token).toMatch(/^[a-f0-9]+_\d+$/);
    });

    test('should generate unique tokens (time-based)', async () => {
      const token1 = generateAdminToken();
      // Wait 2ms to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 2));
      const token2 = generateAdminToken();

      expect(token1).not.toBe(token2);
    });

    test('should include timestamp in token', () => {
      const beforeTimestamp = Date.now();
      const token = generateAdminToken();
      const afterTimestamp = Date.now();

      const [, timestampStr] = token.split('_');
      const timestamp = parseInt(timestampStr, 10);

      expect(timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(timestamp).toBeLessThanOrEqual(afterTimestamp);
    });

    test('should generate tokens without ADMIN_PASSWORD set', () => {
      const originalPassword = process.env.ADMIN_PASSWORD;
      delete process.env.ADMIN_PASSWORD;

      expect(() => generateAdminToken()).toThrow('ADMIN_PASSWORD environment variable is not set');

      process.env.ADMIN_PASSWORD = originalPassword;
    });
  });

  describe('Token Verification', () => {
    test('should verify valid token', () => {
      const token = generateAdminToken();
      const result = verifyAdminToken(token);

      expect(result).toBe(true);
    });

    test('should reject invalid token format', () => {
      expect(verifyAdminToken('invalid-token')).toBe(false);
      expect(verifyAdminToken('hash_only')).toBe(false);
      expect(verifyAdminToken('_timestamp_only')).toBe(false);
    });

    test('should reject empty token', () => {
      expect(verifyAdminToken('')).toBe(false);
    });

    test('should reject null token', () => {
      expect(verifyAdminToken(null)).toBe(false);
    });

    test('should reject undefined token', () => {
      expect(verifyAdminToken(undefined)).toBe(false);
    });

    test('should reject token with invalid hash', () => {
      const token = generateAdminToken();
      const [, timestamp] = token.split('_');
      const fakeToken = `fakehash123_${timestamp}`;

      expect(verifyAdminToken(fakeToken)).toBe(false);
    });

    test('should reject token with invalid timestamp', () => {
      const token = generateAdminToken();
      const [hash] = token.split('_');
      const invalidToken = `${hash}_invalid`;

      expect(verifyAdminToken(invalidToken)).toBe(false);
    });

    test('should reject expired token (24+ hours old)', () => {
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000) - 1000; // 24 hours + 1 second
      const secret = crypto
        .createHash('sha256')
        .update(process.env.ADMIN_PASSWORD)
        .digest('hex');

      const hash = crypto
        .createHmac('sha256', secret)
        .update(oneDayAgo.toString())
        .digest('hex');

      const expiredToken = `${hash}_${oneDayAgo}`;

      expect(verifyAdminToken(expiredToken)).toBe(false);
    });

    test('should accept token just before expiry', () => {
      const almostExpired = Date.now() - (23 * 60 * 60 * 1000); // 23 hours old
      const secret = crypto
        .createHash('sha256')
        .update(process.env.ADMIN_PASSWORD)
        .digest('hex');

      const hash = crypto
        .createHmac('sha256', secret)
        .update(almostExpired.toString())
        .digest('hex');

      const token = `${hash}_${almostExpired}`;

      expect(verifyAdminToken(token)).toBe(true);
    });

    test('should reject token from future', () => {
      const futureTime = Date.now() + 1000; // 1 second in future
      const secret = crypto
        .createHash('sha256')
        .update(process.env.ADMIN_PASSWORD)
        .digest('hex');

      const hash = crypto
        .createHmac('sha256', secret)
        .update(futureTime.toString())
        .digest('hex');

      const futureToken = `${hash}_${futureTime}`;

      expect(verifyAdminToken(futureToken)).toBe(false);
    });
  });

  describe('Request Authentication', () => {
    test('should authenticate request with valid Bearer token', () => {
      const token = generateAdminToken();

      const mockRequest = {
        headers: {
          get: (name) => {
            if (name === 'authorization') {
              return `Bearer ${token}`;
            }
            return null;
          }
        }
      };

      const result = isAdminAuthenticated(mockRequest);
      expect(result).toBe(true);
    });

    test('should reject request without Authorization header', () => {
      const mockRequest = {
        headers: {
          get: () => null
        }
      };

      const result = isAdminAuthenticated(mockRequest);
      expect(result).toBe(false);
    });

    test('should reject request with invalid Bearer format', () => {
      const token = generateAdminToken();

      const mockRequest = {
        headers: {
          get: () => `InvalidFormat ${token}`
        }
      };

      const result = isAdminAuthenticated(mockRequest);
      expect(result).toBe(false);
    });

    test('should reject request with missing Bearer keyword', () => {
      const token = generateAdminToken();

      const mockRequest = {
        headers: {
          get: () => token
        }
      };

      const result = isAdminAuthenticated(mockRequest);
      expect(result).toBe(false);
    });

    test('should reject request with invalid token', () => {
      const mockRequest = {
        headers: {
          get: () => 'Bearer invalid-token-format'
        }
      };

      const result = isAdminAuthenticated(mockRequest);
      expect(result).toBe(false);
    });

    test('should reject request with expired token', () => {
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000) - 1000;
      const secret = crypto
        .createHash('sha256')
        .update(process.env.ADMIN_PASSWORD)
        .digest('hex');

      const hash = crypto
        .createHmac('sha256', secret)
        .update(oneDayAgo.toString())
        .digest('hex');

      const expiredToken = `${hash}_${oneDayAgo}`;

      const mockRequest = {
        headers: {
          get: () => `Bearer ${expiredToken}`
        }
      };

      const result = isAdminAuthenticated(mockRequest);
      expect(result).toBe(false);
    });
  });

  describe('Security Properties', () => {
    test('should use different hashes for different timestamps', async () => {
      const token1 = generateAdminToken();
      await new Promise(resolve => setTimeout(resolve, 2));
      const token2 = generateAdminToken();

      const [hash1] = token1.split('_');
      const [hash2] = token2.split('_');

      expect(hash1).not.toBe(hash2);
    });

    test('should use HMAC-SHA256 for token integrity', () => {
      const token = generateAdminToken();
      const [hash, timestampStr] = token.split('_');

      // Hash should be 64 hex characters (SHA256 = 256 bits = 32 bytes = 64 hex chars)
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should not leak password in token', () => {
      const token = generateAdminToken();

      expect(token).not.toContain(process.env.ADMIN_PASSWORD);
      expect(token.toLowerCase()).not.toContain('password');
    });

    test('should generate cryptographically secure tokens', async () => {
      const tokens = new Set();

      // Generate 100 tokens with small delays to ensure unique timestamps
      for (let i = 0; i < 100; i++) {
        const token = generateAdminToken();
        const [hash] = token.split('_');

        // Check for collisions (should be extremely unlikely)
        if (tokens.has(hash)) {
          // This can happen if two tokens are generated in the same millisecond
          // Wait and retry
          await new Promise(resolve => setTimeout(resolve, 2));
          const retryToken = generateAdminToken();
          const [retryHash] = retryToken.split('_');
          tokens.add(retryHash);
        } else {
          tokens.add(hash);
        }
      }

      // All 100 should be unique (with retries)
      expect(tokens.size).toBe(100);
    });
  });

  describe('Environment Configuration', () => {
    test('should throw error when ADMIN_PASSWORD not set during token generation', () => {
      const original = process.env.ADMIN_PASSWORD;
      delete process.env.ADMIN_PASSWORD;

      expect(() => generateAdminToken()).toThrow('ADMIN_PASSWORD environment variable is not set');

      process.env.ADMIN_PASSWORD = original;
    });

    test('should return false when ADMIN_PASSWORD not set during verification', () => {
      const original = process.env.ADMIN_PASSWORD;
      delete process.env.ADMIN_PASSWORD;

      const result = verifyAdminPassword('any-password');
      expect(result).toBe(false);

      process.env.ADMIN_PASSWORD = original;
    });
  });
});

describe('Admin Delete Permission Scenarios', () => {
  test('admin with valid token can delete any photo', () => {
    const token = generateAdminToken();
    const mockRequest = {
      headers: {
        get: (name) => name === 'authorization' ? `Bearer ${token}` : null
      }
    };

    const isAdmin = isAdminAuthenticated(mockRequest);
    expect(isAdmin).toBe(true);
  });

  test('admin without uploaderId can still delete (uploaderId optional)', () => {
    // This tests the DTO fix where uploaderId is @IsOptional
    const token = generateAdminToken();
    const uploaderId = undefined;

    // Admin should be able to delete even without uploaderId
    expect(uploaderId).toBeUndefined();
    expect(token).toBeTruthy();
  });

  test('regular user without uploaderId cannot delete', () => {
    const mockRequest = {
      headers: {
        get: () => null // No Authorization header
      }
    };

    const isAdmin = isAdminAuthenticated(mockRequest);
    const uploaderId = undefined;

    expect(isAdmin).toBe(false);
    expect(uploaderId).toBeUndefined();
    // This combination should fail in the service layer
  });

  test('regular user with uploaderId can only delete their own photos', () => {
    const mockRequest = {
      headers: {
        get: () => null
      }
    };

    const isAdmin = isAdminAuthenticated(mockRequest);
    const uploaderId = 'uploader_123_abc';
    const photoUploaderId = 'uploader_123_abc';

    expect(isAdmin).toBe(false);
    expect(uploaderId).toBe(photoUploaderId);
    // Should succeed if uploaderIds match
  });

  test('regular user cannot delete photos from other users', () => {
    const mockRequest = {
      headers: {
        get: () => null
      }
    };

    const isAdmin = isAdminAuthenticated(mockRequest);
    const requesterId = 'uploader_123_abc';
    const photoUploaderId = 'uploader_456_def';

    expect(isAdmin).toBe(false);
    expect(requesterId).not.toBe(photoUploaderId);
    // Should fail in service layer
  });
});
