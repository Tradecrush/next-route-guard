/**
 * Next Route Guard - Convention-based route authentication middleware for Next.js
 * 
 * This package provides a simple way to protect routes in Next.js applications
 * based on directory naming conventions. It uses Next.js Edge middleware to
 * perform authentication checks at runtime based on a route map generated
 * during build time.
 * 
 * @packageDocumentation
 */

export { createRouteAuthMiddleware } from './route-auth';
export type { RouteAuthOptions, NextMiddleware, RouteMap } from './types';

import type { NextFetchEvent } from 'next/server';

/**
 * A middleware function that takes a request and returns a response.
 * This is compatible with Next.js middleware system.
 */
export type Middleware = (
  request: import('next/server').NextRequest,
  event?: NextFetchEvent
) => Promise<import('next/server').NextResponse | undefined> | import('next/server').NextResponse | undefined;

/**
 * A middleware factory that wraps a middleware.
 * This is used to create reusable middleware components that can be chained together.
 */
export type MiddlewareFactory = (middleware: Middleware) => Middleware;

/**
 * Chain multiple middleware factories together.
 * 
 * This allows you to compose multiple middleware functions into a single middleware pipeline.
 * Each middleware in the chain can choose to call the next middleware or short-circuit the chain.
 *
 * @param functions - Array of middleware factories to chain together
 * @param index - Current index in the chain (used internally for recursion)
 * @returns A middleware function representing the entire chain
 * 
 * @example
 * ```ts
 * // Create middleware factories
 * const withLogging: MiddlewareFactory = (next) => {
 *   return (request) => {
 *     console.log(`Request: ${request.method} ${request.url}`);
 *     return next(request);
 *   };
 * };
 *
 * const withAuth: MiddlewareFactory = (next) => {
 *   return (request) => {
 *     if (!isAuthenticated(request)) {
 *       return NextResponse.redirect('/login');
 *     }
 *     return next(request);
 *   };
 * };
 *
 * // Use the chain
 * export default function middleware(req: NextRequest, ev: NextFetchEvent) {
 *   return chain([withLogging, withAuth])(req, ev);
 * }
 * ```
 */
export function chain(functions: MiddlewareFactory[], index = 0): Middleware {
  const current = functions[index];

  if (current) {
    // Get the next middleware in the chain
    const next = chain(functions, index + 1);
    
    // Apply the current middleware factory to the next middleware
    return current(next);
  }

  // Base case: we've reached the end of the chain
  // Return a middleware that just returns undefined (letting Next.js continue to the actual route)
  return () => undefined;
}

/**
 * Generate a route map based on the Next.js app directory structure.
 * 
 * This function analyzes the directory structure to identify routes and their protection status.
 * It's used by the CLI tools to generate the route map at build time or during development.
 * 
 * Routes are classified as protected or public based on their directory context:
 * - Routes inside a "(public)" directory group are marked as public
 * - Routes inside a "(protected)" directory group are marked as protected
 * - Routes inherit protection status from their parent directories
 * - Routes are protected by default if not explicitly marked
 *
 * @param appDir - Path to the Next.js app directory
 * @param publicPatterns - Array of directory name patterns that indicate public routes
 * @param protectedPatterns - Array of directory name patterns that indicate protected routes
 * @returns Object containing either the generated route map or an error message
 */
export function generateRouteMap(
  appDir: string,
  publicPatterns: string[] = ['(public)'],
  protectedPatterns: string[] = ['(protected)']
): { error?: string; routeMap?: { public: string[]; protected: string[] } } {
  // Make sure we're running in a Node.js environment
  if (typeof process === 'undefined' || !process.env) {
    return { error: 'This function can only be used in a Node.js environment' };
  }

  try {
    // We need to dynamically import these modules since they're not available in Edge runtime
    // This function is only intended to be used during build time or development
    const fs = require('fs');
    const path = require('path');

    // Initialize the route map
    const routeMap: { public: string[]; protected: string[] } = {
      public: [],
      protected: []
    };

    /**
     * Recursively scans the directory structure to identify routes
     * 
     * @param dirPath - Current directory path being scanned
     * @param segments - URL segments collected so far (for constructing the route path)
     * @param groups - Route groups encountered in the current path
     */
    function scanDirectory(dirPath: string, segments: string[] = [], groups: string[] = []) {
      // Skip if directory doesn't exist
      if (!fs.existsSync(dirPath)) return;

      // Read directory contents
      const items = fs.readdirSync(dirPath);

      // Process each item in the directory
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          // Skip special directories like node_modules
          if (item === 'node_modules' || item.startsWith('.')) continue;

          // Check if this is a route group (enclosed in parentheses)
          const isRouteGroup = item.startsWith('(') && item.endsWith(')');
          const newGroups = [...groups];
          const newSegments = [...segments];

          if (isRouteGroup) {
            // Route groups are organizational only and don't affect the URL path
            newGroups.push(item);
          } else {
            // Regular directories become part of the URL path
            newSegments.push(item);
          }

          // Continue scanning subdirectories
          scanDirectory(itemPath, newSegments, newGroups);
        } else if (
          stat.isFile() &&
          (item === 'page.js' || item === 'page.tsx' || item === 'page.jsx' || item === 'page.ts')
        ) {
          // Found a page file, which represents a route endpoint
          const route = '/' + segments.join('/');
          const routePath = route === '//' ? '/' : route;

          // Determine if the route is protected based on its group context
          // Default to protected unless explicitly marked as public
          let isProtected = true;

          // Check route groups to determine protection status
          for (const group of groups) {
            if (publicPatterns.includes(group)) {
              isProtected = false;
              break;
            } else if (protectedPatterns.includes(group)) {
              isProtected = true;
              break;
            }
          }

          // Add to the appropriate category in the route map
          if (isProtected) {
            routeMap.protected.push(routePath);
          } else {
            routeMap.public.push(routePath);
          }
        }
      }
    }

    // Start the directory scan from the app root
    scanDirectory(appDir);

    // Sort the routes for better readability and consistency
    routeMap.protected.sort();
    routeMap.public.sort();

    return { routeMap };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
