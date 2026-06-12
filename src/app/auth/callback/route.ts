import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { getAppUrl } from '@/lib/auth/site-url';
import { logAuthEvent, serializeAuthError } from '@/lib/auth/auth-log';

const DEFAULT_RECOVERY_PATH = '/auth/reset-password';

function resolveNextPath(
  redirect: string | null,
  type: string | null
): string {
  if (redirect?.startsWith('/')) {
    return redirect;
  }
  if (type === 'recovery') {
    return DEFAULT_RECOVERY_PATH;
  }
  return '/dashboard';
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');
  const redirect = requestUrl.searchParams.get('redirect');
  const origin = getAppUrl();
  const nextPath = resolveNextPath(redirect, type);

  logAuthEvent('password-reset-callback', {
    step: 'callback-received',
    origin,
    nextPath,
    query: {
      codePresent: Boolean(code),
      tokenHashPresent: Boolean(tokenHash),
      type,
      redirect,
    },
  });

  if (!code && !(tokenHash && type === 'recovery')) {
    logAuthEvent('password-reset-callback', {
      step: 'missing-recovery-token',
      origin,
      nextPath,
    });

    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', 'password_reset_link_invalid');
    return NextResponse.redirect(loginUrl);
  }

  const cookieStore = await cookies();
  let response = NextResponse.redirect(`${origin}${nextPath}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  let exchangeError: { message: string } | null = null;

  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    exchangeError = result.error;

    logAuthEvent('password-reset-callback', {
      step: 'session-exchange',
      method: 'exchangeCodeForSession',
      response: {
        error: serializeAuthError(result.error),
        hasSession: Boolean(result.data.session),
        userId: result.data.session?.user?.id ?? null,
      },
    });
  } else if (tokenHash && type === 'recovery') {
    const result = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'recovery',
    });
    exchangeError = result.error;

    logAuthEvent('password-reset-callback', {
      step: 'session-exchange',
      method: 'verifyOtp',
      response: {
        error: serializeAuthError(result.error),
        hasSession: Boolean(result.data.session),
        userId: result.data.session?.user?.id ?? null,
      },
    });
  }

  if (exchangeError) {
    console.error('[auth:callback] session exchange failed', {
      origin,
      nextPath,
      error: exchangeError,
    });

    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', exchangeError.message);
    return NextResponse.redirect(loginUrl);
  }

  logAuthEvent('password-reset-callback', {
    step: 'redirect-to-reset',
    origin,
    nextPath,
  });

  return response;
}
