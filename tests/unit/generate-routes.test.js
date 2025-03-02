import { describe, test, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { cleanTestDirectory, buildPackageBeforeTests, setupTestEnvironment } from './test-helpers';

// Ensure package is built before running tests
buildPackageBeforeTests();

// Setup test environment (cleanup before tests and after all)
setupTestEnvironment();

/**
 * Test file for the next-route-guard generate-routes.js script
 * Tests various Next.js route patterns including dynamic routes
 */

const TEST_APP_DIR = path.resolve(__dirname, 'test-app');
const TEST_OUTPUT_FILE = path.resolve(__dirname, 'test-app/route-map.json');
const SCRIPT_PATH = path.resolve(__dirname, '../../scripts/generate-routes.js');

// Helper function to create a page file
function createPageFile(dirPath, extension = 'js') {
  fs.writeFileSync(
    path.join(dirPath, `page.${extension}`),
    `export default function Page() { return <div>Page</div> }`
  );
}

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

// Run the generate-routes script
function runGenerateRoutes() {
  try {
    // Try direct route map generation first for Node 20 compatibility
    try {
      // Generate route map using the built-in function from the project
      const { generateRouteMap } = require('../../dist/index.js');

      const result = generateRouteMap(TEST_APP_DIR, ['(public)'], ['(protected)']);

      if (result.error) {
        throw new Error(result.error);
      }

      const { routeMap } = result;

      // Write to output file
      fs.writeFileSync(TEST_OUTPUT_FILE, JSON.stringify(routeMap, null, 2));

      return routeMap;
    } catch (directError) {
      // Fall back to using the script
      const output = execSync(`node ${SCRIPT_PATH} --app-dir "${TEST_APP_DIR}" --output "${TEST_OUTPUT_FILE}"`, {
        encoding: 'utf8'
      });
      console.log('Script output:', output);

      return JSON.parse(fs.readFileSync(TEST_OUTPUT_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Error generating route map:', error);
    if (error.stdout) console.error('Script stdout:', error.stdout);
    if (error.stderr) console.error('Script stderr:', error.stderr);
    throw error;
  }
}

describe('Basic route testing', () => {
  // We're not using beforeEach hooks from setupTestEnvironment since this test
  // has specific setup requirements, so we need to manually handle cleanup

  afterAll(() => {
    // Use helper for cleanup when tests are done
    cleanTestDirectory(TEST_APP_DIR);
  });

  test('should generate the correct basic route map', () => {
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

  test('should handle route group inheritance correctly', () => {
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

  test('should detect various file extensions', () => {
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
