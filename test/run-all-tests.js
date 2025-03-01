#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Running all route-auth tests...\n');

// Build the project before running tests
console.log('Building route-auth package...');
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
console.log('Testing that route-auth correctly handles real-world URLs with dynamic segments');
try {
  execSync('node test/route-matching.test.js', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
} catch (error) {
  console.error('URL matching tests failed:', error);
  process.exit(1);
}

console.log('\n✅ All tests completed successfully!');
