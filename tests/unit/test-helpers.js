import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { NextResponse } from 'next/server';

// Global flag to track if build has been run
let buildHasRun = false;

// Build the package before running tests
export function buildPackageBeforeTests() {
  beforeAll(() => {
    // Skip if already built to avoid parallel build issues
    if (buildHasRun) {
      return;
    }

    try {
      execSync('npm run build', { stdio: 'inherit', cwd: path.resolve(__dirname, '../..') });
      buildHasRun = true;
    } catch (error) {
      console.error('Failed to build package:', error);
      throw error;
    }
  });
}

// Clean up the test directory
export function cleanTestDirectory() {
  const testDir = path.resolve(__dirname, 'test-app');
  try {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error(`Error cleaning directory ${testDir}:`, error);
  }
}

// Setup and cleanup functions for tests
export function setupTestEnvironment() {
  // Clean up before each test
  beforeEach(() => {
    cleanTestDirectory();
  });

  // Final cleanup
  afterAll(() => {
    cleanTestDirectory();
  });
}

// Create a mock NextRequest class for testing
export class MockNextRequest {
  constructor(pathname, headers = {}, cookies = {}) {
    this.nextUrl = {
      pathname,
      clone: function () {
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
      get: (name) => (cookies[name] ? { value: cookies[name] } : undefined)
    };
  }
}

// Setup Next.js response mocks
export function setupNextResponseMocks() {
  beforeAll(() => {
    vi.spyOn(NextResponse, 'redirect').mockImplementation((url) => ({
      status: 307,
      headers: new Map([['location', url.toString()]]),
      cookies: new Map(),
      url: url.toString()
    }));

    vi.spyOn(NextResponse, 'json').mockImplementation((data, options) => ({
      status: options?.status || 200,
      headers: new Map([['content-type', 'application/json']]),
      cookies: new Map(),
      json: () => data
    }));

    // Mock NextResponse.next() to return a proper next response object
    vi.spyOn(NextResponse, 'next').mockImplementation(() => ({
      status: 200,
      headers: new Map(),
      cookies: new Map(),
      type: 'next'
    }));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });
}

// Helper function to test route protection
export async function testRouteProtection(pathname, routeMap, routeAuth, options = {}) {
  // Create middleware with mock auth
  const middleware = routeAuth.createRouteAuthMiddleware({
    isAuthenticated: () => false, // Always return false for testing protection
    routeMap,
    onUnauthenticated: (req) => {
      // Return a special response for unauthenticated
      return NextResponse.redirect(new URL('/login', req.url));
    },
    excludeUrls: options.excludeUrls !== undefined ? options.excludeUrls : ['/api/(.*)']
  });

  // Create a mock request
  const request = new MockNextRequest(pathname);

  // Run the middleware
  const response = await middleware(request);

  // If response redirects to login, the route is protected
  // Otherwise route is public or excluded and should return false
  if (response && response.status === 307 && response.headers.get('location').includes('/login')) {
    return true;
  } else {
    return false;
  }
}
