import { test, describe, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { NextResponse } from 'next/server';
import { buildPackageBeforeTests, setupTestEnvironment, MockNextRequest, setupNextResponseMocks } from './test-helpers';

/**
 * Performance tests for next-route-guard trie-based matching algorithm
 * Compares performance with large route sets and complex patterns
 */

// Build the package before running tests
buildPackageBeforeTests();

// Import the module after building
import * as routeGuard from '../../dist/index.js';

// Setup test environment
setupTestEnvironment();

// Setup Next.js response mocks
setupNextResponseMocks();

// Import fs for generating test data
import fs from 'fs';

// Create a minimal test to silence the warning
describe('Performance Tests', () => {
  test('placeholder test until performance tests are implemented', () => {
    expect(true).toBe(true);
  });
});
