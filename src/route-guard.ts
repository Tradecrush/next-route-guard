/**
 * Core implementation of Next Route Guard middleware.
 * This module contains the runtime logic for checking if a route should be protected
 * and enforcing authentication based on the route map generated at build time.
 */
import { type NextRequest, NextResponse } from "next/server";
import type { RouteGuardOptions, RouteMap } from "./types";

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
export function createRouteGuardMiddleware(options: RouteGuardOptions) {
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
  return async function routeGuardMiddleware(request: NextRequest) {
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
  // Split the path into segments and remove empty segments
  const segments = route.split('/').filter((segment) => segment !== '');

  let current = root;

  // Process each segment of the path
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;

    // Handle catch-all routes: [...slug] or [[...slug]]
    if (segment.startsWith('[...') || segment.startsWith('[[...')) {
      const isOptional = segment.startsWith('[[...');

      // Create a catch-all node if it doesn't exist
      if (!current.catchAllChild) {
        current.catchAllChild = {
          node: { children: new Map() },
          isOptional
        };
      }

      // If this is the last segment, mark protection status
      if (i === segments.length - 1) {
        current.catchAllChild.node.isProtected = isProtected;
      }

      // Continue adding remaining segments even after a catch-all
      current = current.catchAllChild.node;
    }
    // Handle dynamic segments: [param]
    else if (segment.startsWith('[') && segment.endsWith(']')) {
      // Create a dynamic node if it doesn't exist
      if (!current.dynamicChild) {
        current.dynamicChild = { children: new Map() };
      }

      // If this is the last segment, mark protection status
      if (i === segments.length - 1) {
        current.dynamicChild.isProtected = isProtected;
      }

      // Move to the dynamic child for next iteration
      current = current.dynamicChild;
    }
    // Handle regular segments
    else {
      // Create a regular child if it doesn't exist
      if (!current.children.has(segment)) {
        current.children.set(segment, { children: new Map() });
      }

      // If this is the last segment, mark protection status
      if (i === segments.length - 1) {
        const child = current.children.get(segment)!;
        child.isProtected = isProtected;
      }

      // Move to the child for next iteration
      current = current.children.get(segment)!;
    }
  }

  // For root routes like '/' that don't have segments
  if (segments.length === 0) {
    root.isProtected = isProtected;
  }
}

/**
 * Improved visualization function for route tries with correct indentation
 *
 * @param trie - The route trie to visualize
 * @param options - Visualization options
 * @returns A string representation of the trie
 */
function visualizeTrie(
  trie: RouteNode,
  options: {
    indent?: string;
    path?: string;
  } = {}
): string {
  const { indent = '', path = '' } = options;

  let output = '';
  const protectionStatus =
    trie.isProtected !== undefined ? (trie.isProtected ? '🔒 Protected' : '🔓 Public') : '❓ Default';

  // Root node special case
  if (indent === '') {
    output += `Root (${protectionStatus})\n`;
  }

  // Convert Map entries to array for easier handling
  const children = Array.from(trie.children.entries());

  // Process regular children
  children.forEach(([segment, childNode], index) => {
    const isLastChild = !trie.dynamicChild && !trie.catchAllChild && index === children.length - 1;
    const childPath = path + '/' + segment;
    const childStatus =
      childNode.isProtected !== undefined ? (childNode.isProtected ? '🔒 Protected' : '🔓 Public') : '❓ Default';

    // Use different connectors based on position
    const connector = isLastChild ? '└── ' : '├── ';
    output += `${indent}${connector}${segment} (${childStatus})\n`;

    // Child indentation changes based on whether this is the last child
    const childIndent = indent + (isLastChild ? '    ' : '│   ');

    // Recurse into child
    output += visualizeTrie(childNode, {
      indent: childIndent,
      path: childPath
    });
  });

  // Process dynamic parameter child
  if (trie.dynamicChild) {
    const isLastChild = !trie.catchAllChild;
    const childStatus =
      trie.dynamicChild.isProtected !== undefined
        ? trie.dynamicChild.isProtected
          ? '🔒 Protected'
          : '🔓 Public'
        : '❓ Default';

    // Use different connectors based on position
    const connector = isLastChild ? '└── ' : '├── ';
    output += `${indent}${connector}[param] (${childStatus})\n`;

    // Child indentation changes based on whether this is the last child
    const childIndent = indent + (isLastChild ? '    ' : '│   ');

    // Recurse into dynamic child
    output += visualizeTrie(trie.dynamicChild, {
      indent: childIndent,
      path: path + '/[param]'
    });
  }

  // Process catch-all child (always the last child if it exists)
  if (trie.catchAllChild) {
    const catchAllType = trie.catchAllChild.isOptional ? '[[...slug]]' : '[...slug]';
    const optionalText = trie.catchAllChild.isOptional ? ' (optional)' : '';
    const childStatus =
      trie.catchAllChild.node.isProtected !== undefined
        ? trie.catchAllChild.node.isProtected
          ? '🔒 Protected'
          : '🔓 Public'
        : '❓ Default';

    output += `${indent}└── ${catchAllType}${optionalText} (${childStatus})\n`;

    // Catch-all is always the last child, so no need for vertical lines in indentation
    const childIndent = indent + '    ';

    // Recurse into catch-all child
    output += visualizeTrie(trie.catchAllChild.node, {
      indent: childIndent,
      path: path + '/' + catchAllType
    });
  }

  return output;
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

  // Use recursive matching with backtracking
  return findMatch(routeTrie, segments, 0, defaultProtected);
}

