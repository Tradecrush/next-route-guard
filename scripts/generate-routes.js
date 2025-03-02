#!/usr/bin/env node
/**
 * Next Route Guard - Route Map Generator
 *
 * This CLI tool analyzes your Next.js app directory structure and generates a JSON map of
 * protected and public routes based on directory naming conventions.
 *
 * The generated route map is used by the middleware at runtime to enforce authentication
 * checks based on the directory structure.
 */

const fs = require('fs');

const path = require('path');

const { generateRouteMap } = require('../dist');

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
@tradecrush/next-route-guard - Generate Route Map

Usage: next-route-guard-generate [options]

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

// Create output directory if it doesn't exist
const outputDir = path.dirname(resolvedOutputFile);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log(`@tradecrush/next-route-guard: Scanning app directory: ${resolvedAppDir}`);
console.log(`Public patterns: ${publicPatterns.join(', ')}`);
console.log(`Protected patterns: ${protectedPatterns.join(', ')}`);

// Generate the route map
const { routeMap, error } = generateRouteMap(resolvedAppDir, publicPatterns, protectedPatterns);

if (error) {
  console.error('@tradecrush/next-route-guard: Error generating route map:', error);
  process.exit(1);
}

// Write to a JSON file
fs.writeFileSync(resolvedOutputFile, JSON.stringify(routeMap, null, 2));

console.log(`@tradecrush/next-route-guard: Route map generated successfully at ${resolvedOutputFile}!`);
console.log(`Found ${routeMap.public.length} public routes and ${routeMap.protected.length} protected routes.`);

// Print a summary
console.log('\nPublic routes:');
routeMap.public.forEach((route) => console.log(`  ${route}`));

console.log('\nProtected routes:');
routeMap.protected.forEach((route) => console.log(`  ${route}`));
