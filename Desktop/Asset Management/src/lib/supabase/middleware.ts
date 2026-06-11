import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { parseDemoSessionCookie, DEMO_SESSION_COOKIE } from '@/lib/auth/demo-session';

const AUTH_ROUTES = ['/login', '/signup', '/forgot-password', '/reset-password'];

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

function isPublicRoute(pathname: string) {
  return (
    pathname.startsWith('/asset-lookup') ||
    pathname.startsWith('/auth/') ||
    pathname === '/'
  );
}

function isProtectedRoute(pathname: string) {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

function hasDemoSession(request: NextRequest): boolean {
  const raw = request.cookies.get(DEMO_SESSION_COOKIE)?.value;
  return parseDemoSessionCookie(raw) !== null;
}

function isDemoAuthEnabled() {
  return process.env.NEXT_PUBLIC_DEMO_AUTH === 'true';
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const demoAuthenticated = isDemoAuthEnabled() && hasDemoSession(request);
  const authenticated = Boolean(user) || demoAuthenticated;

  if (!authenticated && isProtectedRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    if (pathname !== '/dashboard') {
      url.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(url);
  }

  if (authenticated && isAuthRoute(pathname) && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  if (isPublicRoute(pathname) || isAuthRoute(pathname) || isProtectedRoute(pathname)) {
    return supabaseResponse;
  }

  return supabaseResponse;
}
