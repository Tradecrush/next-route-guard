# Next-Route-Guard Test Suite

This directory contains the comprehensive test suite for the Next Route Guard package. The tests are organized into two main categories:

## Directory Structure

- `tests/unit/`: Unit tests that verify core functionality like route matching, pattern handling, and performance
- `tests/compatibility/`: End-to-end tests that verify integration with different Next.js versions
- `tests/run-all-tests.js`: Script to run both unit and compatibility tests sequentially

## Test Overview

The test suite covers all aspects of the package:

### Unit Tests
- **Route Matching**: Comprehensive testing of URL pattern matching with error handling
- **Advanced Routes**: Complex Next.js App Router patterns (parallel routes, intercepted routes)
- **Custom Group Names**: User-defined route group patterns and nested group precedence
- **Generate Routes**: Creating route maps from directory structures
- **Middleware Chaining**: Composing multiple middleware functions in a request pipeline
- **Performance**: Benchmarks for trie-based route matching implementation

### Compatibility Tests
- **Next.js Versions**: Tests with Next.js 13.4.0, 14.0.0, and 15.0.0
- **Edge Runtime**: Verification that middleware works in Edge runtime
- **Build Process**: Integration with the Next.js build process
- **Real App Testing**: End-to-end testing with actual HTTP requests

See each directory's README for more detailed information about each test category.

## Running Tests

```bash
# Run all tests (unit + compatibility)
npm run test:all

# Run only unit tests
npm run test:unit

# Run only compatibility tests (for all Next.js versions)
npm run test:compatibility

# Run compatibility test for a specific Next.js version
npm run test:compatibility -- --version=15.0.0
```

## Continuous Integration

The test suite is run in CI for every pull request and push to main branches:

- Unit tests are run on Node.js 18, 20, and 22
- Compatibility tests are run for Next.js 13.4.0, 14.0.0, and 15.0.0

This ensures the package remains compatible with all supported environments.

## Adding New Tests

When adding new tests:

1. Place unit tests in `tests/unit/` with a descriptive filename ending in `.test.js`
2. Place compatibility tests in `tests/compatibility/` if they're testing Next.js integration
3. Make sure to run all tests locally before submitting a PR