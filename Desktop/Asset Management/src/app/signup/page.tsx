'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { createDemoSession, saveDemoSession } from '@/lib/auth/demo-session';
import { mapSignupError, splitFullName } from '@/lib/auth/errors';
import { signUpAction } from '@/app/actions/auth';
import { logAuthEvent, normalizeAuthEmail, serializeAuthError } from '@/lib/auth/auth-log';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Loader2 } from 'lucide-react';

const DEMO_AUTH = process.env.NEXT_PUBLIC_DEMO_AUTH === 'true';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const normalizedEmail = normalizeAuthEmail(email);
    if (!fullName.trim() || !normalizedEmail || !password) {
      setError('Please fill in all fields.');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      setLoading(false);
      return;
    }

    if (DEMO_AUTH) {
      const session = createDemoSession({ email: normalizedEmail, fullName: fullName.trim() });
      saveDemoSession(session);
      window.location.href = '/dashboard';
      return;
    }

    const { first_name, last_name } = splitFullName(fullName);

    logAuthEvent('signup', {
      email: normalizedEmail,
      provider: 'signUpAction (admin createUser + signInWithPassword)',
    });

    const signUpResult = await signUpAction({
      email: normalizedEmail,
      password,
      first_name,
      last_name,
    });

    logAuthEvent('signup', {
      email: normalizedEmail,
      signUpAction: signUpResult,
    });

    if (signUpResult.error) {
      setError(signUpResult.error);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    logAuthEvent('login', {
      email: normalizedEmail,
      context: 'post-signup',
      response: {
        error: serializeAuthError(signInError),
        hasSession: Boolean(signInData?.session),
        userId: signInData?.user?.id,
      },
    });

    if (!signInError && signInData.session) {
      window.location.href = '/dashboard';
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  return (
    <AuthShell heading="Create your account">
      {DEMO_AUTH && (
        <p className="mb-4 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-center text-xs text-violet-300">
          Demo mode — no account is created in Supabase.
        </p>
      )}

      {success ? (
        <div className="space-y-4 text-center text-sm text-zinc-400">
          <p>Check your email to confirm your account, then sign in.</p>
          <Link href="/login">
            <Button className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600">Go to sign in</Button>
          </Link>
        </div>
      ) : (
        <>
          {error && <div className="mb-4"><ErrorAlert message={error} /></div>}
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-zinc-300">Full Name</Label>
              <Input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="rounded-xl border-white/10 bg-white/5 text-white" placeholder="Jane Smith" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl border-white/10 bg-white/5 text-white" placeholder="you@company.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-300">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="rounded-xl border-white/10 bg-white/5 text-white" placeholder="Min. 8 characters" />
            </div>
            <Button type="submit" disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-5">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
          </form>
          <Link href="/login" className="mt-4 block text-center text-sm text-violet-400 hover:text-violet-300">
            Already have an account? Sign in
          </Link>
        </>
      )}
    </AuthShell>
  );
}
