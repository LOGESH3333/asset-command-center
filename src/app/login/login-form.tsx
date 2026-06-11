'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { createDemoSession, saveDemoSession } from '@/lib/auth/demo-session';
import { postLoginAction } from '@/app/actions/auth';
import {
  logAuthEvent,
  logLoginStep,
  normalizeAuthEmail,
  serializeAuthError,
} from '@/lib/auth/auth-log';
import { mapLoginError } from '@/lib/auth/errors';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Loader2 } from 'lucide-react';

const DEMO_AUTH = process.env.NEXT_PUBLIC_DEMO_AUTH === 'true';
const LOGIN_ID_COOKIE = 'login_attempt_id';

function createLoginId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function setLoginIdCookie(loginId: string) {
  document.cookie = `${LOGIN_ID_COOKIE}=${encodeURIComponent(loginId)}; path=/; max-age=300; SameSite=Lax`;
}

export default function LoginForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const loginId = createLoginId();
    setLoginIdCookie(loginId);
    logLoginStep(loginId, 'loginAttempt', 'START');
    setLoading(true);
    setError(null);

    const normalizedEmail = normalizeAuthEmail(email);
    if (!normalizedEmail || !password) {
      logLoginStep(loginId, 'inputValidation', 'FAILED', {
        message: 'Missing email or password',
      });
      setError('Please enter your email and password.');
      setLoading(false);
      return;
    }

    if (DEMO_AUTH) {
      const session = createDemoSession({ email: normalizedEmail });
      saveDemoSession(session);
      window.location.href = redirect;
      return;
    }

    const supabase = createClient();

    logAuthEvent('login', {
      email: normalizedEmail,
      provider: 'supabase-signInWithPassword',
    });

    let signInResponse: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
    try {
      logLoginStep(loginId, 'signInWithPassword', 'START', { email: normalizedEmail });
      signInResponse = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (signInResponse.error) {
        logLoginStep(loginId, 'signInWithPassword', 'FAILED', {
          email: normalizedEmail,
          error: signInResponse.error,
        });
      } else {
        logLoginStep(loginId, 'signInWithPassword', 'SUCCESS', {
          hasSession: Boolean(signInResponse.data.session),
          userId: signInResponse.data.user?.id ?? null,
        });
      }
    } catch (err) {
      logLoginStep(loginId, 'signInWithPassword', 'FAILED', {
        email: normalizedEmail,
        error: err,
      });
      setError(
        mapLoginError(
          err instanceof Error ? err.message : String(err ?? 'signInWithPassword threw an unknown error')
        )
      );
      setLoading(false);
      return;
    }

    const { data, error: signInError } = signInResponse;

    const errorCode =
      signInError && 'code' in signInError
        ? String((signInError as { code?: string }).code)
        : undefined;

    logAuthEvent('login', {
      email: normalizedEmail,
      response: {
        error: serializeAuthError(signInError),
        hasSession: Boolean(data?.session),
        userId: data?.user?.id,
        emailConfirmedAt: data?.user?.email_confirmed_at,
      },
    });

    if (signInError) {
      // Unconfirmed emails often surface as "invalid login credentials" in Supabase
      if (
        errorCode === 'email_not_confirmed' ||
        signInError.message.toLowerCase().includes('email not confirmed')
      ) {
        await supabase.auth.resend({ type: 'signup', email: normalizedEmail });
        logAuthEvent('login', { email: normalizedEmail, resentConfirmation: true });
      }
      setError(mapLoginError(signInError.message, errorCode));
      setLoading(false);
      return;
    }

    if (!data.session) {
      logLoginStep(loginId, 'signInWithPassword', 'FAILED', {
        message: 'Supabase signInWithPassword returned no session.',
        code: 'no_session',
      });
      logAuthEvent('login', {
        email: normalizedEmail,
        warning: 'signIn succeeded but no session returned',
      });
      setError('Login failed. Please try again or contact your administrator.');
      setLoading(false);
      return;
    }

    try {
      logLoginStep(loginId, 'postLoginAction', 'START', {
        email: normalizedEmail,
        authId: data.user.id,
      });
      const postLogin = await postLoginAction(data.user.id, normalizedEmail, loginId);
      logLoginStep(loginId, 'postLoginAction', 'SUCCESS', {
        email: normalizedEmail,
        authId: data.user.id,
        response: postLogin,
      });
      if (postLogin.error) {
        logLoginStep(loginId, 'postLoginAction', 'FAILED', postLogin.error);
        setError(postLogin.error);
        setLoading(false);
        return;
      }
      logLoginStep(loginId, 'redirect', 'START', {
        target: postLogin.redirect ?? redirect,
      });
      window.location.href = postLogin.redirect ?? redirect;
    } catch (err) {
      logLoginStep(loginId, 'postLoginAction', 'FAILED', { error: err });
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <AuthShell heading="Sign in to your workspace">
      {DEMO_AUTH && (
        <p className="mb-4 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-center text-xs text-violet-300">
          Demo mode — any email and password will sign you in.
        </p>
      )}

      {error && (
        <div className="mb-4">
          <ErrorAlert message={error} />
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-zinc-300">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-xl border-white/10 bg-white/5 text-white placeholder:text-zinc-600 focus-visible:ring-violet-500/50"
            placeholder="you@company.com"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-zinc-300">Password</Label>
            {!DEMO_AUTH && (
              <Link href="/forgot-password" className="text-xs text-violet-400 hover:text-violet-300">
                Forgot password?
              </Link>
            )}
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="rounded-xl border-white/10 bg-white/5 text-white placeholder:text-zinc-600 focus-visible:ring-violet-500/50"
            placeholder="••••••••"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="neon-button w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-5 font-semibold shadow-lg shadow-violet-500/30 transition-all hover:shadow-violet-500/50"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign In
        </Button>
      </form>

      {DEMO_AUTH ? (
        <div className="mt-6">
          <Link href="/signup" className="block">
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl border-white/10 bg-white/[0.03] py-5 text-zinc-200 hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-white"
            >
              Create Account
            </Button>
          </Link>
        </div>
      ) : null}
    </AuthShell>
  );
}
