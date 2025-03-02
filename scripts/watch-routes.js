#!/usr/bin/env node
/**
 * Next Route Guard - Route Map Watcher
 *
 * This CLI tool watches your Next.js app directory for changes and automatically
 * updates the route map when files or directories are added, modified, or removed.
 *
 * This is intended for development use to ensure your route map stays up-to-date
 * as you add or modify routes in your app.
 */

const fs = require('fs');

const path = require('path');

const chokidar = require('chokidar');

// NodeJS 20 compatibility: Use explicit path to index.js
let generateRouteMap;
try {
  // Try importing from dist with explicit file path
  const lib = require('../dist/index.js');
  generateRouteMap = lib.generateRouteMap;
} catch (error) {
  console.log('Could not load from dist/index.js, falling back to dist directory...');
  try {
    // Try without explicit .js extension
    const lib = require('../dist');
    generateRouteMap = lib.generateRouteMap;
  } catch (distError) {
    console.error('Failed to load generateRouteMap from dist directory:', distError);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let appDir = './app';
let outputFile = './app/route-map.json';
let publicPatterns = ['(public)'];
let protectedPatterns = ['(protected)'];

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (arg === '--app-dir' && i + 1 < args.length) {
    appDir = args[++i];
  } else if (arg === '--output' && i + 1 < args.length) {
    outputFile = args[++i];
  } else if (arg === '--public' && i + 1 < args.length) {
    publicPatterns = args[++i].split(',');
  } else if (arg === '--protected' && i + 1 < args.length) {
    protectedPatterns = args[++i].split(',');
  } else if (arg === '--help') {
    console.log(`
@tradecrush/next-route-guard - Watch Route Changes

Usage: next-route-guard-watch [options]

Options:
  --app-dir <path>       Path to the app directory (default: ./app)
  --output <path>        Path to the output JSON file (default: ./app/route-map.json)
  --public <patterns>    Comma-separated list of public route patterns (default: (public))
  --protected <patterns> Comma-separated list of protected route patterns (default: (protected))
  --help                 Display this help message
`);
    process.exit(0);
  }
}

// Resolve paths
const resolvedAppDir = path.resolve(process.cwd(), appDir);
const resolvedOutputFile = path.resolve(process.cwd(), outputFile);

/**
 * Generates and saves the route map based on the current app directory structure
 * This function is called initially and whenever file changes are detected
 */
function generateAndSaveRouteMap() {
  console.log('\n@tradecrush/next-route-guard: Generating route map...');

  // Generate the route map
  const { routeMap, error } = generateRouteMap(resolvedAppDir, publicPatterns, protectedPatterns);

  if (error) {
    console.error('@tradecrush/next-route-guard: Error generating route map:', error);
    return;
  }

  // Create directory if it doesn't exist
  const outputDir = path.dirname(resolvedOutputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write to a JSON file
  fs.writeFileSync(resolvedOutputFile, JSON.stringify(routeMap, null, 2));

  console.log(`@tradecrush/next-route-guard: Route map updated at ${new Date().toLocaleTimeString()}`);
  console.log(`Public routes: ${routeMap.public.length}, Protected routes: ${routeMap.protected.length}`);
}

// Generate the route map initially
console.log(`@tradecrush/next-route-guard: Scanning app directory: ${resolvedAppDir}`);
console.log(`Public patterns: ${publicPatterns.join(', ')}`);
console.log(`Output file: ${resolvedOutputFile}`);
generateAndSaveRouteMap();

// Watch for changes in the app directory
console.log(`\n@tradecrush/next-route-guard: Watching for changes in ${resolvedAppDir}...`);
const watcher = chokidar.watch(resolvedAppDir, {
  ignored: /(^|[/\\])\../, // ignore dotfiles
  persistent: true,
  ignoreInitial: true
});

/**
 * Debounce function to prevent multiple rapid updates when many files change at once
 * This ensures we don't regenerate the route map for every single file change
 */
let timeout;
function debouncedUpdate() {
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    generateAndSaveRouteMap();
  }, 300);
}

// Watch for file and directory changes
watcher.on('add', (path) => {
  if (path.includes('/page.') || path.includes('/layout.')) {
    console.log('@tradecrush/next-route-guard: File added:', path);
    debouncedUpdate();
  }
});

watcher.on('unlink', (path) => {
  if (path.includes('/page.') || path.includes('/layout.')) {
    console.log('@tradecrush/next-route-guard: File removed:', path);
    debouncedUpdate();
  }
});

watcher.on('addDir', (path) => {
  console.log('@tradecrush/next-route-guard: Directory added:', path);
  debouncedUpdate();
});

watcher.on('unlinkDir', (path) => {
  console.log('@tradecrush/next-route-guard: Directory removed:', path);
  debouncedUpdate();
});

watcher.on('error', (error) => console.error('@tradecrush/next-route-guard: Watcher error:', error));

console.log('@tradecrush/next-route-guard: Watching for route changes. Press Ctrl+C to stop.');

// Handle process termination
process.on('SIGINT', () => {
  watcher.close();
  console.log('@tradecrush/next-route-guard: Route watcher stopped.');
  process.exit(0);
});
