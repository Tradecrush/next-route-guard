# Next-Route-Guard Unit Tests

This directory contains the unit tests for the Next Route Guard package. These tests verify the core functionality of the package without requiring a full Next.js application.

## Test Files

- **route-matching.test.js**: Tests route matching functionality with complex patterns and error handling
- **advanced-routes.test.js**: Tests complex Next.js App Router patterns like parallel routes and intercepted routes
- **custom-group-names.test.js**: Tests user-defined group patterns and nested group precedence
- **generate-routes.test.js**: Tests the creation of route maps from basic directory structures
- **middleware-chaining.test.js**: Tests the ability to chain multiple middleware functions
- **performance.test.js**: Benchmarks trie-based route matching implementation

## Running the Tests

```bash
# Run all unit tests
npm run test:unit

# Run a specific test
npx vitest run tests/unit/route-matching.test.js

# Run with coverage report
npx vitest run --coverage
```

## Adding New Tests

When adding new unit tests:

1. Create a new test file with a descriptive name ending in `.test.js`
2. Follow the existing patterns for test setup and teardown
3. Use Vitest's testing utilities (`describe`, `test`, `expect`, etc.)
4. Ensure tests are isolated and don't depend on each other