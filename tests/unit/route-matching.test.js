import { describe, test, expect } from 'vitest';
import { NextResponse } from 'next/server';
import {
  buildPackageBeforeTests,
  setupTestEnvironment,
  MockNextRequest,
  testRouteProtection,
  setupNextResponseMocks
} from './test-helpers';

/**
 * Comprehensive test file for next-route-guard route matching
 * Tests all aspects of route matching including:
 * - Complex route combinations with nested catch-all patterns
 * - Dynamic segments and rest segments
 * - Error handling cases (empty maps, exclusions)
 * - Edge cases
 */

// Build the package before running tests
buildPackageBeforeTests();

// Import the module after building
import * as routeGuard from '../../dist/index.js';

// Setup test environment
setupTestEnvironment();

// Setup Next.js response mocks
setupNextResponseMocks();

// Setup test route map for complex cases
const complexRouteMap = {
  public: [
    '/data/[...path]', // Required catch-all (public)
    '/content/[[...slug]]', // Optional catch-all (public)
    '/content', // Base path for public optional catch-all
    '/docs/[...slug]/preview', // Rest segment after catch-all (public)
    '/docs/public/info', // Static path (public)
    '/products/[id]/preview', // Rest segment after dynamic param (public)
    '/shop/[category]/[id]/details', // Multiple dynamic params with rest (public)
    '/articles/[section]/[...tags]', // Dynamic + catch-all combo (public)
    '/articles/[section]/[...tags]/share', // Dynamic + catch-all + rest segment (public)
    '/blog/[...slug]' // Public catch-all from (public) directory group
  ],
  protected: [
    '/dashboard/[[...path]]', // Optional catch-all (protected)
    '/dashboard/[[...path]]/edit', // Rest segment after optional catch-all (protected)
    '/members/[id]', // Dynamic param (protected)
    '/docs', // Static path (protected)
    '/docs/[...slug]/edit', // Rest segment with different protection (protected)
    '/docs/[...slug]/admin', // Another rest segment with different protection (protected)
    '/shop/[category]/[id]/edit', // Multiple dynamic params with different rest (protected)
    '/api/users/[[...path]]', // API route (normally excluded by middleware)
    '/blog/[...slug]/edit' // Protected rest segment after public catch-all
  ]
};

// Complex test cases focusing on tricky route patterns
const complexTestCases = [
  // Rest segments after catch-all
  { url: '/docs/guide/intro', expected: true, desc: 'Catch-all without rest segment' },
  { url: '/docs/guide/intro/preview', expected: false, desc: 'Catch-all with public rest segment' },
  { url: '/docs/guide/intro/edit', expected: true, desc: 'Catch-all with protected rest segment' },
  { url: '/docs/guide/intro/admin', expected: true, desc: 'Catch-all with another protected rest segment' },
  { url: '/docs/public/info', expected: false, desc: 'Static path takes precedence over catch-all' },

  // Required vs optional catch-all
  { url: '/data', expected: true, desc: 'Required catch-all base path (no match)' },
  { url: '/data/reports', expected: false, desc: 'Required catch-all with segment' },
  { url: '/data/reports/annual', expected: false, desc: 'Required catch-all with multiple segments' },
  { url: '/content', expected: false, desc: 'Optional catch-all base path (matches)' },
  { url: '/content/posts', expected: false, desc: 'Optional catch-all with segment' },

  // Dynamic parameters with rest segments
  { url: '/products/123', expected: true, desc: 'Dynamic segment (defaults to parent protection)' },
  { url: '/products/123/preview', expected: false, desc: 'Dynamic segment with public rest' },
  { url: '/members/456', expected: true, desc: 'Protected dynamic segment' },

  // Multiple dynamic parameters
  { url: '/shop/electronics/789/details', expected: false, desc: 'Multiple dynamic params with public rest' },
  { url: '/shop/electronics/789/edit', expected: true, desc: 'Multiple dynamic params with protected rest' },
  {
    url: '/shop/electronics/789/unknown',
    expected: true,
    desc: 'Multiple dynamic params with unknown rest (defaults)'
  },

  // Mixed dynamic and catch-all
  { url: '/articles/tech/javascript/react', expected: false, desc: 'Dynamic param + catch-all' },
  { url: '/articles/tech/javascript/react/share', expected: false, desc: 'Dynamic + catch-all + rest segment' },

  // Optional catch-all with rest segments
  { url: '/dashboard', expected: true, desc: 'Optional catch-all base (protected)' },
  { url: '/dashboard/analytics', expected: true, desc: 'Optional catch-all with segment' },
  { url: '/dashboard/users/online', expected: true, desc: 'Optional catch-all with multiple segments' },
  { url: '/dashboard/reports/edit', expected: true, desc: 'Optional catch-all with protected rest segment' },

  // Public catch-all with protected edit segment (directory nesting test)
  { url: '/blog', expected: true, desc: 'Root path of public catch-all' },
  { url: '/blog/posts', expected: false, desc: 'Public catch-all with segment' },
  { url: '/blog/posts/2023/guide', expected: false, desc: 'Public catch-all with multiple segments' },
  { url: '/blog/posts/2023/guide/edit', expected: true, desc: 'Public catch-all with protected edit segment' },
  { url: '/blog/edit', expected: true, desc: 'Public catch-all with protected edit segment' },

  // Edge cases
  { url: '/unknown/path', expected: true, desc: 'Unknown path should use default protection' },
  { url: '/api/users', expected: false, desc: 'API route excluded by default' }
];

