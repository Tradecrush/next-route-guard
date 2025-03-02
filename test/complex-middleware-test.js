const path = require('path');
const { execSync } = require('child_process');
const assert = require('assert');
const { NextResponse } = require('next/server');

/**
 * Complex middleware integration test for next-route-guard's trie-based implementation
 * This tests realistic scenarios with complex routing patterns and nested protection levels
 */

// Build the package first
try {
  execSync('npm run build', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
} catch (error) {
  console.error('Failed to build package:', error);
  process.exit(1);
}

// Require the built module
const routeAuth = require('../dist/index.js');

// Create a mock NextRequest class
class MockNextRequest {
  constructor(pathname, headers = {}, cookies = {}) {
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
    this.headers = new Map(Object.entries(headers));
    this.cookies = {
      get: (name) => cookies[name] ? { value: cookies[name] } : undefined
    };
  }
}

// Mock Next Response for assertions
class MockNextResponse {
  static redirected = false;
  static redirectPath = '';
  static nextCalled = false;

  static redirect(url) {
    this.redirected = true;
    this.redirectPath = url.pathname;
    return {
      status: 307,
      headers: new Map([['location', url.toString()]])
    };
  }

  static next() {
    this.nextCalled = true;
    return { status: 200 };
  }

  static reset() {
    this.redirected = false;
    this.redirectPath = '';
    this.nextCalled = false;
  }
}

// Define a complex application structure mimicking a real Next.js app
const appRouteMap = {
  public: [
    '/',                                       // Home page is public
    '/about',                                  // About page is public
    '/login',                                  // Login page is public
    '/register',                               // Register page is public
    '/products',                               // Products listing is public
    '/products/[id]',                          // Product detail is public
    '/products/[id]/reviews',                  // Product reviews are public
    '/blog/[[...slug]]',                       // Blog with optional catch-all is public
    '/docs/[...path]/preview',                 // Documentation preview is public
    '/help/search/[...query]',                 // Help search is public
  ],
  protected: [
    '/dashboard',                              // Dashboard is protected
    '/dashboard/@stats',                       // Dashboard parallel route is protected
    '/dashboard/@activity',                    // Another parallel route is protected
    '/dashboard/settings',                     // Dashboard settings are protected
    '/dashboard/settings/[section]',           // Dashboard setting sections are protected
    '/profile',                                // User profile is protected
    '/profile/edit',                           // Profile edit is protected
    '/orders/[id]',                            // Order details are protected
    '/orders/[id]/invoice',                    // Order invoice is protected
    '/orders/[id]/track',                      // Order tracking is protected
    '/admin/[[...path]]',                      // Admin area with optional catch-all
    '/docs',                                   // Documentation home is protected
    '/docs/[...path]',                         // Documentation with required catch-all
    '/docs/[...path]/edit',                    // Documentation edit is protected
    '/blog/[...slug]/edit',                    // Blog edit is protected (rest segment)
    '/products/[id]/edit',                     // Product edit is protected
    '/api/user/data',                          // API routes can also be protected
  ]
};

// Authentication states to test
const authStates = [
  { 
    name: 'Unauthenticated user',
    isAuthenticated: () => false,
    cookies: {}
  },
  { 
    name: 'Authenticated user',
    isAuthenticated: () => true,
    cookies: { 'auth-token': 'valid-token' }
  },
  { 
    name: 'User with expired token',
    isAuthenticated: (req) => {
      const token = req.cookies.get('auth-token')?.value;
      return token === 'valid-token';
    },
    cookies: { 'auth-token': 'expired-token' }
  }
];

// Complex test cases
const complexTestPaths = [
  // Static routes
  { path: '/', expectProtected: false, desc: 'Home page (public)' },
  { path: '/about', expectProtected: false, desc: 'About page (public)' },
  { path: '/login', expectProtected: false, desc: 'Login page (public)' },
  { path: '/dashboard', expectProtected: true, desc: 'Dashboard (protected)' },
  { path: '/profile', expectProtected: true, desc: 'Profile (protected)' },
  
  // Dynamic segments
  { path: '/products/123', expectProtected: false, desc: 'Product detail (public)' },
  { path: '/products/456/reviews', expectProtected: false, desc: 'Product reviews (public)' },
  { path: '/products/789/edit', expectProtected: true, desc: 'Product edit (protected)' },
  { path: '/orders/ABC123', expectProtected: true, desc: 'Order detail (protected)' },
  { path: '/orders/XYZ789/invoice', expectProtected: true, desc: 'Order invoice (protected)' },
  { path: '/dashboard/settings/profile', expectProtected: true, desc: 'Dashboard settings section (protected)' },
  
  // Optional catch-all
  { path: '/blog', expectProtected: false, desc: 'Blog home (public optional catch-all)' },
  { path: '/blog/tech', expectProtected: false, desc: 'Blog category (public optional catch-all)' },
  { path: '/blog/tech/javascript', expectProtected: false, desc: 'Blog subcategory (public optional catch-all)' },
  { path: '/blog/tech/javascript/edit', expectProtected: true, desc: 'Blog edit (protected rest segment)' },
  { path: '/admin', expectProtected: true, desc: 'Admin home (protected optional catch-all)' },
  { path: '/admin/users', expectProtected: true, desc: 'Admin section (protected optional catch-all)' },
  
  // Required catch-all
  { path: '/docs/guide', expectProtected: true, desc: 'Docs page (protected required catch-all)' },
  { path: '/docs/guide/intro', expectProtected: true, desc: 'Nested docs page (protected required catch-all)' },
  { path: '/docs/guide/intro/preview', expectProtected: false, desc: 'Docs preview (public rest segment)' },
  { path: '/docs/guide/advanced/edit', expectProtected: true, desc: 'Docs edit (protected rest segment)' },
  { path: '/help/search/nextjs/middleware', expectProtected: false, desc: 'Help search (public required catch-all)' },
  
  // Parallel routes
  { path: '/dashboard/@stats', expectProtected: true, desc: 'Dashboard stats (protected parallel route)' },
  { path: '/dashboard/@activity', expectProtected: true, desc: 'Dashboard activity (protected parallel route)' },
  
  // Edge cases
  { path: '/unknown/path', expectProtected: true, desc: 'Unknown path (defaults to protected)' },
  { path: '/products/123/unknown', expectProtected: true, desc: 'Unknown subpath (defaults to protected)' },
  { path: '/products///123///', expectProtected: false, desc: 'Path with multiple slashes (normalized)' },
  { path: '/blog/post-1?utm=email#section', expectProtected: false, desc: 'Path with query and hash (normalized)' },
];

// Run the complex middleware integration test
async function runComplexMiddlewareTest() {
  console.log('🧪 Running complex middleware integration test with trie-based implementation...');
  
  // Create middleware with the complex route map
  let passCount = 0;
  let failCount = 0;
  
  // Test with different authentication states
  for (const authState of authStates) {
    console.log(`\n--- Testing with ${authState.name} ---`);
    
    // Create middleware with current auth state
    const middleware = routeAuth.createRouteAuthMiddleware({
      routeMap: appRouteMap,
      isAuthenticated: authState.isAuthenticated,
      onUnauthenticated: (req) => {
        const url = req.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('returnTo', req.nextUrl.pathname);
        return NextResponse.redirect(url);
      },
      excludeUrls: ['/api/public/(.*)'] // Exclude public API routes
    });
    
    // Test each path
    for (const testCase of complexTestPaths) {
      const { path, expectProtected, desc } = testCase;
      
      try {
        // Create a request with the test path and auth state
        const request = new MockNextRequest(path, {}, authState.cookies);
        
        // Reset the mock response
        MockNextResponse.reset();
        
        // Run the middleware
        const NextResponseBackup = global.NextResponse;
        global.NextResponse = MockNextResponse;
        
        await middleware(request);
        
        // Restore NextResponse
        global.NextResponse = NextResponseBackup;
        
        // Check if the path was correctly protected
        const isAuthenticated = await authState.isAuthenticated(request);
        
        if (expectProtected) {
          // Protected routes should redirect for unauthenticated users
          if (!isAuthenticated) {
            assert.strictEqual(MockNextResponse.redirected, true, 
              `${desc} - ${path} should redirect unauthenticated users`);
          } else {
            // Authenticated users should be allowed
            assert.strictEqual(MockNextResponse.nextCalled, true, 
              `${desc} - ${path} should allow authenticated users`);
          }
        } else {
          // Public routes should always be allowed
          assert.strictEqual(MockNextResponse.nextCalled, true, 
            `${desc} - ${path} should be public and accessible to all users`);
        }
        
        console.log(`✅ PASS: ${desc} - ${path}`);
        passCount++;
      } catch (error) {
        console.log(`❌ FAIL: ${desc} - ${path}`);
        console.log(`   ${error.message}`);
        failCount++;
      }
    }
  }
  
  // Summary
  console.log(`\n📝 Test Summary: ${passCount} passed, ${failCount} failed`);
  
  if (failCount > 0) {
    console.log('\n⚠️ Some tests failed. Please check the middleware implementation.');
    process.exit(1);
  } else {
    console.log('\n✅ All complex middleware integration tests passed!');
    console.log('The trie-based implementation correctly handles complex middleware scenarios.');
  }
}

// Run the test
runComplexMiddlewareTest();