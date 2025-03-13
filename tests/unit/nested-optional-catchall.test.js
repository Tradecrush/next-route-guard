import { describe, test, expect } from 'vitest';
import { NextResponse } from 'next/server';
import path from 'path';
import {
  buildPackageBeforeTests,
  setupTestEnvironment,
  MockNextRequest,
  testRouteProtection,
  setupNextResponseMocks
} from './test-helpers';

/**
 * Test file specifically for nested optional catch-all routes with arbitrary depths
 * Tests scenarios like:
 * - /admin/logs/[[...slug]] matching /admin/logs and /admin/logs/any/deep/path
 * - /admin/logs/[[...slug]]/edit matching /admin/logs/edit and /admin/logs/any/deep/path/edit
 */

// Build the package before running tests
buildPackageBeforeTests();

// Import the module after building
import * as routeGuard from '../../dist/index.js';

// Define the test directory for this specific test file
const TEST_APP_DIR = path.resolve(__dirname, 'test-app-nested-optional-catchall');

// Setup test environment with the specific test directory
setupTestEnvironment(TEST_APP_DIR);

// Setup Next.js response mocks
setupNextResponseMocks();

// Setup test route map for nested optional catch-all patterns
const nestedOptionalCatchAllRouteMap = {
  public: [
    // Base path is public
    '/admin/logs',
    // Optional catch-all at various depths
    '/admin/logs/[[...slug]]',
    // Rest segment after optional catch-all
    '/admin/logs/[[...slug]]/export',
    // Another rest segment after optional catch-all
    '/dashboard/reports/[[...slug]]/share',
    // Deep nested optional catch-all
    '/something/other/thing/[[...slug]]',
    '/something/other/thing/[[...slug]]/edit/thing',
    '/something/other/thing/[[...slug]]/edit/[[...slug]]/thang',
    '/something/other/thing/[[...slug]]/edit/[[...slug]]/thang/[[...slug]]',
    // Deeply nested optional catch-all with rest segments
    '/something/other/thing/[[...slug]]/what/no',
    '/other/thing/[...slug]',
    '/other/thing/[...slug]/preview',
    '/other/thing/your/thing/[id]',
    '/other/thing/your/thing/[id]/[...slug]'
  ],
  protected: [
    // Root is protected by default
    '/',
    // Rest segment that is protected
    '/admin/logs/[[...slug]]/edit',
    // Deep nested optional catch-all with protected edit segment
    '/something/other/thing/[[...slug]]/edit',
    '/something/other/thing/[[...slug]]/edit/[[...slug]]',
    '/something/other/thing/[[...slug]]/edit/yo/[[...slug]]',
    '/something/other/thing/[[...slug]]/edit/[[...slug]]/thang/[[...slug]]/edit2',
    '/something/other/thing/[[...slug]]/what/no/this',
    '/other/thing/[...slug]/edit',
    '/other/thing/your/thing/[id]/[...slug]/edit'
  ]
};

