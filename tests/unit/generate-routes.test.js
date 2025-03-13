import { describe, test, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { cleanTestDirectory, buildPackageBeforeTests, setupTestEnvironment } from './test-helpers';

// Ensure package is built before running tests
buildPackageBeforeTests();

// Define the test directory for this specific test file
const TEST_APP_DIR = path.resolve(__dirname, 'test-app-generate-routes');
const TEST_OUTPUT_FILE = path.resolve(TEST_APP_DIR, 'route-map.json');

// Setup test environment with the specific test directory
setupTestEnvironment(TEST_APP_DIR);

/**
 * Test file for the next-route-guard generate-routes.js script
 * Tests various Next.js route patterns including dynamic routes
 */

const SCRIPT_PATH = path.resolve(__dirname, '../../scripts/generate-routes.js');

// Import createPageFile from test-helpers instead of defining it locally
import { createPageFile, runGenerateRoutes as runGenerateRoutesHelper } from './test-helpers';

// Helper to create test app structure
function createTestAppStructure() {
  try {
    // Create basic routes
    fs.mkdirSync(path.join(TEST_APP_DIR, '(public)'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, '(protected)'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, '(protected)', 'dashboard'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, '(public)', 'about'), { recursive: true });

    // Create dynamic route [id]
    fs.mkdirSync(path.join(TEST_APP_DIR, '(protected)', 'users', '[id]'), { recursive: true });

    // Create catch-all route [...slug]
    fs.mkdirSync(path.join(TEST_APP_DIR, '(public)', 'blog', '[...slug]'), { recursive: true });

    // Create optional catch-all route [[...catchAll]]
    fs.mkdirSync(path.join(TEST_APP_DIR, '(protected)', 'docs', '[[...catchAll]]'), { recursive: true });

    // Create nested dynamic routes
    fs.mkdirSync(path.join(TEST_APP_DIR, '(protected)', 'products', '[category]', '[id]'), { recursive: true });

    // Create mixed protection levels
    fs.mkdirSync(path.join(TEST_APP_DIR, 'settings'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, 'settings', '(public)'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, 'settings', '(public)', 'profile'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, 'settings', '(protected)'), { recursive: true });
    fs.mkdirSync(path.join(TEST_APP_DIR, 'settings', '(protected)', 'billing'), { recursive: true });

    // Root page is outside any group, so it inherits default protection (protected)
    createPageFile(path.join(TEST_APP_DIR));
    createPageFile(path.join(TEST_APP_DIR, '(public)', 'about'));
    createPageFile(path.join(TEST_APP_DIR, '(protected)', 'dashboard'));
    createPageFile(path.join(TEST_APP_DIR, '(protected)', 'users', '[id]'));
    createPageFile(path.join(TEST_APP_DIR, '(public)', 'blog', '[...slug]'));
    createPageFile(path.join(TEST_APP_DIR, '(protected)', 'docs', '[[...catchAll]]'));
    createPageFile(path.join(TEST_APP_DIR, '(protected)', 'products', '[category]', '[id]'));
    createPageFile(path.join(TEST_APP_DIR, 'settings', '(public)', 'profile'));
    createPageFile(path.join(TEST_APP_DIR, 'settings', '(protected)', 'billing'));

    // Verify crucial structure elements
    const aboutPagePath = path.join(TEST_APP_DIR, '(public)', 'about', 'page.js');
    if (!fs.existsSync(aboutPagePath)) {
      throw new Error(`Critical test file not created: ${aboutPagePath}`);
    }
  } catch (error) {
    console.error('Error in createTestAppStructure:', error);
    throw error;
  }
}

// Use the runGenerateRoutes from test-helpers instead
function runGenerateRoutes() {
  return runGenerateRoutesHelper(TEST_APP_DIR, TEST_OUTPUT_FILE);
}

describe('Basic route testing', () => {
  // We're not using beforeEach hooks from setupTestEnvironment since this test
  // has specific setup requirements, so we need to manually handle cleanup

  afterAll(() => {
    // Use helper for cleanup when tests are done
    cleanTestDirectory(TEST_APP_DIR);
  });

  test('should identify public and protected routes based on (public) and (protected) directory groups', () => {
    try {
      // Setup for this specific test
      if (fs.existsSync(TEST_APP_DIR)) {
        fs.rmSync(TEST_APP_DIR, { recursive: true, force: true });
      }
      fs.mkdirSync(TEST_APP_DIR, { recursive: true });

      // Create test app structure
      createTestAppStructure();

      // Run generate routes script
      const routeMap = runGenerateRoutes();

      // Check public routes
      const expectedPublicRoutes = ['/about', '/blog/[...slug]', '/settings/profile'];

      // Check protected routes
      const expectedProtectedRoutes = [
        '/', // Root route is protected by default since it's not in a (public) group
        '/dashboard',
        '/users/[id]',
        '/docs/[[...catchAll]]',
        '/products/[category]/[id]',
        '/settings/billing'
      ];

      // Verify all expected routes are present
      for (const route of expectedPublicRoutes) {
        expect(routeMap.public).toContain(route);
      }

      for (const route of expectedProtectedRoutes) {
        expect(routeMap.protected).toContain(route);
      }

      // Verify route counts
      expect(routeMap.public.length).toBe(expectedPublicRoutes.length);
      expect(routeMap.protected.length).toBe(expectedProtectedRoutes.length);
    } catch (error) {
      console.error('Error in basic route map test:', error);
      throw error;
    }
  });

  test('should properly inherit route protection from parent group directories to nested subdirectories', () => {
    try {
      // Setup for this specific test
      if (fs.existsSync(TEST_APP_DIR)) {
        fs.rmSync(TEST_APP_DIR, { recursive: true, force: true });
      }
      fs.mkdirSync(TEST_APP_DIR, { recursive: true });

      // Create test app structure
      createTestAppStructure();

      // Add additional nested structure with inherited protection
      fs.mkdirSync(path.join(TEST_APP_DIR, '(public)', 'help', 'faq'), { recursive: true });
      createPageFile(path.join(TEST_APP_DIR, '(public)', 'help', 'faq'));

      const updatedRouteMap = runGenerateRoutes();
      expect(updatedRouteMap.public).toContain('/help/faq');
    } catch (error) {
      console.error('Error in route inheritance test:', error);
      throw error;
    }
  });

  test('should detect routes with various file extensions including tsx, jsx, and ts', () => {
    // Test with different file extensions
    const extensions = ['tsx', 'jsx', 'ts'];

    for (const ext of extensions) {
      try {
        // Create a fresh directory structure for each test
        if (fs.existsSync(TEST_APP_DIR)) {
          fs.rmSync(TEST_APP_DIR, { recursive: true, force: true });
        }
        fs.mkdirSync(TEST_APP_DIR, { recursive: true });

        // Create only the minimum required structure for this test
        const testDir = path.join(TEST_APP_DIR, '(protected)', `test-${ext}`);
        fs.mkdirSync(path.join(TEST_APP_DIR, '(protected)'), { recursive: true });
        fs.mkdirSync(testDir, { recursive: true });
        fs.writeFileSync(path.join(testDir, `page.${ext}`), `export default function Page() { return null }`);

        const extRouteMap = runGenerateRoutes();
        expect(extRouteMap.protected).toContain(`/test-${ext}`);
      } catch (error) {
        console.error(`Error testing extension ${ext}:`, error);
        throw error;
      }
    }
  });
});
