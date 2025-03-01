/**
 * Type definitions for Next Route Guard
 *
 * This module defines the TypeScript interfaces and types used throughout the package.
 */
import type { NextRequest, NextResponse } from 'next/server';

/**
 * Type alias for a Next.js middleware function
 * This is the standard signature for Next.js middleware
 */
export type NextMiddleware = (request: NextRequest) => Promise<NextResponse | undefined> | NextResponse | undefined;

/**
 * Route map for protected and public routes
 *
 * This interface represents the structure of the JSON file generated during build time
 * that contains the lists of protected and public routes based on directory conventions.
 */
export interface RouteMap {
  /**
   * Array of paths that are protected and require authentication
   * These paths will trigger authentication checks when accessed
   */
  protected: string[];

  /**
   * Array of paths that are public and don't require authentication
   * These paths are freely accessible without authentication
   */
  public: string[];
}

/**
 * Configuration options for creating a route authentication middleware
 *
 * These options control how the middleware behaves, including how to check
 * authentication, how to handle unauthenticated requests, and which routes
 * to protect or exclude.
 */
export interface RouteAuthOptions {
  /**
   * Function to determine if a user is authenticated
   *
   * This function is called for protected routes to check if the user is authenticated.
   * You should implement this function based on your authentication system (JWT, cookies, etc.)
   *
   * @example
   * isAuthenticated: (request) => {
   *   const token = request.cookies.get('auth-token')?.value;
   *   return !!token;
   * }
   */
  isAuthenticated: (request: NextRequest) => Promise<boolean> | boolean;

  /**
   * Function to handle unauthenticated requests
   *
   * This function is called when a user tries to access a protected route
   * without being authenticated. The default behavior redirects to /login.
   *
   * @default Redirects to /login with the original URL as a 'from' parameter
   *
   * @example
   * onUnauthenticated: (request) => {
   *   if (request.nextUrl.pathname.startsWith('/api/')) {
   *     return new NextResponse(
   *       JSON.stringify({ error: 'Authentication required' }),
   *       { status: 401, headers: { 'Content-Type': 'application/json' } }
   *     );
   *   }
   *
   *   // Default login redirect for non-API routes
   *   const url = request.nextUrl.clone();
   *   url.pathname = '/login';
   *   url.searchParams.set('from', request.nextUrl.pathname);
   *   return NextResponse.redirect(url);
   * }
   */
  onUnauthenticated?: (request: NextRequest) => Promise<NextResponse> | NextResponse;

  /**
   * Map of protected and public routes
   *
   * This is the route map generated during build time by the CLI tools.
   * It contains the lists of protected and public routes based on directory conventions.
   *
   * This must be generated at build time to work with Edge runtime since it can't
   * scan the filesystem during execution.
   *
   * @example
   * // Import the generated route map
   * import routeMap from './app/route-map.json';
   */
  routeMap: RouteMap;

  /**
   * Default behavior for routes not explicitly marked in the route map
   *
   * When set to true (default), routes are protected unless explicitly marked as public.
   * When set to false, routes are public unless explicitly marked as protected.
   *
   * @default true - Routes are protected by default
   */
  defaultProtected?: boolean;

  /**
   * URLs to exclude from authentication checks
   *
   * These URLs will bypass the authentication check entirely, regardless of
   * whether they are in the protected routes list.
   *
   * Can be strings with glob-style wildcards or RegExp objects.
   *
   * @default ['/api/(.*)'] - Excludes all API routes
   *
   * @example
   * excludeUrls: [
   *   '/api/(.*)',        // All API routes
   *   '/static/(.*)',     // Static assets
   *   '/public/(.*)'      // Anything under /public/
   * ]
   */
  excludeUrls?: (string | RegExp)[];
}
