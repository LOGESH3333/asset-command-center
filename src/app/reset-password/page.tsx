'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { logAuthEvent, serializeAuthError } from '@/lib/auth/auth-log';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/common/Skeleton';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [canReset, setCanReset] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const establishRecoverySession = async () => {
      logAuthEvent('password-reset-update', {
        step: 'check-session',
        href: window.location.href.split('#')[0],
        hashPresent: window.location.hash.length > 0,
      });

      // Implicit / hash flow: #access_token=...&type=recovery
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');

      if (accessToken && refreshToken && type === 'recovery') {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        logAuthEvent('password-reset-update', {
          step: 'set-session-from-hash',
          response: {
            error: serializeAuthError(sessionError),
            hasSession: Boolean(data.session),
          },
        });

        if (sessionError) {
          setError(sessionError.message);
          setCheckingSession(false);
          return;
        }

        window.history.replaceState(null, '', window.location.pathname);
        setCanReset(true);
        setCheckingSession(false);
        return;
      }

      const { data: { session }, error: getSessionError } = await supabase.auth.getSession();

      logAuthEvent('password-reset-update', {
        step: 'get-session',
        response: {
          error: serializeAuthError(getSessionError),
          hasSession: Boolean(session),
          userId: session?.user?.id,
        },
      });

      if (session) {
        setCanReset(true);
        setCheckingSession(false);
        return;
      }

      setError(
        'Your reset link is invalid or has expired. Request a new link from the forgot password page.'
      );
      setCheckingSession(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      logAuthEvent('password-reset-update', {
        step: 'auth-state-change',
        event,
        hasSession: Boolean(session),
      });
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setCanReset(true);
        setCheckingSession(false);
        setError(null);
      }
    });

    establishRecoverySession();

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!canReset) {
      setError('No active password recovery session. Request a new reset link.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    logAuthEvent('password-reset-update', { step: 'update-user' });

    const { data, error: updateError } = await supabase.auth.updateUser({ password });

    logAuthEvent('password-reset-update', {
      step: 'update-user-response',
      response: {
        error: serializeAuthError(updateError),
        userId: data.user?.id,
      },
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  };

  if (checkingSession) {
    return (
      <AuthShell heading="Set a new password">
        <div className="space-y-3">
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell heading="Set a new password">
      {error && <div className="mb-4"><ErrorAlert message={error} /></div>}
      {canReset ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-zinc-300">New password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="rounded-xl border-white/10 bg-white/5 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm" className="text-zinc-300">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="rounded-xl border-white/10 bg-white/5 text-white"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-5">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </form>
      ) : (
        <Link href="/forgot-password">
          <Button className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600">
            Request a new reset link
          </Button>
        </Link>
      )}
      <Link href="/login" className="mt-4 block text-center text-sm text-violet-400 hover:text-violet-300">
        Back to sign in
      </Link>
    </AuthShell>
  );
}
