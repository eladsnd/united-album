/**
 * Admin Authentication Tests
 *
 * Tests for lib/adminAuth.js utilities
 */

import {
  verifyAdminPassword,
  generateAdminToken,
  verifyAdminToken,
  getTokenExpiryMs,
  isAdminAuthenticated,
} from '../lib/adminAuth';

// Set test admin password
const TEST_PASSWORD = 'test-admin-password-123';
process.env.ADMIN_PASSWORD = TEST_PASSWORD;

describe('Admin Authentication', () => {
  describe('verifyAdminPassword', () => {
    it('should return true for correct password', () => {
      expect(verifyAdminPassword(TEST_PASSWORD)).toBe(true);
    });

    it('should return false for incorrect password', () => {
      expect(verifyAdminPassword('wrong-password')).toBe(false);
    });

    it('should return false for empty password', () => {
      expect(verifyAdminPassword('')).toBe(false);
    });

    it('should return false for null password', () => {
      expect(verifyAdminPassword(null)).toBe(false);
    });

    it('should return false for undefined password', () => {
      expect(verifyAdminPassword(undefined)).toBe(false);
    });

    it('should return false for non-string password', () => {
      expect(verifyAdminPassword(123)).toBe(false);
    });
  });

  describe('generateAdminToken', () => {
    it('should generate a token', () => {
      const token = generateAdminToken();
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('should generate token in correct format (hash_timestamp)', () => {
      const token = generateAdminToken();
      const parts = token.split('_');
      expect(parts.length).toBe(2);
      expect(parts[0]).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex hash
      expect(parseInt(parts[1], 10)).toBeGreaterThan(0); // Valid timestamp
    });

    it('should generate unique tokens', () => {
      const token1 = generateAdminToken();
      // Wait 1ms to ensure different timestamp
      const start = Date.now();
      while (Date.now() === start) {} // Busy wait
      const token2 = generateAdminToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyAdminToken', () => {
    it('should verify valid token', () => {
      const token = generateAdminToken();
      expect(verifyAdminToken(token)).toBe(true);
    });

    it('should reject invalid token format', () => {
      expect(verifyAdminToken('invalid-token')).toBe(false);
    });

    it('should reject token with wrong hash', () => {
      const token = generateAdminToken();
      const [, timestamp] = token.split('_');
      const tamperedToken = `wronghash123456789012345678901234567890123456789012345678901234_${timestamp}`;
      expect(verifyAdminToken(tamperedToken)).toBe(false);
    });

    it('should reject token with tampered timestamp', () => {
      const token = generateAdminToken();
      const [hash] = token.split('_');
      const tamperedToken = `${hash}_9999999999999`;
      expect(verifyAdminToken(tamperedToken)).toBe(false);
    });

    it('should reject expired token', () => {
      // Create token with timestamp 25 hours ago
      const expiredTimestamp = Date.now() - (25 * 60 * 60 * 1000);
      const token = `somehash_${expiredTimestamp}`;
      expect(verifyAdminToken(token)).toBe(false);
    });

    it('should reject token with future timestamp', () => {
      // Create token with timestamp in future
      const futureTimestamp = Date.now() + (1000 * 60);
      const token = `somehash_${futureTimestamp}`;
      expect(verifyAdminToken(token)).toBe(false);
    });

    it('should reject empty token', () => {
      expect(verifyAdminToken('')).toBe(false);
    });

    it('should reject null token', () => {
      expect(verifyAdminToken(null)).toBe(false);
    });
  });

  describe('getTokenExpiryMs', () => {
    it('should return 24 hours in milliseconds', () => {
      const expiryMs = getTokenExpiryMs();
      expect(expiryMs).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('isAdminAuthenticated', () => {
    it('should return true for valid Bearer token', () => {
      const token = generateAdminToken();
      const request = {
        headers: {
          get: (name) => {
            if (name === 'authorization') {
              return `Bearer ${token}`;
            }
            return null;
          },
        },
      };
      expect(isAdminAuthenticated(request)).toBe(true);
    });

    it('should return false for missing Authorization header', () => {
      const request = {
        headers: {
          get: () => null,
        },
      };
      expect(isAdminAuthenticated(request)).toBe(false);
    });

    it('should return false for invalid Bearer format', () => {
      const token = generateAdminToken();
      const request = {
        headers: {
          get: (name) => {
            if (name === 'authorization') {
              return token; // Missing 'Bearer ' prefix
            }
            return null;
          },
        },
      };
      expect(isAdminAuthenticated(request)).toBe(false);
    });

    it('should return false for invalid token', () => {
      const request = {
        headers: {
          get: (name) => {
            if (name === 'authorization') {
              return 'Bearer invalid-token';
            }
            return null;
          },
        },
      };
      expect(isAdminAuthenticated(request)).toBe(false);
    });
  });
});
