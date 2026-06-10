'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Loader2, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter your email address.');
      setLoading(false);
      return;
    }

    const origin = window.location.origin;
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${origin}/reset-password`,
    });

    if (resetError) {
      setError('Unable to send reset email. Please try again.');
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  return (
    <AuthShell heading="Reset your password">
      {sent ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
            <CheckCircle2 className="h-7 w-7 text-emerald-400" />
          </div>
          <p className="text-sm text-zinc-400">
            If an account exists for <strong className="text-white">{email}</strong>, you will receive
            a password reset link shortly.
          </p>
          <Link href="/login">
            <Button variant="outline" className="w-full rounded-xl">Back to sign in</Button>
          </Link>
        </div>
      ) : (
        <>
          <p className="mb-4 text-center text-sm text-zinc-500">
            Enter your work email and we will send a secure reset link.
          </p>
          {error && <div className="mb-4"><ErrorAlert message={error} /></div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-xl border-white/10 bg-white/5 text-white"
                placeholder="you@company.com"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-5">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send reset link
            </Button>
          </form>
          <Link href="/login" className="mt-4 block text-center text-sm text-violet-400 hover:text-violet-300">
            Back to sign in
          </Link>
        </>
      )}
    </AuthShell>
  );
}
