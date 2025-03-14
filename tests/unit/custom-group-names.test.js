import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  cleanTestDirectory,
  buildPackageBeforeTests,
  MockNextRequest,
  setupNextResponseMocks,
  setupTestEnvironment,
  createPageFile,
  runGenerateRoutesWithCustomPatterns
} from './test-helpers';

// Ensure package is built before running tests
buildPackageBeforeTests();

/**
 * Test file for custom group names in next-route-guard
 * Tests different combinations of custom group names using CLI options
 */

const TEST_APP_DIR = path.resolve(__dirname, 'test-app-custom-groups');
const TEST_OUTPUT_FILE = path.resolve(__dirname, 'test-app-custom-groups/route-map.json');
const SCRIPT_PATH = path.resolve(__dirname, '../../scripts/generate-routes.js');

// Initialize the test environment
setupTestEnvironment(TEST_APP_DIR);

// Set up Next.js response mocks
setupNextResponseMocks();

describe('Custom Group Names', () => {

  test('should handle comma-separated custom group names', () => {
    // Create directories with multiple group name types
    fs.mkdirSync(path.join(TEST_APP_DIR, '(open)'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, '(guest)'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, '(auth)'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, '(admin)'), { recursive: true });

    // Create test pages in each directory
    fs.mkdirSync(path.join(TEST_APP_DIR, '(open)', 'open-page'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, '(guest)', 'guest-page'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, '(auth)', 'auth-page'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, '(admin)', 'admin-page'), { recursive: true });

    createPageFile(path.join(TEST_APP_DIR, '(open)', 'open-page'));
    createPageFile(path.join(TEST_APP_DIR, '(guest)', 'guest-page'));
    createPageFile(path.join(TEST_APP_DIR, '(auth)', 'auth-page'));
    createPageFile(path.join(TEST_APP_DIR, '(admin)', 'admin-page'));

    const routeMap = runGenerateRoutesWithCustomPatterns(TEST_APP_DIR, TEST_OUTPUT_FILE, '(open),(guest)', '(auth),(admin)');

    // Check public routes
    expect(routeMap.public).toContain('/open-page');
    expect(routeMap.public).toContain('/guest-page');

    // Check protected routes
    expect(routeMap.protected).toContain('/auth-page');
    expect(routeMap.protected).toContain('/admin-page');
  });

  test('should handle nested groups with different protections', () => {
    // Create nested directory structure with mixed protection levels
    fs.mkdirSync(path.join(TEST_APP_DIR, '(open)'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, '(open)', 'open-section'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, '(open)', 'open-section', '(auth)'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, '(open)', 'open-section', '(auth)', 'nested-auth'), { recursive: true });

    fs.mkdirSync(path.join(TEST_APP_DIR, '(auth)'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, '(auth)', 'protected-section'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, '(auth)', 'protected-section', '(open)'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, '(auth)', 'protected-section', '(open)', 'nested-open'), { recursive: true });

    createPageFile(path.join(TEST_APP_DIR, '(open)', 'open-section'));
    createPageFile(path.join(TEST_APP_DIR, '(open)', 'open-section', '(auth)', 'nested-auth'));
    createPageFile(path.join(TEST_APP_DIR, '(auth)', 'protected-section'));
    createPageFile(path.join(TEST_APP_DIR, '(auth)', 'protected-section', '(open)', 'nested-open'));

    const routeMap = runGenerateRoutesWithCustomPatterns(TEST_APP_DIR, TEST_OUTPUT_FILE, '(open)', '(auth)');

    // After fixing the implementation to prioritize innermost (most specific) groups:

    // 1. Routes in '(open)' directories should be public
    expect(routeMap.public).toContain('/open-section');

    // 2. Routes in '(auth)' directories (even when nested inside open) should be protected
    expect(routeMap.protected).toContain('/open-section/nested-auth');

    // 3. Protected route should be protected
    expect(routeMap.protected).toContain('/protected-section');

    // 4. Open section nested under protected should be public
    expect(routeMap.public).toContain('/protected-section/nested-open');
  });

  test('should handle weird combinations of group names', () => {
    // Create directories with unusual naming patterns
    fs.mkdirSync(path.join(TEST_APP_DIR, '(foo-bar)'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, '(weird_stuff)'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, '(restricted-area)'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, '(premium_content)'), { recursive: true });

    // Create pages in these directories
    fs.mkdirSync(path.join(TEST_APP_DIR, '(foo-bar)', 'foo-page'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, '(weird_stuff)', 'weird-page'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, '(restricted-area)', 'restricted-page'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, '(premium_content)', 'premium-page'), { recursive: true });

    createPageFile(path.join(TEST_APP_DIR, '(foo-bar)', 'foo-page'));
    createPageFile(path.join(TEST_APP_DIR, '(weird_stuff)', 'weird-page'));
    createPageFile(path.join(TEST_APP_DIR, '(restricted-area)', 'restricted-page'));
    createPageFile(path.join(TEST_APP_DIR, '(premium_content)', 'premium-page'));

    // Use custom patterns with unusual names
    const routeMap = runGenerateRoutesWithCustomPatterns(
      TEST_APP_DIR,
      TEST_OUTPUT_FILE,
      '(foo-bar),(weird_stuff)',
      '(restricted-area),(premium_content)'
    );

    // Verify protection status
    expect(routeMap.public).toContain('/foo-page');
    expect(routeMap.public).toContain('/weird-page');
    expect(routeMap.protected).toContain('/restricted-page');
    expect(routeMap.protected).toContain('/premium-page');
  });

  test('should work with middleware when using custom group names', async () => {
    // Set up test directories
    fs.mkdirSync(path.join(TEST_APP_DIR, '(guest)'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, '(member)'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, '(guest)', 'welcome'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, '(member)', 'profile'), { recursive: true });

    createPageFile(path.join(TEST_APP_DIR, '(guest)', 'welcome'));
    createPageFile(path.join(TEST_APP_DIR, '(member)', 'profile'));

    // Generate route map with custom groups
    const routeMap = runGenerateRoutesWithCustomPatterns(TEST_APP_DIR, TEST_OUTPUT_FILE, '(guest)', '(member)');

    // Import middleware creator
    const { createRouteGuardMiddleware } = require('../../dist');

    // Create middleware using our custom groups
    const middleware = createRouteGuardMiddleware({
      routeMap,
      isAuthenticated: () => false, // Always return false for testing
      onUnauthenticated: (req) => {
        const { NextResponse } = require('next/server');
        return NextResponse.redirect(new URL('/login', req.url));
      }
    });

    // Test public route (guest area)
    const publicRequest = new MockNextRequest('/welcome');
    const publicResponse = await middleware(publicRequest);
    // Public routes should pass through or return NextResponse.next()
    if (publicResponse) {
      expect(publicResponse.type).toBe('next');
    }

    // Test protected route (member area)
    const protectedRequest = new MockNextRequest('/profile');
    const protectedResponse = await middleware(protectedRequest);
    expect(protectedResponse).toBeDefined();
    expect(protectedResponse.headers.get('location')).toContain('/login');
  });
});
