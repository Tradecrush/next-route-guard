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
 * Node in the route trie representing a route segment
 * Used for efficient route matching and protection status lookup
 */
interface RouteNode {
  // Whether this route is protected
  isProtected?: boolean;
  
  // Regular children by segment name
  children: Map<string, RouteNode>;
  
  // Dynamic child node (for [param] segments)
  dynamicChild?: RouteNode;
  
  // Catch-all child (for [...slug] or [[...slug]])
  catchAllChild?: {
    node: RouteNode;
    isOptional: boolean;
    // Segments after the catch-all (e.g., [...slug]/edit)
    restSegments?: Map<string, RouteNode>;
  };
}

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

  // Build the route trie at initialization time for efficient matching
  const routeTrie = buildRouteTrie(routeMap);

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

    // Determine if the current route should be protected using the trie
    const isProtected = matchPath(pathname, routeTrie, defaultProtected);

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
 * Builds a route trie from a route map for efficient path matching
 * This converts the flat route lists into a tree structure for O(k) lookups
 * where k is the depth of the path (number of segments).
 * 
 * @param routeMap - Map of protected and public routes
 * @returns Root node of the route trie
 */
function buildRouteTrie(routeMap: RouteMap): RouteNode {
  // Create the root node
  const root: RouteNode = {
    children: new Map()
  };
  
  // Add protected routes first
  for (const route of routeMap.protected) {
    addRouteToTrie(root, route, true);
  }
  
  // Add public routes (these will override protection status for the same paths)
  for (const route of routeMap.public) {
    addRouteToTrie(root, route, false);
  }
  
  return root;
}

/**
 * Adds a single route to the trie
 * 
 * @param root - Root node of the trie
 * @param route - Route path to add
 * @param isProtected - Whether this route is protected
 */
function addRouteToTrie(root: RouteNode, route: string, isProtected: boolean): void {
  // Handle root route specially
  if (route === '/') {
    root.isProtected = isProtected;
    return;
  }
  
  // Split path into segments
  const segments = route.split('/').filter(Boolean);
  let currentNode = root;
  
  // Find the index of any catch-all segment
  const catchAllIndex = segments.findIndex(s => 
    s.startsWith('[...') || s.startsWith('[[...')
  );
  
  // Process segments before catch-all normally
  const segmentsBeforeCatchAll = catchAllIndex === -1 ? 
    segments : segments.slice(0, catchAllIndex);
  
  for (let i = 0; i < segmentsBeforeCatchAll.length; i++) {
    const segment = segmentsBeforeCatchAll[i];
    if (!segment) continue; // Skip empty segments
    
    const isLastSegment = i === segments.length - 1;
    
    // Regular dynamic segment [param]
    if (segment.startsWith('[') && segment.endsWith(']') && 
        !segment.startsWith('[...') && !segment.startsWith('[[...')) {
      if (!currentNode.dynamicChild) {
        currentNode.dynamicChild = { 
          children: new Map(),
          isProtected: isLastSegment ? isProtected : undefined
        };
      } else if (isLastSegment) {
        currentNode.dynamicChild.isProtected = isProtected;
      }
      currentNode = currentNode.dynamicChild;
    } 
    // Regular segment
    else {
      if (!currentNode.children.has(segment)) {
        currentNode.children.set(segment, {
          children: new Map(),
          isProtected: isLastSegment ? isProtected : undefined
        });
      } else if (isLastSegment) {
        const childNode = currentNode.children.get(segment);
        if (childNode) {
          childNode.isProtected = isProtected;
        }
      }
      const nextNode = currentNode.children.get(segment);
      if (nextNode) {
        currentNode = nextNode;
      }
    }
  }
  
  // If there's a catch-all segment
  if (catchAllIndex !== -1) {
    const catchAllSegment = segments[catchAllIndex];
    if (catchAllSegment) {
      const isOptional = catchAllSegment.startsWith('[[...');
      
      // Create catch-all node if it doesn't exist
      if (!currentNode.catchAllChild) {
        currentNode.catchAllChild = {
          node: {
            children: new Map(),
            isProtected: undefined
          },
          isOptional,
          restSegments: new Map()
        };
      }
    }
    
    // If there are segments after the catch-all
    if (catchAllIndex < segments.length - 1 && currentNode.catchAllChild && currentNode.catchAllChild.restSegments) {
      const afterCatchAll = segments.slice(catchAllIndex + 1);
      let restSegments = currentNode.catchAllChild.restSegments;
      
      // Add nodes for segments after catch-all
      let restNode: RouteNode | undefined;
      
      for (let i = 0; i < afterCatchAll.length; i++) {
        const segment = afterCatchAll[i];
        if (!segment) continue; // Skip empty segments
        
        const isLastSegment = i === afterCatchAll.length - 1;
        
        if (!restSegments.has(segment)) {
          restSegments.set(segment, {
            children: new Map(),
            isProtected: isLastSegment ? isProtected : undefined
          });
        } else if (isLastSegment) {
          const segmentNode = restSegments.get(segment);
          if (segmentNode) {
            segmentNode.isProtected = isProtected;
          }
        }
        
        restNode = restSegments.get(segment);
        
        // If not the last segment and we have a valid node, prepare for more
        if (!isLastSegment && restNode) {
          restSegments = restNode.children;
        }
      }
    } 
    // If catch-all is the last segment
    else if (currentNode.catchAllChild) {
      currentNode.catchAllChild.node.isProtected = isProtected;
    }
  }
}

