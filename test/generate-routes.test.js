const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const assert = require('assert');

/**
 * Test file for the route-auth generate-routes.js script
 * Tests various Next.js route patterns including dynamic routes
 */

const TEST_APP_DIR = path.resolve(__dirname, 'test-app');
const TEST_OUTPUT_FILE = path.resolve(__dirname, 'test-app/route-map.json');
const SCRIPT_PATH = path.resolve(__dirname, '../scripts/generate-routes.js');

// Setup - clean up any previous test files
function cleanTestDirectory() {
  if (fs.existsSync(TEST_APP_DIR)) {
    fs.rmSync(TEST_APP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_APP_DIR, { recursive: true });
}

// Helper function to create a page file
function createPageFile(dirPath, extension = 'js') {
  fs.writeFileSync(
    path.join(dirPath, `page.${extension}`),
    `export default function Page() { return <div>Page</div> }`
  );
}

// Helper to create test app structure
function createTestAppStructure() {
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
}

// Run the generate-routes script
function runGenerateRoutes() {
  try {
    execSync(`node ${SCRIPT_PATH} --app-dir "${TEST_APP_DIR}" --output "${TEST_OUTPUT_FILE}"`, {
      stdio: 'inherit'
    });
    return JSON.parse(fs.readFileSync(TEST_OUTPUT_FILE, 'utf8'));
  } catch (error) {
    console.error('Error running generate-routes:', error);
    throw error;
  }
}

// Test suite
function runTests() {
  console.log('🧪 Running generate-routes.js tests...');

  console.log('\n1. Setting up test app structure...');
  cleanTestDirectory();
  createTestAppStructure();

  console.log('\n2. Running route generation...');
  const routeMap = runGenerateRoutes();

  console.log('\n3. Verifying route map...');

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
    assert(routeMap.public.includes(route), `Public route ${route} not found in generated map`);
    console.log(`✅ Public route verified: ${route}`);
  }

  for (const route of expectedProtectedRoutes) {
    assert(routeMap.protected.includes(route), `Protected route ${route} not found in generated map`);
    console.log(`✅ Protected route verified: ${route}`);
  }

  // Verify route counts
  assert.equal(
    routeMap.public.length,
    expectedPublicRoutes.length,
    `Expected ${expectedPublicRoutes.length} public routes but got ${routeMap.public.length}`
  );
  assert.equal(
    routeMap.protected.length,
    expectedProtectedRoutes.length,
    `Expected ${expectedProtectedRoutes.length} protected routes but got ${routeMap.protected.length}`
  );

  console.log('\n4. Testing route group inheritance...');
  // Create additional nested structure with inherited protection
  fs.mkdirSync(path.join(TEST_APP_DIR, '(public)', 'help', 'faq'), { recursive: true });
  createPageFile(path.join(TEST_APP_DIR, '(public)', 'help', 'faq'));

  const updatedRouteMap = runGenerateRoutes();
  assert(updatedRouteMap.public.includes('/help/faq'), 'Nested route in public group should be public');
  console.log('✅ Route group inheritance verified');

  console.log('\n5. Testing file type variations...');
  // Test with different file extensions
  const extensions = ['tsx', 'jsx', 'ts'];
  for (const ext of extensions) {
    const testDir = path.join(TEST_APP_DIR, '(protected)', `test-${ext}`);
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, `page.${ext}`), `export default function Page() { return null }`);

    const extRouteMap = runGenerateRoutes();
    assert(extRouteMap.protected.includes(`/test-${ext}`), `Page with .${ext} extension not detected`);
    console.log(`✅ File extension .${ext} verified`);
  }

  console.log('\n✅ All tests passed!');

  // Clean up
  cleanTestDirectory();
}

// Run the tests
runTests();
