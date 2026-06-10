'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Loader2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError('Unable to update password. Please request a new reset link.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  };

  return (
    <AuthShell heading="Set a new password">
      {error && <div className="mb-4"><ErrorAlert message={error} /></div>}
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
      <Link href="/login" className="mt-4 block text-center text-sm text-violet-400 hover:text-violet-300">
        Back to sign in
      </Link>
    </AuthShell>
  );
}
