import { describe, test, expect, beforeAll, vi } from 'vitest';
import { NextResponse } from 'next/server';
import { buildPackageBeforeTests, setupTestEnvironment, MockNextRequest, setupNextResponseMocks } from './test-helpers';

/**
 * Test file for next-route-guard middleware chaining functionality.
 * These tests verify that the middleware chaining functionality works correctly
 * with other middleware in the request pipeline.
 */

// Build the package before running tests
buildPackageBeforeTests();

// Import the module after building
import * as routeGuard from '../../dist/index.js';

// Setup test environment
setupTestEnvironment();

// Setup Next.js response mocks
setupNextResponseMocks();

// Setup test route map
const testRouteMap = {
  public: ['/public', '/about'],
  protected: ['/admin', '/dashboard', '/profile']
};

describe('Middleware Chaining', () => {
  test('should chain multiple middleware functions correctly', async () => {
    // Create tracking array for middleware execution order
    const executionOrder = [];

    // Create middleware factories
    const withLogging = (next) => {
      return async (request) => {
        executionOrder.push(`Logging: ${request.nextUrl.pathname}`);
        return next(request);
      };
    };

    const withHeaders = (next) => {
      return async (request) => {
        executionOrder.push('Adding headers');
        const response = await next(request);
        if (response && response.headers) {
          response.headers.set('X-Custom-Header', 'value');
        } else if (response) {
          // If headers is undefined, add it
          response.headers = new Map([['X-Custom-Header', 'value']]);
        }
        return response;
      };
    };

    // Route guard middleware factory using the actual library
    const withRouteGuard = (next) => {
      return async (request) => {
        const middleware = routeGuard.createRouteGuardMiddleware({
          isAuthenticated: () => false, // Unauthenticated for test
          routeMap: testRouteMap,
          onUnauthenticated: (req) => {
            executionOrder.push('Auth failed');
            return NextResponse.redirect(new URL('/login', req.url));
          },
          defaultProtected: false // Defaults to public for unknown routes
        });

        // Check if protected with the actual middleware
        const response = await middleware(request);

        if (response && response.headers && response.headers.get('location')?.includes('/login')) {
          executionOrder.push('Protected route');
          return response;
        }

        executionOrder.push('Public route');
        return next(request);
      };
    };

    // Create the middleware chain
    const middleware = routeGuard.chain([withLogging, withHeaders, withRouteGuard]);

    // Test with public route
    const publicRequest = new MockNextRequest('/public');
    await middleware(publicRequest);

    expect(executionOrder).toEqual(['Logging: /public', 'Adding headers', 'Public route']);

    // Test with protected route
    vi.clearAllMocks();
    executionOrder.length = 0; // Clear tracking array
    const protectedRequest = new MockNextRequest('/admin');
    const response = await middleware(protectedRequest);

    expect(executionOrder).toEqual(['Logging: /admin', 'Adding headers', 'Auth failed', 'Protected route']);
    expect(response.headers.get('location')).toContain('/login');
    expect(response.headers.get('X-Custom-Header')).toBe('value');
  });

  test('should propagate request modifications through the chain', async () => {
    // Create middleware that modifies the request
    const withUserId = (next) => {
      return async (request) => {
        // Add a user ID header
        request.headers.set('x-user-id', '123');
        return next(request);
      };
    };

    // Middleware that checks for the header
    const withUserCheck = (next) => {
      return async (request) => {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
          // Create a response with status 400
          const response = NextResponse.next();
          response.status = 400;
          return response;
        }
        return next(request);
      };
    };

    // Create middleware chain
    const middleware = routeGuard.chain([withUserId, withUserCheck]);

    // Test the chain
    const request = new MockNextRequest('/some-path');
    const response = await middleware(request);

    // Should pass through without error
    // Note: chain() returns undefined by default when reaching the end of the chain
    expect(response).toBeUndefined();
  });

  test('should handle custom response types in middleware chain', async () => {
    const executionOrder = [];

    // Create middleware that returns a json response
    const withJsonError = (next) => {
      return async (request) => {
        if (request.nextUrl.pathname === '/api/error') {
          executionOrder.push('Returning JSON error');
          const response = NextResponse.json({ error: 'Invalid request' });
          response.status = 400;
          return response;
        }
        executionOrder.push('Passing through');
        return next(request);
      };
    };

    // Create the middleware chain
    const middleware = routeGuard.chain([
      withJsonError,
      (next) => async (req) => {
        executionOrder.push('Should not reach here');
        return next(req);
      }
    ]);

    // Test with error path
    const errorRequest = new MockNextRequest('/api/error');
    const response = await middleware(errorRequest);

    expect(executionOrder).toEqual(['Returning JSON error']);
    expect(response.status).toBe(400);

    // Test with normal path
    executionOrder.length = 0;
    const normalRequest = new MockNextRequest('/normal');
    await middleware(normalRequest);

    expect(executionOrder).toEqual(['Passing through', 'Should not reach here']);
  });
});
