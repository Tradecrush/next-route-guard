const path = require('path');
const { execSync } = require('child_process');
const assert = require('assert');
const { NextResponse } = require('next/server');

/**
 * Performance test file for next-route-guard
 * Compares the performance of the linear search vs trie-based implementations
 */

// Build the package
try {
  execSync('npm run build', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
} catch (error) {
  console.error('Failed to build package:', error);
  process.exit(1);
}

// Now require the built module
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

// Performance test function
async function runPerformanceTest() {
  console.log('\n🚀 Running performance test for original implementation...');
  
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
  
  // Create middleware
  const middleware = routeAuth.createRouteAuthMiddleware({
    isAuthenticated: () => false,
    routeMap: largeRouteMap,
    onUnauthenticated: () => NextResponse.redirect(new URL('/login', 'https://example.com')),
    excludeUrls: [],
  });
  
  // Run performance test
  let totalTime = 0;
  let resultDetails = {};
  const runs = 1000;
  
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
  console.log('Performance test completed for original implementation');
  
  // Print summary for README update
  console.log('\n--- Performance Summary (for README) ---');
  console.log(`Routes: ${totalRoutes}`);
  console.log(`Average time per request: ${avgTimeMs.toFixed(3)}ms`);
  console.log('----------------------------------------------------------------');
}

// Run the test
runPerformanceTest();