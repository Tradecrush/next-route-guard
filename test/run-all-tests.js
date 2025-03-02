#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Running all next-route-guard tests with Vitest 3.0.7...\n');

// Build the project before running tests
console.log('Building next-route-guard package...');
try {
  execSync('npm run build', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
} catch (error) {
  console.error('Failed to build package:', error);
  process.exit(1);
}

// Run all tests using vitest
console.log('\n=== Running all tests with Vitest ===');
try {
  execSync('npm test', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
  console.log('\n✅ All tests completed successfully!');
} catch (error) {
  console.error('Tests failed:', error);
  process.exit(1);
}
