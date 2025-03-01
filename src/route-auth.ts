/**
 * Core implementation of Next Route Guard middleware.
 * This module contains the runtime logic for checking if a route should be protected
 * and enforcing authentication based on the route map generated at build time.
 */
import { NextResponse, type NextRequest } from 'next/server';
import type { RouteAuthOptions, RouteMap } from './types';

/**
 * Default route to redirect to when authentication fails
 */
const DEFAULT_LOGIN_ROUTE = '/login';

/**
 * Creates a Next.js middleware function that enforces route authentication
 * based on the directory structure conventions in the app router.
 * 
 * This is the main entry point for the runtime middleware that checks if a user
 * is authenticated and handles redirection for protected routes.
 * 
 * @param options - Configuration options for the middleware
 * @returns A Next.js middleware function
 */
export function createRouteAuthMiddleware(options: RouteAuthOptions) {
  // Set up default options
  const {
    isAuthenticated,
    onUnauthenticated = (request) => {
      // Default behavior: redirect to login with return URL
      const url = request.nextUrl.clone();
      url.pathname = DEFAULT_LOGIN_ROUTE;
      url.searchParams.set('from', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    },
    routeMap,
    defaultProtected = true,
    excludeUrls = ['/api/(.*)']
  } = options;

  // Return the middleware function that will be executed for each request
  return async function routeAuthMiddleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    // Skip authentication check for excluded URL patterns (e.g., API routes)
    for (const pattern of excludeUrls) {
      const isRegex = pattern instanceof RegExp;
      // Convert string patterns to regex if needed
      const regex = isRegex ? pattern : new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);

      if (regex.test(pathname)) {
        // Excluded path - allow access without auth check
        return NextResponse.next();
      }
    }

    // Determine if the current route should be protected based on the route map
    const isProtected = shouldProtectPath(pathname, routeMap, defaultProtected);

    // If route is public, allow access without auth check
    if (!isProtected) {
      return NextResponse.next();
    }

    // For protected routes, check if the user is authenticated
    const isAuthed = await isAuthenticated(request);

    // If authenticated, allow access to the protected route
    if (isAuthed) {
      return NextResponse.next();
    }

    // User is not authenticated for a protected route, handle according to options
    return onUnauthenticated(request);
  };
}

/**
 * Helper function to check if a URL path matches a route pattern with dynamic segments.
 * 
 * This handles Next.js route pattern syntax including:
 * - Regular path segments (/about, /users)
 * - Dynamic route parameters (/users/[id])
 * - Catch-all routes (/docs/[...slug])
 * - Optional catch-all routes (/blog/[[...slug]])
 * 
 * @param urlPath - The actual URL path to check
 * @param routePattern - The route pattern to match against
 * @returns true if the path matches the pattern, false otherwise
 */
