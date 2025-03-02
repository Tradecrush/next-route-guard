import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Test file for custom group names in next-route-guard
 * Tests different combinations of custom group names using CLI options
 */

const TEST_APP_DIR = path.resolve(__dirname, 'test-app-custom-groups');
const TEST_OUTPUT_FILE = path.resolve(__dirname, 'test-app-custom-groups/route-map.json');
const SCRIPT_PATH = path.resolve(__dirname, '../../scripts/generate-routes.js');

// Setup - clean up any previous test files
function cleanTestDirectory() {
  if (fs.existsSync(TEST_APP_DIR)) {
    fs.rmSync(TEST_APP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_APP_DIR, { recursive: true });
}

// Helper to create a page file
function createPageFile(dirPath, extension = 'js') {
  fs.writeFileSync(
    path.join(dirPath, `page.${extension}`),
    `export default function Page() { return <div>Page</div> }`
  );
}

// Run the generate-routes script with custom patterns
function runGenerateRoutesWithCustomPatterns(publicPatterns, protectedPatterns) {
  try {
    // Build command with custom patterns
    let command = `node ${SCRIPT_PATH} --app-dir "${TEST_APP_DIR}" --output "${TEST_OUTPUT_FILE}"`;
    
    if (publicPatterns) {
      command += ` --public "${publicPatterns}"`;
    }
    
    if (protectedPatterns) {
      command += ` --protected "${protectedPatterns}"`;
    }
    
    console.log(`Running command: ${command}`);
    
    // Set stdio to inherit to see the output for debugging
    execSync(command, { stdio: 'inherit' });
    
    return JSON.parse(fs.readFileSync(TEST_OUTPUT_FILE, 'utf8'));
  } catch (error) {
    console.error('Error running generate-routes:', error);
    throw error;
  }
}

describe('Custom Group Names', () => {
  beforeEach(() => {
    // Clean up and create fresh test directory before each test
    cleanTestDirectory();
  });

  afterAll(() => {
    // Remove test directory completely when done
    if (fs.existsSync(TEST_APP_DIR)) {
      fs.rmSync(TEST_APP_DIR, { recursive: true, force: true });
    }
  });

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
    
    const routeMap = runGenerateRoutesWithCustomPatterns('(open),(guest)', '(auth),(admin)');
    
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
    
    const routeMap = runGenerateRoutesWithCustomPatterns('(open)', '(auth)');
    
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
      '(foo-bar),(weird_stuff)',
      '(restricted-area),(premium_content)'
    );
    
    // Verify protection status
    expect(routeMap.public).toContain('/foo-page');
    expect(routeMap.public).toContain('/weird-page');
    expect(routeMap.protected).toContain('/restricted-page');
    expect(routeMap.protected).toContain('/premium-page');
  });
});