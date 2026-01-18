/**
 * API Decorators Test Suite (TDD)
 *
 * Tests for composable API middleware decorators following the Decorator pattern.
 * These decorators eliminate 90% of API route boilerplate.
 */

import { NextResponse } from 'next/server';
import {
  withErrorHandler,
  withRateLimit,
  withAdminAuth,
  withApi,
} from '../../../lib/api/decorators';
import { applyRateLimit } from '../../../lib/rateLimit';
import { isAdminAuthenticated } from '../../../lib/adminAuth';

// Mock dependencies
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, options) => ({
      json: async () => data,
      status: options?.status || 200,
    })),
  },
}));

jest.mock('../../../lib/rateLimit');
jest.mock('../../../lib/adminAuth');

describe('API Decorators', () => {
  let mockRequest;
  let mockContext;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = new Request('http://localhost:3000/api/test');
    mockContext = {};
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('withErrorHandler', () => {
    it('should pass through successful handler responses', async () => {
      const successHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );

      const decoratedHandler = withErrorHandler(successHandler);
      const response = await decoratedHandler(mockRequest, mockContext);

      expect(successHandler).toHaveBeenCalledWith(mockRequest, mockContext);
      expect(response).toBeDefined();
    });

    it('should catch and format custom errors with statusCode', async () => {
      const errorHandler = jest.fn().mockRejectedValue({
        message: 'Custom error',
        statusCode: 400,
        code: 'CUSTOM_ERROR',
      });

      const decoratedHandler = withErrorHandler(errorHandler);
      const response = await decoratedHandler(mockRequest, mockContext);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[API Error]', expect.any(Object));
      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Custom error', code: 'CUSTOM_ERROR' },
        { status: 400 }
      );
    });

    it('should catch and format generic errors as 500', async () => {
      const errorHandler = jest.fn().mockRejectedValue(
        new Error('Unexpected error')
      );

      const decoratedHandler = withErrorHandler(errorHandler);
      const response = await decoratedHandler(mockRequest, mockContext);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Internal server error' },
        { status: 500 }
      );
    });

    it('should log errors to console', async () => {
      const error = new Error('Test error');
      const errorHandler = jest.fn().mockRejectedValue(error);

      const decoratedHandler = withErrorHandler(errorHandler);
      await decoratedHandler(mockRequest, mockContext);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[API Error]', error);
    });
  });

  describe('withRateLimit', () => {
    it('should pass through when rate limit allows', async () => {
      applyRateLimit.mockReturnValue({ allowed: true });

      const successHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );

      const decoratedHandler = withRateLimit(successHandler);
      const response = await decoratedHandler(mockRequest, mockContext);

      expect(applyRateLimit).toHaveBeenCalledWith(mockRequest, 'api');
      expect(successHandler).toHaveBeenCalledWith(mockRequest, mockContext);
    });

    it('should block when rate limit exceeded', async () => {
      const rateLimitResponse = NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );

      applyRateLimit.mockReturnValue({
        allowed: false,
        response: rateLimitResponse,
      });

      const successHandler = jest.fn();
      const decoratedHandler = withRateLimit(successHandler);
      const response = await decoratedHandler(mockRequest, mockContext);

      expect(applyRateLimit).toHaveBeenCalledWith(mockRequest, 'api');
      expect(successHandler).not.toHaveBeenCalled();
      expect(response).toBe(rateLimitResponse);
    });

    it('should accept custom limit type', async () => {
      applyRateLimit.mockReturnValue({ allowed: true });

      const successHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );

      const decoratedHandler = withRateLimit(successHandler, 'upload');
      await decoratedHandler(mockRequest, mockContext);

      expect(applyRateLimit).toHaveBeenCalledWith(mockRequest, 'upload');
    });
  });

  describe('withAdminAuth', () => {
    it('should pass through when admin is authenticated', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      const successHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );

      const decoratedHandler = withAdminAuth(successHandler);
      const response = await decoratedHandler(mockRequest, mockContext);

      expect(isAdminAuthenticated).toHaveBeenCalledWith(mockRequest);
      expect(successHandler).toHaveBeenCalledWith(mockRequest, mockContext);
    });

    it('should block when admin is not authenticated', async () => {
      isAdminAuthenticated.mockReturnValue(false);

      const successHandler = jest.fn();
      const decoratedHandler = withAdminAuth(successHandler);
      const response = await decoratedHandler(mockRequest, mockContext);

      expect(isAdminAuthenticated).toHaveBeenCalledWith(mockRequest);
      expect(successHandler).not.toHaveBeenCalled();
      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Unauthorized. Admin authentication required.' },
        { status: 401 }
      );
    });
  });

  describe('withApi (Composable Decorator)', () => {
    it('should apply only error handling by default', async () => {
      const successHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );

      const decoratedHandler = withApi(successHandler);
      const response = await decoratedHandler(mockRequest, mockContext);

      expect(successHandler).toHaveBeenCalledWith(mockRequest, mockContext);
      expect(applyRateLimit).not.toHaveBeenCalled();
      expect(isAdminAuthenticated).not.toHaveBeenCalled();
    });

    it('should apply rate limiting when specified', async () => {
      applyRateLimit.mockReturnValue({ allowed: true });

      const successHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );

      const decoratedHandler = withApi(successHandler, { rateLimit: 'upload' });
      await decoratedHandler(mockRequest, mockContext);

      expect(applyRateLimit).toHaveBeenCalledWith(mockRequest, 'upload');
      expect(successHandler).toHaveBeenCalledWith(mockRequest, mockContext);
    });

    it('should apply admin auth when specified', async () => {
      isAdminAuthenticated.mockReturnValue(true);

      const successHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );

      const decoratedHandler = withApi(successHandler, { adminOnly: true });
      await decoratedHandler(mockRequest, mockContext);

      expect(isAdminAuthenticated).toHaveBeenCalledWith(mockRequest);
      expect(successHandler).toHaveBeenCalledWith(mockRequest, mockContext);
    });

    it('should apply both rate limit and admin auth together', async () => {
      applyRateLimit.mockReturnValue({ allowed: true });
      isAdminAuthenticated.mockReturnValue(true);

      const successHandler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );

      const decoratedHandler = withApi(successHandler, {
        rateLimit: 'admin',
        adminOnly: true,
      });
      await decoratedHandler(mockRequest, mockContext);

      expect(applyRateLimit).toHaveBeenCalledWith(mockRequest, 'admin');
      expect(isAdminAuthenticated).toHaveBeenCalledWith(mockRequest);
      expect(successHandler).toHaveBeenCalledWith(mockRequest, mockContext);
    });

    it('should catch errors even with decorators applied', async () => {
      applyRateLimit.mockReturnValue({ allowed: true });
      isAdminAuthenticated.mockReturnValue(true);

      const errorHandler = jest.fn().mockRejectedValue(
        new Error('Handler error')
      );

      const decoratedHandler = withApi(errorHandler, {
        rateLimit: 'api',
        adminOnly: true,
      });
      await decoratedHandler(mockRequest, mockContext);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Internal server error' },
        { status: 500 }
      );
    });

    it('should block request when rate limit fails (even with admin auth)', async () => {
      // Rate limit fails - should block before reaching handler
      const rateLimitResponse = { json: async () => ({}) };
      applyRateLimit.mockReturnValue({ allowed: false, response: rateLimitResponse });

      const handler = jest.fn();
      const decoratedHandler = withApi(handler, {
        rateLimit: 'api',
        adminOnly: true,
      });

      const response = await decoratedHandler(mockRequest, mockContext);

      // Handler should not be called if rate limit fails
      expect(handler).not.toHaveBeenCalled();
      // Response should be the rate limit response
      expect(response).toBe(rateLimitResponse);
    });
  });

  describe('Decorator Composition', () => {
    it('should allow manual decorator composition', async () => {
      const handler = jest.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );

      applyRateLimit.mockReturnValue({ allowed: true });
      isAdminAuthenticated.mockReturnValue(true);

      // Manual composition: error -> admin -> rate limit -> handler
      const composed = withErrorHandler(
        withAdminAuth(
          withRateLimit(handler, 'upload')
        )
      );

      await composed(mockRequest, mockContext);

      expect(applyRateLimit).toHaveBeenCalled();
      expect(isAdminAuthenticated).toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
    });
  });
});
