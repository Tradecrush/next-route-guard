import { test, describe, expect } from 'vitest';
import path from 'path';
import { buildPackageBeforeTests, setupTestEnvironment, MockNextRequest, setupNextResponseMocks } from './test-helpers';
import { NextResponse } from 'next/server';

/**
 * Performance tests for next-route-guard trie-based matching algorithm
 * Compares performance with large route sets and complex patterns
 */

// Build the package before running tests
buildPackageBeforeTests();

// Import the module after building
import * as routeGuard from '../../dist/index.js';

// Define the test directory for this specific test file
const TEST_APP_DIR = path.resolve(__dirname, 'test-app-performance');

// Setup test environment with the specific test directory
setupTestEnvironment(TEST_APP_DIR);

// Setup Next.js response mocks
setupNextResponseMocks();

// Import fs for generating test data
import fs from 'fs';

// Store performance metrics for README update
let _triePerformanceResults = {};

describe('Performance Tests', () => {
  test('should verify route matching performance with large route sets and complex patterns', async () => {
    console.log('\n=== Running performance comparison test...');

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
      '/public/page-250', // Exact match in the middle
      '/protected/page-499', // Exact match at the end
      '/public/dynamic-50/12345', // Dynamic parameter
      '/protected/catch-25/a/b/c/d/e/f/g/h/i/j', // Deep catch-all
      '/protected/catch-49/a/b/c/edit', // Catch-all with rest segment
      '/unknown/path/not/found' // Non-existent path
    ];

    // Create middleware with trie-based implementation
    const middleware = routeGuard.createRouteGuardMiddleware({
      isAuthenticated: () => false,
      routeMap: largeRouteMap,
      onUnauthenticated: () => NextResponse.redirect(new URL('/login', 'https://example.com')),
      excludeUrls: []
    });

    // Run performance test
    console.log('\n--- Testing Trie-Based Implementation ---');
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

    // Verify the test performed measurements
    expect(totalTime).toBeGreaterThan(0);
    expect(Object.keys(resultDetails).length).toBe(testUrls.length);
  });
});