// Test cases for nested optional catch-all patterns
const nestedOptionalCatchAllTests = [
  // Basic paths
  { url: '/admin/logs', expected: false, desc: 'Base path for nested optional catch-all' },
  { url: '/admin/logs/edit', expected: true, desc: 'Edit segment after base path should be protected' },
  { url: '/admin/logs/export', expected: false, desc: 'Export segment after base path should be public' },

  // Simple optional catch-all matches
  { url: '/admin/logs/info', expected: false, desc: 'Single segment after optional catch-all base' },
  { url: '/admin/logs/info/details', expected: false, desc: 'Multiple segments after optional catch-all base' },

  // Optional catch-all with edit segment
  { url: '/admin/logs/info/edit', expected: true, desc: 'Protected edit after optional catch-all path' },
  { url: '/admin/logs/info/details/edit', expected: true, desc: 'Protected edit after deep optional catch-all path' },
  {
    url: '/admin/logs/deeply/nested/structure/edit',
    expected: true,
    desc: 'Protected edit after very deep optional catch-all'
  },

  // Optional catch-all with export segment
  { url: '/admin/logs/info/export', expected: false, desc: 'Public export after optional catch-all path' },
  { url: '/admin/logs/info/details/export', expected: false, desc: 'Public export after deep optional catch-all' },

  // Deep nested structure tests
  { url: '/something/other/thing', expected: false, desc: 'Base path for deeply nested optional catch-all' },
  { url: '/something/other/thing/edit', expected: true, desc: 'Single segment after deeply nested base' },
  { url: '/something/other/thing/edit/thing', expected: false, desc: 'Single segment after deeply nested base' },
  { url: '/something/other/thing/edit/thang', expected: false, desc: 'Public route with segment after edit path in optional catch-all' },
  {
    url: '/something/other/thing/edit/a/b/c/d/thang',
    expected: false,
    desc: 'Public route with deep path after edit segment in optional catch-all'
  },
  {
    url: '/something/other/thing/a/b/c/d/edit/a/b/c/d/thang',
    expected: false,
    desc: 'Public route with edit in middle of complex optional catch-all path'
  },

  { url: '/something/other/thing/edit/thang/a', expected: false, desc: 'Public route with multiple segments after edit in optional catch-all' },
  {
    url: '/something/other/thing/edit/a/b/c/d/thang/a/b/c/d',
    expected: false,
    desc: 'Public route with complex path structure containing edit segment'
  },
  {
    url: '/something/other/thing/a/b/c/d/edit/a/b/c/d/thang/a/b/c/d/edit2',
    expected: true,
    desc: 'Protected route with edit2 segment at end of complex optional catch-all path'
  },

  { url: '/something/other/thing/some-value', expected: false, desc: 'Public route with one segment in optional catch-all' },
  { url: '/something/other/thing/a/b/c/d', expected: false, desc: 'Public route with multiple segments in optional catch-all' },
  { url: '/something/other/thing/a/b/c/edit', expected: true, desc: 'Protected edit segment after deeply nested path' },
  { url: '/other/thing/some-value', expected: false, desc: 'Public route with one segment in required catch-all' },
  {
    url: '/other/thing',
    expected: true,
    desc: 'Protected base path for required catch-all route (would be 404 in Next.js)'
  },
  { url: '/other/thing/a/b/c/d', expected: false, desc: 'Public route with multiple segments in required catch-all' },
  { url: '/other/thing/a/b/c/edit', expected: true, desc: 'Protected edit segment after deeply nested path' },
  { url: '/other/thing/a/b/c/preview', expected: false, desc: 'Public preview segment after deeply nested path' },
  { url: '/other/thing/your/thing/123', expected: false, desc: 'Public route with specific path pattern in required catch-all' },
  { url: '/other/thing/your/thing/123/abc', expected: false, desc: 'Public route with extended path pattern in required catch-all' },
  {
    url: '/other/thing/your/thing/123/abc/edit',
    expected: true,
    desc: 'Protected edit segment after deeply nested path'
  },

  // Very complex path with multiple segments after optional catch-all
  {
    url: '/something/other/thing/x/y/z/what/no',
    expected: false,
    desc: 'Complex path with many segments after optional catch-all'
  },
  {
    url: '/something/other/thing/x/y/z/what/no/this',
    expected: true,
    desc: 'Complex path with many segments after optional catch-all'
  },
  { url: '/something/other/thing/edit', expected: true, desc: 'Protected edit segment directly after optional catch-all base path' },

  // Dashboard reports tests
  { url: '/dashboard/reports', expected: true, desc: 'Dashboard reports base (defaults to protected)' },
  { url: '/dashboard/reports/monthly', expected: true, desc: 'Dashboard reports with one segment (no explicit rule)' },
  { url: '/dashboard/reports/monthly/share', expected: false, desc: 'Dashboard with public share segment' },
  { url: '/something/other/thing/edit/a/b/c/d', expected: true, desc: 'Single segment after deeply nested base' },
  { url: '/something/other/thing/edit/yo/a/b/c/d', expected: true, desc: 'Single segment after deeply nested base' }
];

// Tests for nested optional catch-all patterns
describe('Nested Optional Catch-All Route Tests', () => {
  describe('Basic nested optional catch-all tests', () => {
    test.each(nestedOptionalCatchAllTests.slice(0, 6))(
      '$desc - $url should be $expected ? protected : public',
      async ({ url, expected, _desc }) => {
        const isProtected = await testRouteProtection(url, nestedOptionalCatchAllRouteMap, routeGuard);
        expect(isProtected).toBe(expected);
      }
    );
  });

  describe('Optional catch-all with rest segments', () => {
    test.each(nestedOptionalCatchAllTests.slice(6, 10))(
      '$desc - $url should be $expected ? protected : public',
      async ({ url, expected, _desc }) => {
        const isProtected = await testRouteProtection(url, nestedOptionalCatchAllRouteMap, routeGuard);
        expect(isProtected).toBe(expected);
      }
    );
  });

  describe('Deep nested optional catch-all tests', () => {
    test.each(nestedOptionalCatchAllTests.slice(10, 16))(
      '$desc - $url should be $expected ? protected : public',
      async ({ url, expected, _desc }) => {
        const isProtected = await testRouteProtection(url, nestedOptionalCatchAllRouteMap, routeGuard);
        expect(isProtected).toBe(expected);
      }
    );
  });

  describe('Dashboard reports with shared segments', () => {
    test.each(nestedOptionalCatchAllTests.slice(16))(
      '$desc - $url should be $expected ? protected : public',
      async ({ url, expected, _desc }) => {
        const isProtected = await testRouteProtection(url, nestedOptionalCatchAllRouteMap, routeGuard);
        expect(isProtected).toBe(expected);
      }
    );
  });
});
