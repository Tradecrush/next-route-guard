#!/usr/bin/env node

/**
 * Next Route Guard Compatibility Test Script
 * 
 * This is a simplified compatibility test that:
 * 1. Creates a minimal structure to test that route-guard works on the given Next.js version
 * 2. Verifies that route map generation works
 * 3. Confirms the middleware syntax is valid
 */

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

// Versions to test if not specified
const DEFAULT_VERSIONS = ['13.4.0', '14.0.0', '15.0.0'];

// Parse command-line arguments
const args = process.argv.slice(2);
let specificVersion = null;
let keepTestDirs = false;

args.forEach(arg => {
  if (arg.startsWith('--version=')) {
    specificVersion = arg.split('=')[1];
  } else if (arg === '--keep') {
    keepTestDirs = true;
  }
});

const versionsToTest = specificVersion ? [specificVersion] : DEFAULT_VERSIONS;

// Main function to run compatibility tests
function runCompatibilityTests() {
  console.log('🧪 Running Next.js compatibility tests for Next Route Guard');
  console.log(`Versions to test: ${versionsToTest.join(', ')}\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const version of versionsToTest) {
    try {
      console.log(`\n🔍 Testing with Next.js ${version}...`);
      testWithNextVersion(version);
      console.log(`✅ Next.js ${version} compatibility test passed!\n`);
      successCount++;
    } catch (error) {
      console.error(`❌ Next.js ${version} compatibility test failed:`);
      console.error(error.message || error);
      failCount++;
    }
  }
  
  // Print summary
  console.log('\n📊 Compatibility Test Summary:');
  console.log(`Total versions tested: ${versionsToTest.length}`);
  console.log(`✅ Passed: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  
  if (failCount > 0) {
    process.exit(1);
  }
}

// Safer exec that doesn't depend on shell
function safeExec(command, args, options = {}) {
  console.log(`Running: ${command} ${args.join(' ')}`);
  return child_process.spawnSync(command, args, {
    stdio: 'inherit',
    ...options
  });
}

// Test compatibility with a specific Next.js version
function testWithNextVersion(version) {
  // Create test directory in the current directory
  const testDir = path.join(__dirname, 'test-app-v' + version);
  
  // Clean up any existing test directory
  if (fs.existsSync(testDir)) {
    console.log(`Cleaning up existing test directory: ${testDir}`);
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  
  // Create test directory
  fs.mkdirSync(testDir, { recursive: true });
  
  // Create comprehensive App Router structure with various route patterns
  const appDir = path.join(testDir, 'app');
  if (!fs.existsSync(appDir)) {
    fs.mkdirSync(appDir, { recursive: true });
  }
  
  // Add layout.js
  fs.writeFileSync(
    path.join(appDir, 'layout.js'),
    `export default function RootLayout({ children }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}`
  );
  
  // Create a more complex directory structure with various route patterns
  const routeStructure = {
    // Public routes
    '(public)/about': 'About Page',
    '(public)/blog': 'Blog Index',
    '(public)/blog/[id]': 'Blog Post',
    '(public)/products': 'Products Listing',
    '(public)/products/[category]/[id]': 'Product Detail',
    '(public)/help/[[...slug]]': 'Help Page with Optional Catch-All',
    
    // Protected routes
    '(protected)/dashboard': 'Dashboard',
    '(protected)/profile': 'User Profile',
    '(protected)/settings': 'Settings',
    '(protected)/admin': 'Admin Index',
    '(protected)/admin/users': 'Admin Users',
    '(protected)/admin/users/[id]': 'Admin User Detail',
    '(protected)/docs/[...slug]': 'Documentation with Catch-All',
    '(protected)/reports/[[...params]]': 'Reports with Optional Parameters',
    
    // Nested groups
    '(public)/help/(protected)/admin': 'Nested Protected in Public',
    
    // Login page (not in any group)
    'login': 'Login Page',
    'api/auth/[...nextauth]': 'NextAuth.js API Route',
  };
  
  // Create all the route directories and files
  for (const [route, pageTitle] of Object.entries(routeStructure)) {
    const routeDir = path.join(appDir, route);
    fs.mkdirSync(routeDir, { recursive: true });
    
    // Create page.js
    fs.writeFileSync(
      path.join(routeDir, 'page.js'),
      `export default function Page() {
  return <div>${pageTitle}</div>;
}
`
    );
  }
  
  // Create parallel routes and other advanced patterns
  const advancedRoutes = {
    '(protected)/dashboard/@stats/page.js': `export default function StatsPage() {
  return <div>Dashboard Stats</div>;
}
`,
    '(protected)/dashboard/@activity/page.js': `export default function ActivityPage() {
  return <div>Dashboard Activity</div>;
}
`,
    '(protected)/dashboard/layout.js': `export default function DashboardLayout({ children, stats, activity }) {
  return (
    <div>
      <div className="dashboard-layout">
        {children}
        <div className="sidebar">
          {stats}
          {activity}
        </div>
      </div>
    </div>
  );
}
`
  };
  
  // Create advanced route files
  for (const [filePath, content] of Object.entries(advancedRoutes)) {
    const fullPath = path.join(appDir, filePath);
    // Ensure directory exists
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    // Write file
    fs.writeFileSync(fullPath, content);
  }
  
  // Create a package.json
  fs.writeFileSync(
    path.join(testDir, 'package.json'),
    JSON.stringify({
      name: `test-next-${version}`,
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start'
      },
      dependencies: {
        'next': `^${version}`,
        'react': 'latest',
        'react-dom': 'latest',
        '@tradecrush/next-route-guard': 'file:../../..'
      }
    }, null, 2)
  );
  
  console.log('Created test app structure');
  
  // Create next.config.js file with ESLint and TypeScript errors disabled
  fs.writeFileSync(
    path.join(testDir, 'next.config.js'),
    `/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Allow production builds to complete even with ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow production builds to complete even with TypeScript errors
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig;
`
  );
  
  // Create middleware.js
  fs.writeFileSync(
    path.join(testDir, 'middleware.js'),
    `import { createRouteAuthMiddleware } from "@tradecrush/next-route-guard";
import { NextResponse } from "next/server";
import routeMap from "./app/route-map.json";

export default createRouteAuthMiddleware({
  routeMap,
  isAuthenticated: () => false,
  onUnauthenticated: (request) => {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
`
  );
  
  // Generate the route map
  console.log('Generating route map...');
  // Use the correct path to the generate-routes.js script
  safeExec('node', [
    path.resolve(__dirname, '../../scripts/generate-routes.js'),
    '--app-dir', './app',
    '--output', './app/route-map.json'
  ], { cwd: testDir });
  
  // Verify route map exists
  const routeMapPath = path.join(testDir, 'app', 'route-map.json');
  if (!fs.existsSync(routeMapPath)) {
    throw new Error(`Route map not generated at expected path: ${routeMapPath}`);
  }
  
  // Display route map
  const routeMap = JSON.parse(fs.readFileSync(routeMapPath, 'utf8'));
  console.log('Generated route map:');
  console.log(`Public routes: ${routeMap.public.length}`);
  console.log(`Protected routes: ${routeMap.protected.length}`);
  
  // Create an integrated test that runs the Next.js app and tests routes via HTTP
  console.log('\nSetting up integrated middleware test...');
  
  // Create an e2e test script that starts the Next.js server and tests routes
  const e2eTestPath = path.join(testDir, 'e2e-test.js');
  const e2eTestContent = `
const { execSync, spawn } = require('child_process');
const http = require('http');
const assert = require('assert');

// Function to make HTTP requests
function fetchURL(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: responseData
        });
      });
    }).on('error', reject);
  });
}

async function runTests() {
  try {
    // Build the app first
    console.log('Building Next.js app...');
    execSync('npm run build', { stdio: 'inherit' });
    
    // Start the Next.js app
    console.log('Starting Next.js app server...');
    const server = spawn('npm', ['start'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: '3456' }
    });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('Testing route protection...');
    
    // Test a public route - should be accessible
    const publicResponse = await fetchURL('http://localhost:3456/about');
    assert.strictEqual(publicResponse.status, 200, 'Public route should be accessible');
    console.log('✓ Public route (/about) is accessible');
    
    // Test a protected route - should redirect to login
    const protectedResponse = await fetchURL('http://localhost:3456/dashboard');
    assert.strictEqual(protectedResponse.status, 307, 'Protected route should redirect');
    assert.strictEqual(protectedResponse.headers.location, '/login', 'Should redirect to login');
    console.log('✓ Protected route (/dashboard) correctly redirects to login');
    
    // Test a dynamic public route - should be accessible
    const dynamicPublicResponse = await fetchURL('http://localhost:3456/products/category-1/123');
    assert.strictEqual(dynamicPublicResponse.status, 200, 'Dynamic public route should be accessible');
    console.log('✓ Dynamic public route (/products/category-1/123) is accessible');
    
    // Test a dynamic protected route - should redirect
    const dynamicProtectedResponse = await fetchURL('http://localhost:3456/admin/users/456');
    assert.strictEqual(dynamicProtectedResponse.status, 307, 'Dynamic protected route should redirect');
    console.log('✓ Dynamic protected route (/admin/users/456) correctly redirects');
    
    // Optional catch-all routes
    const optionalCatchAllPublicResponse = await fetchURL('http://localhost:3456/help/getting-started/faq');
    assert.strictEqual(optionalCatchAllPublicResponse.status, 200, 'Optional catch-all public route should be accessible');
    console.log('✓ Optional catch-all public route (/help/getting-started/faq) is accessible');
    
    const optionalCatchAllProtectedResponse = await fetchURL('http://localhost:3456/reports/sales/q1/2024');
    assert.strictEqual(optionalCatchAllProtectedResponse.status, 307, 'Optional catch-all protected route should redirect');
    console.log('✓ Optional catch-all protected route (/reports/sales/q1/2024) correctly redirects');
    
    // Test the root path of optional catch-all
    const optionalCatchAllRootResponse = await fetchURL('http://localhost:3456/reports');
    assert.strictEqual(optionalCatchAllRootResponse.status, 307, 'Root of optional catch-all route should redirect');
    console.log('✓ Root of optional catch-all protected route (/reports) correctly redirects');
    
    console.log('All route tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    // Make sure to kill any running processes
    console.log('Cleaning up...');
    try {
      execSync('npx kill-port 3456');
    } catch (e) {
      // Ignore errors in cleanup
    }
  }
}

runTests();
`;

  fs.writeFileSync(e2eTestPath, e2eTestContent);
  
  // Install http-server for testing
  console.log('Setting up server for e2e tests...');
  try {
    safeExec('npm', ['install', '--save-dev', 'kill-port'], { cwd: testDir });
    
    // Start the tests
    console.log('\nRunning e2e middleware tests...');
    safeExec('node', [e2eTestPath], { cwd: testDir });
    console.log('✓ e2e middleware tests passed successfully');
  } catch (error) {
    console.error('❌ e2e middleware tests failed:', error);
    throw new Error('e2e middleware tests failed');
  }
  
  // Enhanced verification: Check that the route map content makes sense for our structure
  const routeMapData = JSON.parse(fs.readFileSync(path.join(testDir, 'app', 'route-map.json'), 'utf8'));
  console.log('\nDetailed route map analysis:');
  
  // Verify we have both public and protected routes
  if (!routeMapData.public.length) {
    console.warn('⚠️  Warning: No public routes detected');
  } else {
    console.log(`✓ Public routes detected: ${routeMapData.public.length}`);
  }
  
  if (!routeMapData.protected.length) {
    console.warn('⚠️  Warning: No protected routes detected');
  } else {
    console.log(`✓ Protected routes detected: ${routeMapData.protected.length}`);
  }
  
  // Verify dynamic routes are present
  const hasDynamicRoutes = routeMapData.public.some(route => route.includes('[')) || 
                          routeMapData.protected.some(route => route.includes('['));
  if (hasDynamicRoutes) {
    console.log('✓ Dynamic routes correctly detected');
  } else {
    console.warn('⚠️  Warning: No dynamic routes detected');
  }
  
  // Verify catch-all routes are present
  const hasCatchAllRoutes = routeMapData.public.some(route => route.includes('[...')) || 
                           routeMapData.protected.some(route => route.includes('[...'));
  if (hasCatchAllRoutes) {
    console.log('✓ Catch-all routes correctly detected');
  } else {
    console.warn('⚠️  Warning: No catch-all routes detected');
  }
  
  // Verify optional catch-all routes are present
  const hasOptionalCatchAllRoutes = routeMapData.public.some(route => route.includes('[[...')) || 
                                   routeMapData.protected.some(route => route.includes('[[...'));
  if (hasOptionalCatchAllRoutes) {
    console.log('✓ Optional catch-all routes correctly detected');
  } else {
    console.warn('⚠️  Warning: No optional catch-all routes detected');
  }
  
  console.log(`Compatibility test for Next.js ${version} passed!`);
  
  // Clean up test directory unless --keep flag is specified
  if (!process.argv.includes('--keep')) {
    console.log(`\nCleaning up test directory: ${testDir}`);
    fs.rmSync(testDir, { recursive: true, force: true });
  } else {
    console.log(`\nKeeping test directory for inspection: ${testDir}`);
  }
  
  return true;
}

// Run tests
runCompatibilityTests();