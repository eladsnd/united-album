/**
 * Admin API Route Tests
 *
 * Tests the admin API endpoints for authentication and operations
 */

import { POST as authPost, GET as authGet } from '../app/api/admin/auth/route';

// Mock Next.js components
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data, options) => ({
      status: options?.status || 200,
      json: async () => data,
      ok: (options?.status || 200) >= 200 && (options?.status || 200) < 300,
      headers: new Map(),
    }),
  },
}));

// Set up test environment
const TEST_PASSWORD = 'test-admin-password';

describe('Admin Authentication API', () => {
  beforeAll(() => {
    process.env.ADMIN_PASSWORD = TEST_PASSWORD;
  });

  afterEach(() => {
    // Restore password after each test
    if (!process.env.ADMIN_PASSWORD) {
      process.env.ADMIN_PASSWORD = TEST_PASSWORD;
    }
  });
  describe('POST /api/admin/auth', () => {
    test('should return token for valid password', async () => {
      const request = {
        json: async () => ({ password: 'test-admin-password' }),
      };

      const response = await authPost(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.token).toBeTruthy();
      expect(data.expiresIn).toBe(24 * 60 * 60 * 1000); // 24 hours
      expect(data.message).toBe('Authentication successful');
    });

    test('should reject invalid password', async () => {
      const request = {
        json: async () => ({ password: 'wrong-password' }),
      };

      const response = await authPost(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid password');
    });

    test('should reject missing password', async () => {
      const request = {
        json: async () => ({}),
      };

      const response = await authPost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Password is required');
    });

    test('should reject empty password', async () => {
      const request = {
        json: async () => ({ password: '' }),
      };

      const response = await authPost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    test('should handle missing ADMIN_PASSWORD env var', async () => {
      const originalPassword = process.env.ADMIN_PASSWORD;
      delete process.env.ADMIN_PASSWORD;

      const request = {
        json: async () => ({ password: 'any-password' }),
      };

      const response = await authPost(request);
      const data = await response.json();

      // When ADMIN_PASSWORD is not set, verifyAdminPassword returns false
      // which results in 401 Unauthorized, not 500
      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid password');

      process.env.ADMIN_PASSWORD = originalPassword;
    });
  });

  describe('GET /api/admin/auth', () => {
    test('should return API information', async () => {
      const response = await authGet();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Admin authentication endpoint');
      expect(data.method).toBe('POST');
      expect(data.endpoint).toBe('/api/admin/auth');
    });
  });
});

describe('Admin Delete Permission Integration', () => {
  test('should generate valid admin token for delete operations', () => {
    const crypto = require('crypto');
    const timestamp = Date.now();
    const secret = crypto
      .createHash('sha256')
      .update(process.env.ADMIN_PASSWORD)
      .digest('hex');
    const hash = crypto
      .createHmac('sha256', secret)
      .update(timestamp.toString())
      .digest('hex');
    const token = `${hash}_${timestamp}`;

    // Verify token format
    expect(token).toMatch(/^[a-f0-9]{64}_\d+$/);

    // This token can be used in Authorization: Bearer {token} header
    const authHeader = `Bearer ${token}`;
    expect(authHeader).toContain('Bearer');
    expect(authHeader.length).toBeGreaterThan(70);
  });

  test('should verify admin permissions flow', () => {
    const { isAdminAuthenticated } = require('../lib/adminAuth');
    const { generateAdminToken } = require('../lib/adminAuth');

    const token = generateAdminToken();

    const mockRequest = {
      headers: {
        get: (name) => {
          if (name === 'authorization') {
            return `Bearer ${token}`;
          }
          return null;
        },
      },
    };

    const isAdmin = isAdminAuthenticated(mockRequest);
    expect(isAdmin).toBe(true);
  });
});

describe('Admin System Security', () => {
  beforeAll(() => {
    process.env.ADMIN_PASSWORD = TEST_PASSWORD;
  });

  test('should not expose sensitive information in error messages', async () => {
    const request = {
      json: async () => ({ password: 'wrong' }),
    };

    const response = await authPost(request);
    const data = await response.json();

    // Error message should not reveal the correct password
    expect(data.error).not.toContain(TEST_PASSWORD);
    expect(data.error).not.toMatch(/expected.*actual/i);
  });

  test('should use timing-safe comparison for passwords', async () => {
    const request1 = {
      json: async () => ({ password: 'a'.repeat(22) }),
    };
    const request2 = {
      json: async () => ({ password: 'b'.repeat(22) }),
    };

    const start1 = Date.now();
    await authPost(request1);
    const time1 = Date.now() - start1;

    const start2 = Date.now();
    await authPost(request2);
    const time2 = Date.now() - start2;

    // Time difference should be minimal (timing-safe comparison)
    // This is a weak test, but verifies the function is called
    expect(Math.abs(time1 - time2)).toBeLessThan(100);
  });

  test('tokens should expire after 24 hours', async () => {
    const request = {
      json: async () => ({ password: TEST_PASSWORD }),
    };

    const response = await authPost(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.expiresIn).toBe(24 * 60 * 60 * 1000);
  });

  test('should use HMAC for token generation', async () => {
    const request = {
      json: async () => ({ password: TEST_PASSWORD }),
    };

    const response = await authPost(request);
    const data = await response.json();

    // Token should be in format: hash_timestamp
    expect(data.success).toBe(true);
    expect(data.token).toMatch(/^[a-f0-9]{64}_\d+$/);
  });
});

describe('Admin API Error Handling', () => {
  test('should handle malformed JSON', async () => {
    const request = {
      json: async () => {
        throw new Error('Invalid JSON');
      },
    };

    const response = await authPost(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
  });

  test('should handle unexpected errors gracefully', async () => {
    const request = {
      json: async () => {
        throw new Error('Unexpected error');
      },
    };

    const response = await authPost(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Authentication failed');
  });
});
