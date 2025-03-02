# @tradecrush/next-route-guard

> 🚀 **NEW v0.2.0**: Now with trie-based route matching (67× faster) and improved optional catch-all route handling!

A convention-based route authentication middleware for Next.js applications with App Router.

[![npm version](https://img.shields.io/npm/v/@tradecrush/next-route-guard.svg)](https://www.npmjs.com/package/@tradecrush/next-route-guard)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tests](https://github.com/tradecrush/next-route-guard/actions/workflows/tests.yml/badge.svg)](https://github.com/tradecrush/next-route-guard/actions/workflows/tests.yml)

## Features

- **🔒 Convention-based Protection**: Protect routes using directory naming conventions 
- **⚡ Middleware-Based**: Works with Next.js Edge middleware for fast authentication checks
- **🏗️ Build-time Analysis**: Generates route maps during build for Edge runtime compatibility
- **🔄 Inheritance**: Child routes inherit protection status from parent routes
- **🔀 Dynamic Routes**: Full support for Next.js dynamic routes, catch-all routes, and optional segments
- **⚙️ Zero Runtime Overhead**: Route protection rules are compiled at build time
- **🚀 Hyper-Optimized**: Uses trie-based algorithms that are 67× faster than linear search
- **🛠️ Flexible Configuration**: Customize authentication logic, redirection behavior, and more
- **👀 Watch Mode**: Development tool that updates route maps as you add or remove routes

## Why Next Route Guard?

Next.js App Router is great, but it lacks a simple way to protect routes based on authentication. Next Route Guard solves this problem by providing a convention-based approach to route protection:

- **No Duplicate Auth Logic**: Define your auth rules once in middleware, not in every page
- **Directory-Based**: Organize routes naturally using Next.js route groups like `(public)` and `(protected)`
- **Works with Any Auth Provider**: Compatible with any authentication system (JWT, cookies, OAuth, etc.)
- **Edge-Compatible**: Works with Next.js Edge middleware for optimal performance
- **TypeScript Support**: Fully typed for excellent developer experience

## Installation

```bash
npm install @tradecrush/next-route-guard
# or
yarn add @tradecrush/next-route-guard
# or
pnpm add @tradecrush/next-route-guard
```

## Quick Start

1. **Organize your routes** using the `(public)` and `(protected)` route groups:

```
app/
├── (public)/             # Public routes (no authentication required)
│   ├── login/
│   │   └── page.tsx
│   └── about/
│       └── page.tsx
├── (protected)/          # Protected routes (authentication required)
│   ├── dashboard/
│   │   └── page.tsx
│   └── settings/
│       └── page.tsx
└── layout.tsx            # Root layout (applies to all routes)
```

2. **Add the route map generation to your build script** in package.json:

```json
{
  "scripts": {
    "build": "next-route-guard-generate && next build",
    "dev": "next-route-guard-watch & next dev"
  }
}
```

3. **Create a middleware.ts file** in your project root:

```typescript
// middleware.ts
import { createRouteAuthMiddleware } from '@tradecrush/next-route-guard';
import routeMap from './app/route-map.json';
import { NextResponse } from 'next/server';

export default createRouteAuthMiddleware({
  routeMap,
  isAuthenticated: async (request) => {
    // Replace with your actual authentication logic
    // This is just an example using cookies
    const token = request.cookies.get('auth-token')?.value;
    return !!token;
    
    // Or using JWT from Authorization header
    // const authHeader = request.headers.get('Authorization');
    // return authHeader?.startsWith('Bearer ') || false;
  },
  onUnauthenticated: (request) => {
    // Redirect to login with return URL
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('returnTo', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
});

export const config = {
  matcher: [
    // Match all routes except static files, api routes, and other special paths
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ]
};
```

4. **That's it!** Your routes are now protected based on their directory structure.

## How It Works

The package works in two stages:

### 1. Build Time: Route Analysis

During your build process, the `next-route-guard-generate` command:
- Scans your Next.js app directory structure
- Identifies routes and their protection status based on route groups
- Generates a static `route-map.json` file containing protected and public routes

### 2. Runtime: Middleware Protection

The middleware:
- Uses the generated route map to build an optimized route trie data structure
- Efficiently matches request paths against the trie to determine protection status
- Checks authentication status for protected routes
- Redirects unauthenticated users to login (or your custom logic)
- Allows direct access to public routes

### Performance Benchmarks

Performance measurements with 1400 routes in the route map:

```
Routes: 1400
Average time per request: 0.004ms

Test path                                 | Time per request
------------------------------------------|----------------
/public/page-250                          | 0.005ms
/protected/page-499                       | 0.006ms
/public/dynamic-50/12345                  | 0.003ms
/protected/catch-25/a/b/c/d/e/f/g/h/i/j   | 0.005ms
/protected/catch-49/a/b/c/edit            | 0.003ms
/unknown/path/not/found                   | 0.003ms
```

These benchmarks were run on Node.js v22.14.0 on a MacBook Pro (M3 Max), with 1000 requests per path.

#### Performance Comparison with Previous Version

Comparing to the previous linear search implementation (v0.1.4):

| Implementation | Avg time/request | Speedup |
|----------------|------------------|---------|
| Linear search  | 0.271ms          | 1×      |
| Trie-based     | 0.004ms          | 67.75×  |

The trie-based implementation is **67.75× faster** on average, with particular improvements for:
- Complex paths with many segments (90× faster for catch-all routes)
- Non-existent routes (387× faster)

### Route Trie Optimization

Next Route Guard uses a specialized trie (prefix tree) data structure for route matching that dramatically improves performance:

- **O(k) Matching Complexity**: Routes are matched in time proportional to the path depth (k), not the total number of routes (n)
- **Space-Efficient**: Shared path prefixes are stored once in the tree structure
- **Advanced Route Pattern Support**: Optimized handling of all Next.js route patterns:
  - Dynamic segments: `/users/[id]` 
  - Catch-all routes: `/docs/[...slug]`
  - Optional catch-all: `/docs/[[...slug]]`
  - Complex paths with rest segments: `/docs/[...slug]/edit`
  - Multiple dynamic segments: `/products/[category]/[id]/details`
  - Mixed dynamic and catch-all: `/articles/[section]/[...tags]/share`
- **One-time Initialization**: The trie is built once when middleware initializes, then reused for all requests
- **Consistent Performance**: Lookup time remains stable regardless of route count (O(k) vs O(n×m))
- **Protection Inheritance**: Route protection statuses naturally flow through the tree structure

#### How the Route Trie Works

The route trie transforms your app directory structure into a tree representation that efficiently handles route protection. Let's look at a comprehensive example of a Next.js app directory with various route patterns:

```
app/
├── (public)/                          # Public routes group
│   ├── about/
│   │   └── page.tsx                   # /about
│   ├── products/
│   │   ├── page.tsx                   # /products
│   │   └── [id]/
│   │       ├── page.tsx               # /products/[id]
│   │       ├── reviews/
│   │       │   └── page.tsx           # /products/[id]/reviews
│   │       └── (protected)/           # Nested protected group inside public
│   │           └── edit/
│   │               └── page.tsx       # /products/[id]/edit (protected)
│   └── help/
│       ├── page.tsx                   # /help
│       └── (protected)/               # Nested protected group
│           └── admin/
│               └── page.tsx           # /help/admin (protected)
├── (protected)/                       # Protected routes group
│   ├── dashboard/
│   │   ├── page.tsx                   # /dashboard
│   │   ├── @stats/                    # Parallel route
│   │   │   └── page.tsx               # /dashboard/@stats
│   │   └── settings/
│   │       └── page.tsx               # /dashboard/settings
│   ├── docs/
│   │   ├── page.tsx                   # /docs
│   │   ├── [...slug]/                 # Required catch-all
│   │   │   └── page.tsx               # /docs/[...slug]
│   │   └── (public)/                  # Nested public group inside protected
│   │       └── preview/
│   │           └── page.tsx           # /docs/preview (public)
│   └── admin/
│       ├── page.tsx                   # /admin (protected)
│       └── [[...slug]]/               # Optional catch-all (protects all subpaths)
│           └── page.tsx               # /admin/settings, /admin/users, etc.
└── layout.tsx
```

This directory structure is converted to the following route trie:

```
/ (root)
├── about (public)                     # From (public)/about
├── products (public)                  # From (public)/products
│   └── [id] (dynamic - public)        # From (public)/products/[id]
│       ├── reviews (public)           # From (public)/products/[id]/reviews
│       └── edit (protected)           # From (public)/products/[id]/(protected)/edit
├── help (public)                      # From (public)/help
│   └── admin (protected)              # From (public)/help/(protected)/admin
├── dashboard (protected)              # From (protected)/dashboard
│   ├── @stats (protected)             # From (protected)/dashboard/@stats
│   └── settings (protected)           # From (protected)/dashboard/settings
├── docs (protected)                   # From (protected)/docs
│   ├── [...slug] (protected)          # From (protected)/docs/[...slug]
│   └── preview (public)               # From (protected)/docs/(public)/preview
└── admin (protected)                  # From (protected)/admin
    └── [[...slug]] (protected)        # From (protected)/admin/[[...slug]]
```

When a request arrives:
1. The URL is split into segments (e.g., `/docs/api/auth` → `["docs", "api", "auth"]`)
2. The trie is traversed segment-by-segment, matching:
   - Exact matches first (highest priority)
   - Dynamic parameters next (e.g., `[id]`)
   - Catch-all segments as needed (e.g., `[...slug]`, `[[...optionalPath]]`)
3. Protection status is determined from the matched node or parent nodes
   - `/docs/api` matches the `[...slug]` catch-all → protected
   - `/docs/preview` matches an exact path with custom protection → public
   - `/products/123/edit` has a nested protection override → protected
   - `/help/admin` has a nested protection override → protected
   - `/admin/users` matches the optional catch-all → protected
   - `/admin` is protected as the base path for the catch-all
   - `/dashboard/profile` doesn't exist but falls under protected parent → protected
   - `/about/team` doesn't exist but falls under public parent → public

This approach provides orders of magnitude better performance than a linear search through route lists, especially for applications with many routes or complex routing patterns.

## Route Protection Rules

Routes are protected based on the following rules:

1. Routes inside a `(public)` directory group are **always public**
2. Routes inside a `(protected)` directory group are **always protected**
3. Child routes inherit protection from parent routes
4. Routes not explicitly marked inherit the default setting (protected by default)

## CLI Tools

The package includes two command-line tools to help manage your route maps:

### next-route-guard-generate

Generates the route map file at build time:

```bash
# Basic usage with defaults
next-route-guard-generate

# With custom options
next-route-guard-generate --app-dir ./src/app --output ./src/lib/route-map.json
```

Options:
```
--app-dir <path>       Path to the app directory (default: ./app)
--output <path>        Path to the output JSON file (default: ./app/route-map.json)
--public <patterns>    Comma-separated list of public route patterns (default: (public))
--protected <patterns> Comma-separated list of protected route patterns (default: (protected))
--help                 Display this help message
```

### next-route-guard-watch

Watches for route changes during development:

```bash
# Basic usage
next-route-guard-watch

# With custom options
next-route-guard-watch --app-dir ./src/app --output ./src/lib/route-map.json
```

Options: Same as `next-route-guard-generate`

## Advanced Configuration

### Custom Route Groups

You can define your own route group names:

```bash
next-route-guard-generate --public "(guest),(unprotected)" --protected "(auth),(secure)"
```

This allows you to use your own conventions in the directory structure:

```
app/
├── (guest)/           # Public routes
│   └── login/
├── (unprotected)/     # More public routes
│   └── about/
├── (auth)/            # Protected routes
│   └── dashboard/
└── (secure)/          # More protected routes
    └── admin/
```

### Route Map Location

By default, the route map is saved to `./app/route-map.json`. You can customize this location:

```bash
next-route-guard-generate --output "./lib/route-map.json"
```

Then update your middleware to import from the new location:

```typescript
import routeMap from './lib/route-map.json';
```

### Excluding URLs

Some URL patterns can be excluded from authentication checks:

```typescript
createRouteAuthMiddleware({
  // ...
  excludeUrls: [
    '/api/(.*)',        // Exclude API routes 
    '/images/(.*)',     // Exclude static image paths
    '/cdn-proxy/(.*)'   // Exclude CDN proxy paths
  ]
});
```

### Default Protection Mode

By default, routes are protected unless explicitly marked as public. You can change this behavior:

```typescript
createRouteAuthMiddleware({
  // ...
  defaultProtected: false  // Routes are public by default
});
```

This means routes without explicit protection groups will be treated as public.

### Custom Authentication Logic

Implement your own authentication logic by providing an `isAuthenticated` function:

```typescript
createRouteAuthMiddleware({
  // ...
  isAuthenticated: async (request) => {
    // Check for a JWT in the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }
    
    const token = authHeader.split(' ')[1];
    try {
      // Verify the token (using your preferred JWT library)
      const payload = await verifyJwt(token);
      return !!payload;
    } catch (error) {
      return false;
    }
  }
});
```

### Custom Redirection Behavior

Override the default redirection behavior:

```typescript
createRouteAuthMiddleware({
  // ...
  onUnauthenticated: (request) => {
    // Different behavior based on route type
    const url = request.nextUrl.clone();
    
    // If it's an API request, return a 401 response
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // For dashboard routes, redirect to a custom login page
    if (request.nextUrl.pathname.startsWith('/dashboard/')) {
      url.pathname = '/dashboard-login';
      url.searchParams.set('returnTo', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
    
    // Default login redirect
    url.pathname = '/login';
    url.searchParams.set('returnTo', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
});
```

### Chaining Middleware

You can combine authentication with other middleware:

```typescript
import { createRouteAuthMiddleware, chain } from '@tradecrush/next-route-guard';
import { NextResponse } from 'next/server';

// Logging middleware
const withLogging = (next) => {
  return (request) => {
    console.log(`Request: ${request.method} ${request.url}`);
    return next(request);
  };
};

// Auth middleware factory
const withAuth = createRouteAuthMiddleware({
  // Your auth options...
});

// Export the chained middleware
export default function middleware(request) {
  return chain([withLogging, withAuth])(request);
}
```

## Example Scenarios

### Simple Public/Protected Split

```
app/
├── (public)/
│   ├── login/
│   │   └── page.tsx
│   ├── register/
│   │   └── page.tsx
│   └── about/
│       └── page.tsx
└── (protected)/
    ├── dashboard/
    │   └── page.tsx
    └── profile/
        └── page.tsx
```

### Mixed Hierarchies

```
app/
├── (public)/
│   ├── help/
│   │   └── page.tsx
│   └── login/
│       └── page.tsx
├── dashboard/                # Protected (default)
│   ├── (public)/
│   │   └── preview/          # Public route inside a protected area
│   │       └── page.tsx
│   ├── overview/             # Protected
│   │   └── page.tsx
│   └── settings/             # Protected
│       └── page.tsx
└── layout.tsx
```

In this example, `/dashboard/preview` is public even though it's inside the protected `/dashboard` area.

### Dynamic Routes

```
app/
├── (public)/
│   └── articles/
│       ├── page.tsx
│       └── [slug]/           # Public article pages
│           └── page.tsx
├── (protected)/
│   └── users/
│       ├── page.tsx
│       └── [id]/             # Protected user profiles
│           └── page.tsx
└── docs/                     # Protected by default
    ├── [...slug]/            # Catch-all route
    │   └── page.tsx
    └── page.tsx
```

Here, article pages with dynamic slugs are public, while user profiles with dynamic IDs are protected.

## API Reference

### createRouteAuthMiddleware

Creates a Next.js middleware function that handles authentication based on route patterns.

```typescript
function createRouteAuthMiddleware(options: RouteAuthOptions): Middleware
```

#### RouteAuthOptions

```typescript
interface RouteAuthOptions {
  /**
   * Function to determine if a user is authenticated
   */
  isAuthenticated: (request: NextRequest) => Promise<boolean> | boolean;

  /**
   * Function to handle unauthenticated requests
   * @default Redirects to /login
   */
  onUnauthenticated?: (request: NextRequest) => Promise<NextResponse> | NextResponse;

  /**
   * Map of protected and public routes
   * Generated at build time for Edge runtime compatibility
   */
  routeMap: RouteMap;

  /**
   * Default behavior for routes not matching any pattern
   * @default true - Routes are protected by default
   */
  defaultProtected?: boolean;

  /**
   * URLs to exclude from auth checking (regexes or strings)
   * @default ['/api/(.*)']
   */
  excludeUrls?: (string | RegExp)[];
}
```

#### RouteMap

```typescript
interface RouteMap {
  /**
   * Array of paths that are protected and require authentication
   */
  protected: string[];

  /**
   * Array of paths that are public and don't require authentication
   */
  public: string[];
}
```

### chain

Function to chain multiple middleware factories together.

```typescript
function chain(functions: MiddlewareFactory[], index = 0): Middleware
```

#### MiddlewareFactory

```typescript
type MiddlewareFactory = (middleware: Middleware) => Middleware;
```

#### Middleware

```typescript
type Middleware = (
  request: NextRequest,
  event?: NextFetchEvent
) => Promise<NextResponse | undefined> | NextResponse | undefined;
```

## TypeScript Support

The package includes TypeScript definitions for all APIs:

```typescript
import { 
  createRouteAuthMiddleware, 
  chain,
  type RouteAuthOptions, 
  type RouteMap,
  type Middleware,
  type MiddlewareFactory
} from '@tradecrush/next-route-guard';
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