/**
 * Match a path against the route trie to determine if it's protected
 * 
 * @param path - URL path to check
 * @param routeTrie - Route trie for efficient matching
 * @param defaultProtected - Default protection status
 * @returns true if the path should be protected, false if it's public
 */
function matchPath(path: string, routeTrie: RouteNode, defaultProtected: boolean): boolean {
  // Clean and normalize the path
  let cleanPath = (path.split('?')[0] || '').split('#')[0] || '';
  if (cleanPath.endsWith('/') && cleanPath.length > 1) {
    cleanPath = cleanPath.slice(0, -1);
  }
  
  // Special case for root path
  if (cleanPath === '/') {
    return routeTrie.isProtected ?? defaultProtected;
  }
  
  // Split path into segments
  const segments = cleanPath.split('/').filter(Boolean);
  let isProtected = defaultProtected;
  
  // Start at the root node (which may have its own protection status)
  let currentNode = routeTrie;
  if (currentNode.isProtected !== undefined) {
    isProtected = currentNode.isProtected;
  }
  
  // Match path segments
  let matchIndex = 0;
  while (matchIndex < segments.length) {
    const segment = segments[matchIndex];
    let matched = false;
    
    // 1. Try exact match first
    if (currentNode.children.has(segment)) {
      currentNode = currentNode.children.get(segment)!;
      matched = true;
      matchIndex++;
    }
    // 2. Try dynamic segment
    else if (currentNode.dynamicChild) {
      currentNode = currentNode.dynamicChild;
      matched = true;
      matchIndex++;
    }
    // 3. Try catch-all
    else if (currentNode.catchAllChild) {
      // Non-optional catch-all requires at least one segment
      if (!currentNode.catchAllChild.isOptional && matchIndex >= segments.length) {
        break;
      }
      
      // Set protection status from catch-all node
      if (currentNode.catchAllChild.node.isProtected !== undefined) {
        isProtected = currentNode.catchAllChild.node.isProtected;
      }
      
      // Check for rest segments
      if (currentNode.catchAllChild.restSegments && currentNode.catchAllChild.restSegments.size > 0) {
        // Try to find a matching "rest segment" among remaining URL parts
        let restMatched = false;
        let remainingSegments = segments.slice(matchIndex);
        
        // Try each remaining segment as a potential start of a rest path
        for (let i = 0; i < remainingSegments.length; i++) {
          const potentialRestStart = remainingSegments[i];
          if (!potentialRestStart) continue;
          
          if (currentNode.catchAllChild.restSegments.has(potentialRestStart)) {
            // We have a potential rest segment match
            const restPath = remainingSegments.slice(i);
            const restStartNode = currentNode.catchAllChild.restSegments.get(potentialRestStart);
            if (!restStartNode) continue;
            
            let currentRestNode = restStartNode;
            
            if (restPath.length === 1) {
              // Single segment rest path, we have a match
              if (currentRestNode.isProtected !== undefined) {
                isProtected = currentRestNode.isProtected;
              }
              restMatched = true;
              break;
            }
            
            // Multi-segment rest path, need to check further segments
            let restMatchComplete = true;
            for (let j = 1; j < restPath.length; j++) {
              const nextSegment = restPath[j];
              if (!nextSegment) continue;
              
              if (currentRestNode.children.has(nextSegment)) {
                const nextNode = currentRestNode.children.get(nextSegment);
                if (nextNode) {
                  currentRestNode = nextNode;
                  if (j === restPath.length - 1 && currentRestNode.isProtected !== undefined) {
                    isProtected = currentRestNode.isProtected;
                  }
                } else {
                  restMatchComplete = false;
                  break;
                }
              } else {
                // Rest path doesn't match completely
                restMatchComplete = false;
                break;
              }
            }
            
            if (restMatchComplete) {
              restMatched = true;
              break;
            }
          }
        }
        
        // If we matched a rest segment, we're done
        if (restMatched) {
          return isProtected;
        }
      }
      
      // If no rest segments matched, the catch-all consumes all remaining segments
      return isProtected;
    }
    
    // Update protection status
    if (matched && currentNode.isProtected !== undefined) {
      isProtected = currentNode.isProtected;
    }
    
    // If no match found, we're done
    if (!matched) {
      break;
    }
  }
  
  // We've either matched all segments or run out of matches
  return isProtected;
}