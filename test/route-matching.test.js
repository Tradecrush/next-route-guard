const path = require('path');
const { execSync } = require('child_process');
const assert = require('assert');
const { NextResponse } = require('next/server');

/**
 * Test file for next-route-guard URL matching logic
 * Tests that the next-route-guard implementation correctly handles real URLs 
 * without special Next.js syntax markers, including dynamic segments
 */

// Build the package first to ensure the dist folder exists
try {
  execSync('npm run build', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
} catch (error) {
  console.error('Failed to build package:', error);
  process.exit(1);
}

// Now require the built module to test the actual implementation
const routeAuth = require('../dist/index.js');

// Create a mock NextRequest class for testing
class MockNextRequest {
  constructor(pathname) {
    this.nextUrl = {
      pathname,
      clone: function() {
        return { 
          pathname: this.pathname, 
          searchParams: new URLSearchParams()
        };
      },
      searchParams: new URLSearchParams()
    };
    this.url = `https://example.com${pathname}`;
  }
}

// Setup test route map
const testRouteMap = {
  public: [
    '/about',
    '/blog/[...slug]',
    '/products/[id]',
    '/features',
    '/help/faq',
    '/settings/profile'
  ],
  protected: [
    '/',
    '/dashboard',
    '/users/[id]',
    '/docs/[[...catchAll]]',
    '/products/[category]/[id]',
    '/settings/billing',
    '/admin/[[...path]]'
  ]
};

// Test cases for URL matching
const testCases = [
  // Public routes
  { url: '/about', expected: false, desc: 'Simple public route' },
  { url: '/blog/intro', expected: false, desc: 'Simple catch-all slug' },
  { url: '/blog/2023/01/first-post', expected: false, desc: 'Multi-segment catch-all slug' },
  { url: '/products/123', expected: false, desc: 'Dynamic segment in public route' },
  { url: '/features', expected: false, desc: 'Static public route' },
  { url: '/help/faq', expected: false, desc: 'Nested public route' },
  { url: '/settings/profile', expected: false, desc: 'Public route in mixed context' },
  { url: '/api/users', expected: false, desc: 'API route excluded by default' },
  
  // Protected routes
  { url: '/', expected: true, desc: 'Root route (protected)' },
  { url: '/dashboard', expected: true, desc: 'Simple protected route' },
  { url: '/users/456', expected: true, desc: 'Dynamic segment in protected route' },
  { url: '/docs', expected: true, desc: 'Optional catch-all base route' },
  { url: '/docs/intro', expected: true, desc: 'Optional catch-all with one segment' },
  { url: '/docs/advanced/config', expected: true, desc: 'Optional catch-all with multiple segments' },
  { url: '/products/electronics/789', expected: true, desc: 'Multiple dynamic segments' },
  { url: '/settings/billing', expected: true, desc: 'Protected route in mixed context' },
  { url: '/admin', expected: true, desc: 'Admin route base (protected optional catch-all)' },
  { url: '/admin/users', expected: true, desc: 'Admin route with segment' },
  
  // Edge cases
  { url: '/about/', expected: false, desc: 'Trailing slash should match public route' },
  { url: '/dashboard/', expected: true, desc: 'Trailing slash should match protected route' },
  { url: '/products/123?ref=email', expected: false, desc: 'Query parameters should be ignored' },
  { url: '/docs#section-1', expected: true, desc: 'Hash should be ignored' },
  { url: '/non-existent', expected: true, desc: 'Non-existent route should default to protected' },
  { url: '/blog', expected: true, desc: 'Parent of catch-all should be protected if not defined' }
];

// Function to test the routing
async function testRouteProtection(pathname, routeMap) {
  // Create middleware with mock auth
  const middleware = routeAuth.createRouteAuthMiddleware({
    isAuthenticated: () => false, // Always return false for testing protection
    routeMap,
    onUnauthenticated: (req) => {
      // Return a special response for unauthenticated
      return NextResponse.redirect(new URL('/login', req.url));
    },
  });

  // Create a mock request
  const request = new MockNextRequest(pathname);
  
  // Run the middleware
  const response = await middleware(request);
  
  // If response redirects to login, the route is protected
  return response && response.status === 307 && response.headers.get('location').includes('/login');
}

// Run the matching tests using the actual next-route-guard implementation
async function runMatchingTests() {
  console.log('🧪 Running route matching tests on next-route-guard implementation...');
  console.log('Testing URL matching with dynamic routes, catch-all routes, and more');
  
  let passCount = 0;
  let failCount = 0;
  
  // Test each case using the real middleware
  for (const testCase of testCases) {
    const { url, expected, desc } = testCase;
    
    try {
      // Test using actual middleware
      const isProtected = await testRouteProtection(url, testRouteMap);
      
      // Check result
      assert.equal(isProtected, expected, `${desc} - URL: ${url} should be ${expected ? 'protected' : 'public'}`);
      console.log(`✅ PASS: ${desc} - ${url} is correctly ${expected ? 'protected' : 'public'}`);
      passCount++;
    } catch (error) {
      console.log(`❌ FAIL: ${desc} - ${url}`);
      console.log(`   Expected: ${expected ? 'protected' : 'public'}, Got: ${!expected ? 'protected' : 'public'}`);
      console.log(`   ${error.message}`);
      failCount++;
    }
  }
  
  // Note: All dynamic route patterns are already tested in the main testCases array
  // We don't need separate tests for dynamic routes
  
  // Summary
  console.log(`\n📝 Test Summary: ${passCount} passed, ${failCount} failed`);
  
  if (failCount > 0) {
    console.log('\n⚠️ Some tests failed. Please check the route matching implementation.');
    process.exit(1);
  } else {
    console.log('\n✅ All route matching tests passed!');
    console.log('The next-route-guard middleware correctly handles URL transformation from Next.js route patterns.');
  }
}

// Run the tests
runMatchingTests();