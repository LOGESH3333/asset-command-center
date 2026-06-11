import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getSiteUrlFromEnv } from '@/lib/auth/site-url';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('redirect') ?? '/dashboard';
  const origin = getSiteUrlFromEnv();

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const safeNext = next.startsWith('/') ? next : '/dashboard';
      return NextResponse.redirect(`${origin}${safeNext}`);
    }

    console.error('[auth:password-reset-callback]', {
      step: 'exchangeCodeForSession',
      origin,
      next,
      error: {
        message: error.message,
        name: error.name,
        status: error.status,
        code: 'code' in error ? (error as { code?: string }).code : undefined,
      },
    });

    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', error.message);
    return NextResponse.redirect(loginUrl);
  }

  console.error('[auth:password-reset-callback]', {
    step: 'missing-code',
    origin,
    next,
  });

  return NextResponse.redirect(`${origin}/login`);
}