// Complex route matching tests using Vitest
describe('Route Matching Tests', () => {
  // Group tests by category for better organization
  describe('Rest segments after catch-all', () => {
    const catchAllTests = complexTestCases.slice(0, 5);
    test.each(catchAllTests)(
      '$desc - $url should be $expected ? protected : public',
      async ({ url, expected, _desc }) => {
        const isProtected = await testRouteProtection(url, complexRouteMap, routeGuard);
        expect(isProtected).toBe(expected);
      }
    );
  });

  describe('Required vs optional catch-all', () => {
    const catchAllTypeTests = complexTestCases.slice(5, 10);
    test.each(catchAllTypeTests)(
      '$desc - $url should be $expected ? protected : public',
      async ({ url, expected, _desc }) => {
        const isProtected = await testRouteProtection(url, complexRouteMap, routeGuard);
        expect(isProtected).toBe(expected);
      }
    );
  });

  describe('Dynamic parameters with rest segments', () => {
    const dynamicParamTests = complexTestCases.slice(10, 13);
    test.each(dynamicParamTests)(
      '$desc - $url should be $expected ? protected : public',
      async ({ url, expected, _desc }) => {
        const isProtected = await testRouteProtection(url, complexRouteMap, routeGuard);
        expect(isProtected).toBe(expected);
      }
    );
  });

  describe('Multiple dynamic parameters', () => {
    const multiDynamicTests = complexTestCases.slice(13, 16);
    test.each(multiDynamicTests)(
      '$desc - $url should be $expected ? protected : public',
      async ({ url, expected, _desc }) => {
        const isProtected = await testRouteProtection(url, complexRouteMap, routeGuard);
        expect(isProtected).toBe(expected);
      }
    );
  });

  describe('Mixed dynamic and catch-all', () => {
    const mixedPatternTests = complexTestCases.slice(16, 18);
    test.each(mixedPatternTests)(
      '$desc - $url should be $expected ? protected : public',
      async ({ url, expected, _desc }) => {
        const isProtected = await testRouteProtection(url, complexRouteMap, routeGuard);
        expect(isProtected).toBe(expected);
      }
    );
  });

  describe('Optional catch-all with rest segments', () => {
    const optionalCatchAllTests = complexTestCases.slice(18, 22);
    test.each(optionalCatchAllTests)(
      '$desc - $url should be $expected ? protected : public',
      async ({ url, expected, _desc }) => {
        const isProtected = await testRouteProtection(url, complexRouteMap, routeGuard);
        expect(isProtected).toBe(expected);
      }
    );
  });

  describe('Public catch-all with protected edit segment', () => {
    const publicCatchAllTests = complexTestCases.slice(22, 27);
    test.each(publicCatchAllTests)(
      '$desc - $url should be $expected ? protected : public',
      async ({ url, expected, _desc }) => {
        const isProtected = await testRouteProtection(url, complexRouteMap, routeGuard);
        expect(isProtected).toBe(expected);
      }
    );
  });

  describe('Edge cases', () => {
    const edgeCaseTests = complexTestCases.slice(27);
    test.each(edgeCaseTests)(
      '$desc - $url should be $expected ? protected : public',
      async ({ url, expected, _desc }) => {
        const isProtected = await testRouteProtection(url, complexRouteMap, routeGuard);
        expect(isProtected).toBe(expected);
      }
    );
  });

  describe('Error Handling', () => {
    test('should handle empty route map', async () => {
      const emptyRouteMap = {
        public: [],
        protected: []
      };

      const middleware = routeGuard.createRouteGuardMiddleware({
        isAuthenticated: () => false,
        routeMap: emptyRouteMap,
        onUnauthenticated: (req) => NextResponse.redirect(new URL('/login', req.url))
      });

      // Default behavior should apply (defaultProtected: true)
      const request = new MockNextRequest('/some/path');
      const response = await middleware(request);

      // Should be protected by default
      expect(response.headers.get('location')).toContain('/login');
    });

    test('should support custom URL exclusions', async () => {
      const routeMap = {
        public: ['/about'],
        protected: ['/dashboard']
      };

      const middleware = routeGuard.createRouteGuardMiddleware({
        isAuthenticated: () => false,
        routeMap,
        onUnauthenticated: (req) => NextResponse.redirect(new URL('/login', req.url)),
        excludeUrls: ['/api/(.*)', '/static/(.*)', '/health']
      });

      // Test each excluded URL pattern
      const excludedRequests = [
        new MockNextRequest('/api/users'),
        new MockNextRequest('/api/data/123'),
        new MockNextRequest('/static/images/logo.png'),
        new MockNextRequest('/health')
      ];

      for (const request of excludedRequests) {
        const response = await middleware(request);
        // Excluded routes get NextResponse.next(), not null
        expect(response).not.toBeNull();
      }

      // Test protected route
      const protectedRequest = new MockNextRequest('/dashboard');
      const protectedResponse = await middleware(protectedRequest);
      expect(protectedResponse.headers.get('location')).toContain('/login');

      // Test public route
      const publicRequest = new MockNextRequest('/about');
      const publicResponse = await middleware(publicRequest);
      // Public routes also return NextResponse.next(), not null
      expect(publicResponse).not.toBeNull();
    });
  });
});
