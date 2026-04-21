import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  const isAuthRoute = pathname.startsWith('/auth');

  if (isAuthRoute) {
    if (token) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  const isProtectedRoute = 
    pathname.startsWith('/checkout') || 
    pathname.startsWith('/orders') || 
    pathname.startsWith('/seller') || 
    pathname.startsWith('/admin');

  if (isProtectedRoute && !token) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // Simplified role check without decoding JWT. 
  // Real role protection should query an endpoint or securely verify JWT.
  // For basic scaffold, backend will block unauthorized requests anyway.

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/auth/:path*', 
    '/checkout/:path*', 
    '/orders/:path*', 
    '/seller/:path*', 
    '/admin/:path*'
  ],
};
