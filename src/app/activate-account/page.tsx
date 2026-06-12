'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { activateAccountAction, getInvitationByTokenAction } from '@/app/actions/invitations';
import { activateInvitedProfileAction } from '@/app/actions/auth';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Skeleton } from '@/components/common/Skeleton';

function ActivateAccountForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<{
    first_name: string;
    last_name: string;
    role: string;
    email: string;
  } | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const init = async () => {
      if (token) {
        const result = await getInvitationByTokenAction(token);
        if (result.error) {
          setError(result.error);
        } else if (result.data) {
          setInviteInfo({
            first_name: result.data.first_name,
            last_name: result.data.last_name,
            role: result.data.role,
            email: result.data.email,
          });
        }
      }

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }

      setChecking(false);
    };

    init();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    if (token) {
      const result = await activateAccountAction({ token, password });
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      const supabase = createClient();
      if (inviteInfo?.email) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: inviteInfo.email,
          password,
        });
        if (signInError) {
          setError(signInError.message);
          setLoading(false);
          return;
        }
      }

      router.push('/dashboard');
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setLoading(false);
      setError(updateError.message);
      return;
    }

    const activation = await activateInvitedProfileAction();
    setLoading(false);

    if (activation.error) {
      setError(activation.error);
      return;
    }

    router.push('/dashboard');
  };

  if (checking) {
    return (
      <AuthShell heading="Welcome to Asset Command Center">
        <div className="space-y-3">
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell heading="Welcome to Asset Command Center">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/10">
          <ShieldCheck className="h-6 w-6 text-violet-400" />
        </div>
        <p className="text-sm text-zinc-400">
          {inviteInfo
            ? `Hello ${inviteInfo.first_name}, create your password to activate your ${inviteInfo.role} account.`
            : 'Create your password to activate your account.'}
        </p>
      </div>

      {error && <div className="mb-4"><ErrorAlert message={error} /></div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password" className="text-zinc-300">Password</Label>
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
          <Label htmlFor="confirm" className="text-zinc-300">Confirm Password</Label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            className="rounded-xl border-white/10 bg-white/5 text-white"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-5"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Activate Account
        </Button>
      </form>

      <Link href="/login" className="mt-4 block text-center text-sm text-violet-400 hover:text-violet-300">
        Back to sign in
      </Link>
    </AuthShell>
  );
}

export default function ActivateAccountPage() {
  return (
    <Suspense fallback={<AuthShell heading="Welcome to Asset Command Center"><Skeleton className="h-64 rounded-xl" /></AuthShell>}>
      <ActivateAccountForm />
    </Suspense>
  );
}
