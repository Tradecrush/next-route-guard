# Unit Tests for Next-Route-Guard

This directory contains unit tests that verify the core functionality of the Next Route Guard package.

## Test Categories

The unit tests are organized into several categories:

1. **Route Matching Tests** - Tests the ability to match URLs to patterns, including dynamic segments and catch-all routes
2. **Advanced Routes Tests** - Tests complex routing patterns including nested route groups and protection inheritance
3. **Generate Routes Tests** - Tests the route map generation script with different app directory structures
4. **Trie Matching Tests** - Tests the trie-based route matching algorithm with complex path patterns
5. **Custom Group Names Tests** - Tests user-defined group names and nested group behavior
6. **Complex Middleware Tests** - Tests the middleware behavior with different authentication states and route configurations
7. **Performance Tests** - Benchmarks the performance of the route matching algorithm

## Running Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run a specific test file
npx vitest run tests/unit/route-matching.test.js

# Run tests in watch mode during development
npx vitest tests/unit
```

## Test App Structure

Many tests create temporary app directory structures to test the route generation and matching logic. These test apps include various patterns of Next.js routes including:

- Static routes
- Dynamic segments (`[id]`)
- Catch-all routes (`[...slug]`)
- Optional catch-all routes (`[[...path]]`)
- Nested route groups with different protection levels
- Parallel routes (`@slot`)
- Intercepted routes (`(.)`)

## Custom Group Names Tests

The `custom-group-names.test.js` file contains tests specifically for the custom group names feature:

- Using custom route group names like `(guest)`, `(auth)`, `(admin)` instead of the default `(public)` and `(protected)`
- Processing comma-separated lists of group patterns via CLI options
- Handling nested groups with different protection levels
- Ensuring proper precedence where innermost (most specific) groups override parent groups

These tests verify:
1. Routes under a more specific group inherit the protection status from the innermost group
2. Routes like `/docs/admin` can be protected even when nested under public parent paths
3. Custom group names work with various naming patterns, including special characters and unusual names

## Adding New Unit Tests

When adding new unit tests:

1. Create a new file in this directory with a descriptive name ending in `.test.js`
2. Import the necessary test utilities from Vitest
3. Follow the existing patterns for setting up test fixtures
4. Test both expected behavior and edge cases