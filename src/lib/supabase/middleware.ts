import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { parseDemoSessionCookie, DEMO_SESSION_COOKIE } from '@/lib/auth/demo-session';
import { isAuthSessionMissingError, logLoginStep, serializeAuthError } from '@/lib/auth/auth-log';

const AUTH_ROUTES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth/reset-password',
  '/activate-account',
];

const PASSWORD_RESET_ROUTES = ['/reset-password', '/auth/reset-password'];
const LOGIN_ID_COOKIE = 'login_attempt_id';

function getLoginId(request: NextRequest) {
  return request.cookies.get(LOGIN_ID_COOKIE)?.value ?? 'middleware-login-unknown';
}

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

function isPasswordResetRoute(pathname: string) {
  return PASSWORD_RESET_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

function isPublicRoute(pathname: string) {
  return (
    pathname.startsWith('/asset-lookup') ||
    pathname.startsWith('/verify') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/activate-account') ||
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
  const loginId = getLoginId(request);
  logLoginStep(loginId, 'middleware auth check', 'START', {
    method: request.method,
    pathname: request.nextUrl.pathname,
  });

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

  let user = null;
  try {
    const authResponse = await supabase.auth.getUser();
    user = authResponse.data.user;
    if (authResponse.error && !isAuthSessionMissingError(authResponse.error)) {
      logLoginStep(loginId, 'middleware auth check', 'FAILED', {
        error: authResponse.error,
      });
      console.error('[middleware] getCurrentUser returned error', {
        pathname: request.nextUrl.pathname,
        ...serializeAuthError(authResponse.error),
      });
    }
  } catch (err) {
    logLoginStep(loginId, 'middleware auth check', 'FAILED', {
      error: err,
      stack: err instanceof Error ? err.stack : undefined,
    });
    console.error('[middleware] getCurrentUser threw', {
      pathname: request.nextUrl.pathname,
      message: err instanceof Error ? err.message : String(err ?? 'Unknown middleware auth error'),
      name: err instanceof Error ? err.name : 'UnknownError',
      stack: err instanceof Error ? err.stack : undefined,
    });
  }

  const pathname = request.nextUrl.pathname;
  const demoAuthenticated = isDemoAuthEnabled() && hasDemoSession(request);
  const authenticated = Boolean(user) || demoAuthenticated;
  const isServerActionLikeRequest =
    request.method !== 'GET' ||
    request.headers.has('next-action') ||
    request.headers.get('accept')?.includes('text/x-component');

  console.log('[middleware] auth route check', {
    method: request.method,
    pathname,
    authenticated,
    isAuthRoute: isAuthRoute(pathname),
    isProtectedRoute: isProtectedRoute(pathname),
    isServerActionLikeRequest,
  });
  logLoginStep(loginId, 'middleware auth check', 'SUCCESS', {
    method: request.method,
    pathname,
    authenticated,
    isAuthRoute: isAuthRoute(pathname),
    isProtectedRoute: isProtectedRoute(pathname),
    isServerActionLikeRequest,
  });

  if (!authenticated && isProtectedRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    if (pathname !== '/dashboard') {
      url.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(url);
  }

  if (
    authenticated &&
    isAuthRoute(pathname) &&
    user &&
    !isServerActionLikeRequest &&
    !isPasswordResetRoute(pathname)
  ) {
    console.log('[middleware] redirect authenticated auth-route GET to dashboard', {
      pathname,
      method: request.method,
    });
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  if (authenticated && isAuthRoute(pathname) && user && isServerActionLikeRequest) {
    console.log('[middleware] allow authenticated auth-route action request', {
      pathname,
      method: request.method,
    });
  }

  if (isPublicRoute(pathname) || isAuthRoute(pathname) || isProtectedRoute(pathname)) {
    return supabaseResponse;
  }

  return supabaseResponse;
}
