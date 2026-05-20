import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Decode JWT payload without verification (edge runtime can't use jsonwebtoken).
 * Safe because real authorization is enforced by backend.
 * This is just for UX routing.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  // Handle specific URL redirects to avoid 404s
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }
  
  if (pathname === '/seller') {
    return NextResponse.redirect(new URL('/seller/products', request.url));
  }

  const isAuthRoute = pathname.startsWith('/auth');

  if (isAuthRoute) {
    if (token) {
      // Decode the token to get the role and redirect properly
      const payload = decodeJwtPayload(token);
      const role = payload?.role as string | undefined;
      
      if (role === 'superadmin') {
        return NextResponse.redirect(new URL('/admin', request.url));
      } else if (role === 'seller') {
        return NextResponse.redirect(new URL('/seller/products', request.url));
      } else {
        return NextResponse.redirect(new URL('/orders', request.url));
      }
    }
    return NextResponse.next();
  }

  const isProtectedRoute =
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/orders') ||
    pathname.startsWith('/seller') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/profile');

  // 1. Redirect guests from protected routes (including unauthorized page)
  if (isProtectedRoute && !token) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // 2. Allow unauthorized page for LOGGED-IN non-sellers
  const isUnauthorizedPage = pathname === '/seller/unauthorized';
  if (isUnauthorizedPage) {
    return NextResponse.next();
  }

  // 3. Seller route guard: check role from JWT
  if (pathname.startsWith('/seller') && token) {
    const payload = decodeJwtPayload(token);
    const role = payload?.role as string | undefined;

    // Strict role check
    if (role !== 'seller' && role !== 'superadmin') {
      return NextResponse.redirect(new URL('/seller/unauthorized', request.url));
    }
  }

  // Admin route guard: check role from JWT
  if (pathname.startsWith('/admin') && token) {
    const payload = decodeJwtPayload(token);
    const role = payload?.role as string | undefined;

    if (role !== 'superadmin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/login',
    '/auth/:path*',
    '/checkout/:path*',
    '/orders/:path*',
    '/seller/:path*',
    '/admin/:path*',
    '/profile/:path*',
    '/profile',
  ],
};
