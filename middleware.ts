import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const token = request.cookies.get('token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');

    // Public routes that don't require authentication
    const publicRoutes = ['/login', '/register'];
    const isPublicRoute = publicRoutes.some(route => request.nextUrl.pathname.startsWith(route));

    // API routes that require authentication
    const protectedApiRoutes = ['/api/user', '/api/expenses', '/api/accounts', '/api/categories', '/api/incomes', '/api/subscriptions'];
    const isProtectedApiRoute = protectedApiRoutes.some(route => request.nextUrl.pathname.startsWith(route));

    // If accessing a protected API route without token, return 401
    if (isProtectedApiRoute && !token) {
        return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
        );
    }

    // If accessing protected page without token, redirect to login
    if (!isPublicRoute && !request.nextUrl.pathname.startsWith('/api/') && !token) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // If accessing login/register while authenticated, redirect to home
    if ((request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register') && token) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};