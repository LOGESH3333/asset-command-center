'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createDemoSession, saveDemoSession } from '@/lib/auth/demo-session';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Loader2 } from 'lucide-react';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const trimmedEmail = email.trim();
    if (!fullName.trim() || !trimmedEmail || !password) {
      setError('Please fill in all fields.');
      setLoading(false);
      return;
    }

    // Demo mode: any credentials are accepted
    const session = createDemoSession({
      email: trimmedEmail,
      fullName: fullName.trim(),
    });
    saveDemoSession(session);
    window.location.href = '/dashboard';
  };

  return (
    <AuthShell heading="Create your account">
      <p className="mb-4 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-center text-xs text-violet-300">
        Demo mode — no account is created in Supabase.
      </p>

      {error && (
        <div className="mb-4">
          <ErrorAlert message={error} />
        </div>
      )}

      <form onSubmit={handleSignup} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName" className="text-zinc-300">
            Full Name
          </Label>
          <Input
            id="fullName"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="rounded-xl border-white/10 bg-white/5 text-white placeholder:text-zinc-600 focus-visible:ring-violet-500/50"
            placeholder="Jane Smith"
          />
        </div>
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="rounded-xl border-white/10 bg-white/5 text-white placeholder:text-zinc-600 focus-visible:ring-violet-500/50"
            placeholder="Any password"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="neon-button w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-5 font-semibold shadow-lg shadow-violet-500/30 transition-all hover:shadow-violet-500/50"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Account
        </Button>
      </form>

      <div className="mt-6">
        <Link href="/login" className="block">
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl border-white/10 bg-white/[0.03] py-5 text-zinc-200 hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-white"
          >
            Sign In
          </Button>
        </Link>
      </div>
    </AuthShell>
  );
}