/**
 * Recursively find the best match for segments in the route trie
 *
 * @param node - Current node in the trie
 * @param segments - Path segments
 * @param index - Current segment index
 * @param defaultProtected - Default protection status
 * @returns The protection status for the best matched path
 */
function findMatch(node: RouteNode, segments: string[], index: number, defaultProtected: boolean): boolean {
  // If we reached the end of the path, return the protection status of this node
  if (index >= segments.length) {
    // If this node has an explicit protection status, use it
    if (node.isProtected !== undefined) {
      return node.isProtected;
    }
    // If this node has an optional catch-all child, use its protection status
    else if (node.catchAllChild && node.catchAllChild.isOptional) {
      return node.catchAllChild.node.isProtected ?? defaultProtected;
    }
    // Otherwise, use the default
    else {
      return defaultProtected;
    }
  }

  // Get the current segment
  const segment = segments[index]!;

  // Check for exact match in children
  if (node.children.has(segment)) {
    // Continue matching with the next segment
    const childNode = node.children.get(segment)!;
    return findMatch(childNode, segments, index + 1, defaultProtected);
  }
  // Check for dynamic parameter match
  else if (node.dynamicChild) {
    return findMatch(node.dynamicChild, segments, index + 1, defaultProtected);
  }
  // Check for catch-all match
  else if (node.catchAllChild) {
    // Handle rest segments after catch-all (if any)
    if (node.catchAllChild.node && node.catchAllChild.node.children.size > 0) {
      // Try to find a matching rest segment for the remaining path
      // We need to check all possible places where the catch-all might end

      // First, let's try the most specific match: check if any segments after the catch-all
      // match the remainder of our path
      const tryRestSegmentMatch = (startIndex: number): boolean | null => {
        // Make sure we have segments remaining
        if (startIndex >= segments.length) {
          return null;
        }

        const remainingSegment = segments[startIndex]!;

        // If we have a match in the rest segments, follow that path
        if (node.catchAllChild?.node.children?.has(remainingSegment)) {
          const restNode = node.catchAllChild.node.children.get(remainingSegment)!;
          return findMatch(restNode, segments, startIndex + 1, defaultProtected);
        }

        return null;
      };

      // Try each possible ending position for the catch-all
      for (let i = index; i < segments.length; i++) {
        const result = tryRestSegmentMatch(i);
        if (result !== null) {
          return result;
        }
      }
    }

    // If no rest segments matched or if there are no rest segments,
    // use the catch-all node's protection status
    return node.catchAllChild.node.isProtected ?? defaultProtected;
  }

  // No match found, use default protection status
  return defaultProtected;
}