function matchDynamicPath(urlPath: string, routePattern: string): boolean {
  // Handle exact matches first (optimization)
  if (urlPath === routePattern) {
    return true;
  }
  
  // Clean the path: remove query parameters and hash fragments 
  let cleanPath = (urlPath.split('?')[0] || '').split('#')[0] || '';
  
  // Normalize trailing slashes for consistent matching
  if (cleanPath.endsWith('/') && cleanPath.length > 1) {
    cleanPath = cleanPath.slice(0, -1);
  }
  
  // Fast path: if there are no dynamic segments, we just need an exact match
  if (!routePattern.includes('[')) {
    return cleanPath === routePattern;
  }
  
  // Split both paths into segments for detailed comparison
  const urlSegments = cleanPath.split('/').filter(Boolean);
  const patternSegments = routePattern.split('/').filter(Boolean);
  
  // Special handling for catch-all routes (which can match multiple segments)
  const catchAllIndex = patternSegments.findIndex(segment => 
    segment && (segment.startsWith('[...') || segment.startsWith('[[...'))
  );
  
  if (catchAllIndex !== -1) {
    // For catch-all routes, we need to check segments before the catch-all first
    for (let i = 0; i < catchAllIndex; i++) {
      const patternSegment = patternSegments[i];
      
      // If URL has fewer segments than are required before the catch-all, no match
      if (i >= urlSegments.length) {
        return false;
      }
      
      // Dynamic segment in prefix (like /users/[id]/docs/[...rest])
      if (patternSegment && patternSegment.startsWith('[') && patternSegment.endsWith(']')) {
        continue; // Dynamic segment can match any value
      }
      
      // Static segment must match exactly
      if (urlSegments[i] !== patternSegment) {
        return false;
      }
    }
    
    // Now handle the catch-all segment
    const catchAllSegment = patternSegments[catchAllIndex];
    const isOptionalCatchAll = catchAllSegment && catchAllSegment.startsWith('[[...');
    
    // Optional catch-all can match with zero or more remaining segments
    if (isOptionalCatchAll) {
      return urlSegments.length >= catchAllIndex;
    }
    
    // Regular catch-all requires at least one segment
    return urlSegments.length >= catchAllIndex + 1;
  }
  
  // For normal routes (no catch-all), the number of segments must match
  if (urlSegments.length !== patternSegments.length) {
    return false;
  }
  
  // Compare each segment
  for (let i = 0; i < patternSegments.length; i++) {
    const patternSegment = patternSegments[i];
    
    // Dynamic parameter matches any value
    if (patternSegment && patternSegment.startsWith('[') && patternSegment.endsWith(']')) {
      continue;
    }
    
    // Static segment must match exactly
    if (urlSegments[i] !== patternSegment) {
      return false;
    }
  }
  
  // All segments matched
  return true;
}

/**
 * Determines if a path should be protected based on the route map.
 * 
 * This function implements the route protection rules, checking:
 * 1. Exact matches in protected/public lists
 * 2. Dynamic route matches
 * 3. Parent path inheritance (a child route inherits protection from its parent)
 * 
 * @param path - The URL path to check
 * @param routeMap - Map of protected and public routes
 * @param defaultProtected - Whether routes are protected by default
 * @returns true if the path should be protected, false if it's public
 */
function shouldProtectPath(path: string, routeMap: RouteMap, defaultProtected: boolean): boolean {
  // Clean and normalize the path for consistent matching
  let cleanPath = (path.split('?')[0] || '').split('#')[0] || '';
  
  // Normalize trailing slashes
  if (cleanPath.endsWith('/') && cleanPath.length > 1) {
    cleanPath = cleanPath.slice(0, -1);
  }

  // Step 1: Check exact matches first (fastest path)
  if (routeMap.protected.includes(cleanPath)) {
    return true;
  }

  if (routeMap.public.includes(cleanPath)) {
    return false;
  }
  
  // Step 2: Check for dynamic route matches
  // First check public routes - if any match, the route is public
  for (const publicRoute of routeMap.public) {
    if (matchDynamicPath(cleanPath, publicRoute)) {
      return false;
    }
  }
  
  // Then check protected routes - if any match, the route is protected
  for (const protectedRoute of routeMap.protected) {
    if (matchDynamicPath(cleanPath, protectedRoute)) {
      return true;
    }
  }

  // Step 3: Check for parent path inheritance
  // This handles nested routes inheriting protection status from parent routes
  const segments = cleanPath.split('/').filter(Boolean);
  
  // Walk up the path hierarchy and check each parent path
  let currentPath = '';
  let isProtected = defaultProtected;

  for (let i = 0; i <= segments.length; i++) {
    // Construct the current parent path
    currentPath = i === 0 ? '/' : `/${segments.slice(0, i).join('/')}`;

    // Check exact matches for the parent path
    if (routeMap.protected.includes(currentPath)) {
      isProtected = true;
    } else if (routeMap.public.includes(currentPath)) {
      isProtected = false;
    }
    
    // Check dynamic route matches for parent paths
    for (const publicRoute of routeMap.public) {
      if (matchDynamicPath(currentPath, publicRoute)) {
        isProtected = false;
        break;
      }
    }
    
    for (const protectedRoute of routeMap.protected) {
      if (matchDynamicPath(currentPath, protectedRoute)) {
        isProtected = true;
        break;
      }
    }
  }

  // Return the final protection status
  return isProtected;
}