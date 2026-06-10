'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createDemoSession, saveDemoSession } from '@/lib/auth/demo-session';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Loader2 } from 'lucide-react';

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

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter your email and password.');
      setLoading(false);
      return;
    }

    // Demo mode: any credentials are accepted
    const session = createDemoSession({ email: trimmedEmail });
    saveDemoSession(session);
    window.location.href = redirect;
  };

  return (
    <AuthShell heading="Sign in to your workspace">
      <p className="mb-4 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-center text-xs text-violet-300">
        Demo mode — any email and password will sign you in.
      </p>

      {error && (
        <div className="mb-4">
          <ErrorAlert message={error} />
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-zinc-300">
            Email
          </Label>
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
          <Label htmlFor="password" className="text-zinc-300">
            Password
          </Label>
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

      <div className="mt-6 space-y-3">
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
