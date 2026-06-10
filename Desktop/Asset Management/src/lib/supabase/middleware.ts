import { NextResponse, type NextRequest } from 'next/server';
import { parseDemoSessionCookie, DEMO_SESSION_COOKIE } from '@/lib/auth/demo-session';

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/dashboard/assets',
  '/dashboard/requests',
  '/dashboard/maintenance',
  '/dashboard/vendors',
  '/dashboard/categories',
  '/dashboard/reports',
  '/dashboard/notifications',
  '/dashboard/audit-logs',
  '/dashboard/settings',
  '/dashboard/users',
];

function isProtectedRoute(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function hasDemoSession(request: NextRequest): boolean {
  const raw = request.cookies.get(DEMO_SESSION_COOKIE)?.value;
  return parseDemoSessionCookie(raw) !== null;
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/auth');

  const authenticated = hasDemoSession(request);

  if (!authenticated && isProtectedRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    if (pathname !== '/dashboard') {
      url.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(url);
  }

  if (authenticated && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}
