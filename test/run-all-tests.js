#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Running all next-route-guard tests...\n');

// Build the project before running tests
console.log('Building next-route-guard package...');
try {
  execSync('npm run build', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
} catch (error) {
  console.error('Failed to build package:', error);
  process.exit(1);
}

// Run each test file
console.log('\n=== Basic route tests ===');
try {
  execSync('node test/generate-routes.test.js', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
} catch (error) {
  console.error('Basic route tests failed:', error);
  process.exit(1);
}

console.log('\n=== Advanced route tests ===');
try {
  execSync('node test/advanced-routes.test.js', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
} catch (error) {
  console.error('Advanced route tests failed:', error);
  process.exit(1);
}

console.log('\n=== URL matching tests ===');
console.log('Testing that next-route-guard correctly handles real-world URLs with dynamic segments');
try {
  execSync('node test/route-matching.test.js', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
} catch (error) {
  console.error('URL matching tests failed:', error);
  process.exit(1);
}

console.log('\n=== Trie-based route matching tests ===');
console.log('Testing the optimized trie-based matching implementation with complex route patterns');
try {
  execSync('node test/trie-matching.test.js', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
} catch (error) {
  console.error('Trie-based matching tests failed:', error);
  process.exit(1);
}

console.log('\n=== Complex middleware integration tests ===');
console.log('Testing realistic middleware scenarios with complex route patterns and authentication states');
try {
  execSync('node test/complex-middleware-test.js', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
} catch (error) {
  console.error('Complex middleware integration tests failed:', error);
  process.exit(1);
}

console.log('\n✅ All tests completed successfully!');
