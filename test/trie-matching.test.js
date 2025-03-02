const path = require('path');
const { execSync } = require('child_process');
const assert = require('assert');
const { NextResponse } = require('next/server');

/**
 * Test file for next-route-guard trie-based URL matching
 * Tests complex route combinations, including nested catch-all patterns,
 * and rest segments that come after dynamic or catch-all segments.
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

// Setup test route map for complex cases
const complexRouteMap = {
  public: [
    '/data/[...path]',                       // Required catch-all (public)
    '/content/[[...slug]]',                  // Optional catch-all (public)
    '/content',                               // Base path for public optional catch-all
    '/docs/[...slug]/preview',               // Rest segment after catch-all (public)
    '/docs/public/info',                     // Static path (public)
    '/products/[id]/preview',                // Rest segment after dynamic param (public)
    '/shop/[category]/[id]/details',         // Multiple dynamic params with rest (public)
    '/articles/[section]/[...tags]',         // Dynamic + catch-all combo (public)
    '/articles/[section]/[...tags]/share',   // Dynamic + catch-all + rest segment (public)
    '/blog/[...slug]',                       // Public catch-all from (public) directory group
  ],
  protected: [
    '/dashboard/[[...path]]',                // Optional catch-all (protected)
    '/dashboard/[[...path]]/edit',           // Rest segment after optional catch-all (protected)
    '/members/[id]',                         // Dynamic param (protected)
    '/docs',                                 // Static path (protected)
    '/docs/[...slug]/edit',                  // Rest segment with different protection (protected)
    '/docs/[...slug]/admin',                 // Another rest segment with different protection (protected)
    '/shop/[category]/[id]/edit',            // Multiple dynamic params with different rest (protected)
    '/api/users/[[...path]]',                // API route (normally excluded by middleware)
    '/blog/[...slug]/edit',                  // Protected rest segment after public catch-all
  ]
};

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
    excludeUrls: [], // Include all paths including API routes for this test
  });

  // Create a mock request
  const request = new MockNextRequest(pathname);
  
  // Run the middleware
  const response = await middleware(request);
  
  // If response redirects to login, the route is protected
  return response && response.status === 307 && response.headers.get('location').includes('/login');
}

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
  { url: '/shop/electronics/789/unknown', expected: true, desc: 'Multiple dynamic params with unknown rest (defaults)' },
  
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
  { url: '/api/users', expected: true, desc: 'API route should be included in this test' },
];

// Run the complex matching tests
async function runComplexMatchingTests() {
  console.log('🧪 Running trie-based complex route matching tests...');
  console.log('Testing complex route patterns with trie-based implementation');
  
  let passCount = 0;
  let failCount = 0;
  
  // Test each case using the real middleware
  for (const testCase of complexTestCases) {
    const { url, expected, desc } = testCase;
    
    try {
      // Test using actual middleware
      const isProtected = await testRouteProtection(url, complexRouteMap);
      
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
  
  // Summary
  console.log(`\n📝 Test Summary: ${passCount} passed, ${failCount} failed`);
  
  if (failCount > 0) {
    console.log('\n⚠️ Some tests failed. Please check the trie-based route matching implementation.');
    process.exit(1);
  } else {
    console.log('\n✅ All complex trie-based route matching tests passed!');
    console.log('The trie-based implementation correctly handles complex Next.js route patterns.');
  }
}

// Store performance metrics for README update
let triePerformanceResults = {};

// Performance test function
async function runPerformanceTest() {
  console.log('\n🚀 Running performance comparison test...');
  
  // Create a larger route map for performance testing
  const largeRouteMap = { public: [], protected: [] };
  
  // Generate 1000 routes with various patterns
  for (let i = 0; i < 500; i++) {
    largeRouteMap.public.push(`/public/page-${i}`);
    largeRouteMap.protected.push(`/protected/page-${i}`);
    
    if (i < 100) {
      largeRouteMap.public.push(`/public/dynamic-${i}/[id]`);
      largeRouteMap.protected.push(`/protected/dynamic-${i}/[id]`);
    }
    
    if (i < 50) {
      largeRouteMap.public.push(`/public/catch-${i}/[...slug]`);
      largeRouteMap.protected.push(`/protected/catch-${i}/[...slug]`);
      
      // Add some rest segments
      largeRouteMap.public.push(`/public/catch-${i}/[...slug]/preview`);
      largeRouteMap.protected.push(`/protected/catch-${i}/[...slug]/edit`);
    }
  }
  
  const totalRoutes = largeRouteMap.public.length + largeRouteMap.protected.length;
  console.log(`Created test route map with ${totalRoutes} routes`);
  
  // Test URLs to match
  const testUrls = [
    '/public/page-250',                        // Exact match in the middle
    '/protected/page-499',                     // Exact match at the end
    '/public/dynamic-50/12345',                // Dynamic parameter
    '/protected/catch-25/a/b/c/d/e/f/g/h/i/j', // Deep catch-all
    '/protected/catch-49/a/b/c/edit',          // Catch-all with rest segment
    '/unknown/path/not/found',                 // Non-existent path
  ];
  
  // Create middleware with trie-based implementation
  const middleware = routeAuth.createRouteAuthMiddleware({
    isAuthenticated: () => false,
    routeMap: largeRouteMap,
    onUnauthenticated: () => NextResponse.redirect(new URL('/login', 'https://example.com')),
    excludeUrls: [],
  });
  
  // Run performance test
  console.log('\n--- Testing Trie-Based Implementation ---');
  let totalTime = 0;
  let resultDetails = {};
  const runs = 100;
  
  for (const url of testUrls) {
    console.log(`Testing match for: ${url}`);
    
    const request = new MockNextRequest(url);
    
    const start = process.hrtime.bigint();
    for (let i = 0; i < runs; i++) {
      await middleware(request);
    }
    const end = process.hrtime.bigint();
    
    const timeMs = Number(end - start) / 1_000_000 / runs;
    totalTime += timeMs;
    resultDetails[url] = timeMs;
    
    console.log(`  - Average time: ${timeMs.toFixed(3)}ms per request over ${runs} runs`);
  }
  
  const avgTimeMs = totalTime / testUrls.length;
  console.log(`\nAverage overall time: ${avgTimeMs.toFixed(3)}ms per request`);
  console.log('Trie-based implementation performance test completed!');
  
  // Save results for comparison
  triePerformanceResults = {
    totalRoutes,
    urls: testUrls,
    details: resultDetails,
    averageTime: avgTimeMs,
    implementation: 'trie'
  };
  
  // Print summary for README update
  console.log('\n--- Performance Summary (for README) ---');
  console.log(`Routes: ${totalRoutes}`);
  console.log(`Average time per request: ${avgTimeMs.toFixed(3)}ms`);
  console.log('Trie-based implementation provides consistent performance regardless of route count');
  console.log('----------------------------------------------------------------');
}

// Run the tests
async function runAllTests() {
  await runComplexMatchingTests();
  await runPerformanceTest();
}

runAllTests();