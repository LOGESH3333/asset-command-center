'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { createDemoSession, saveDemoSession } from '@/lib/auth/demo-session';
import { mapLoginError } from '@/lib/auth/errors';
import { logAuthEvent, normalizeAuthEmail, serializeAuthError } from '@/lib/auth/auth-log';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Loader2 } from 'lucide-react';

const DEMO_AUTH = process.env.NEXT_PUBLIC_DEMO_AUTH === 'true';

export default function LoginForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const normalizedEmail = normalizeAuthEmail(email);
    if (!normalizedEmail || !password) {
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

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

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
      logAuthEvent('login', {
        email: normalizedEmail,
        warning: 'signIn succeeded but no session returned',
      });
      setError(mapLoginError('Email not confirmed', 'email_not_confirmed'));
      setLoading(false);
      return;
    }

    window.location.href = redirect;
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
    </AuthShell>
  );
}
