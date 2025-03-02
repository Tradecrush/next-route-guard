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

// Run unit tests
console.log('\n=== Running unit tests ===');
try {
  execSync('npm run test:unit', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  console.log('\n✅ Unit tests passed!');
} catch (error) {
  console.error('❌ Unit tests failed:', error);
  process.exit(1);
}

// Run compatibility tests for all supported Next.js versions
const nextVersions = ['13.4.0', '14.0.0', '15.0.0'];

for (const version of nextVersions) {
  console.log(`\n=== Running compatibility tests for Next.js ${version} ===`);
  try {
    execSync(`npm run test:compatibility -- --version=${version}`, {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..')
    });
    console.log(`\n✅ Next.js ${version} compatibility tests passed!`);
  } catch (error) {
    console.error(`❌ Next.js ${version} compatibility tests failed:`, error);
    process.exit(1);
  }
}

console.log('\n🎉 All tests passed successfully!');
