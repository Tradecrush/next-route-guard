# Next.js Compatibility Tests for Next-Route-Guard

This directory contains compatibility tests that verify Next Route Guard works correctly with different versions of Next.js.

## What These Tests Verify

The compatibility tests check that:

1. Route map generation works correctly with different Next.js versions
2. Middleware functionality works correctly in real Next.js applications
3. Route protection rules are correctly applied in different routing scenarios
4. Dynamic segments, catch-all routes, and optional catch-all routes are handled properly
5. The package is compatible with the Edge Runtime in different Next.js versions

## Supported Next.js Versions

Currently tested versions:

- Next.js 13.4.0 (First version with App Router)
- Next.js 14.0.0
- Next.js 15.0.0

## How the Tests Work

For each Next.js version, the compatibility tests:

1. Create a temporary Next.js app with a representative directory structure
2. Generate a route map using the next-route-guard-generate script
3. Create a middleware.ts file that uses Next Route Guard
4. Build the Next.js app to detect any build-time errors
5. Start a server running the Next.js app
6. Make HTTP requests to various routes to verify protection status
7. Clean up the temporary app

## Running Compatibility Tests

```bash
# Run tests for all supported Next.js versions
npm run test:compatibility

# Run test for a specific Next.js version
npm run test:compatibility -- --version=14.0.0
```

## Adding Tests for New Next.js Versions

To add compatibility tests for a new Next.js version:

1. Add the version to the `nextVersions` array in `run-all-tests.js`
2. Run the tests to verify compatibility
3. Update this README with the new supported version