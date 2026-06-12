'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getRoleEnumValues } from '@/lib/supabase/users';
import { createUserAction } from '@/app/actions/users';
import { generateTemporaryPassword } from '@/lib/auth/temporary-password';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { ArrowLeftIcon, CopyIcon, Loader2Icon, RefreshCwIcon } from 'lucide-react';

type CreateSuccess = {
  email: string;
  role: string;
  temporaryPassword?: string;
  setupLink?: string;
  authUserId: string;
};

export default function NewUserPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Employee');
  const [roles, setRoles] = useState<string[]>([]);
  const [sendSetupEmail, setSendSetupEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CreateSuccess | null>(null);

  useEffect(() => {
    async function loadRoles() {
      try {
        const vals = await getRoleEnumValues();
        setRoles(vals.filter((r) => r !== 'Super_Admin'));
        if (vals.length > 0) {
          setRole(vals.includes('Employee') ? 'Employee' : vals[0]);
        }
      } catch (err) {
        console.error('Failed to load roles', err);
      }
    }
    loadRoles();
  }, []);

  const handleGeneratePassword = () => {
    setPassword(generateTemporaryPassword());
  };

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setError('First Name is required.');
      return;
    }
    if (!lastName.trim()) {
      setError('Last Name is required.');
      return;
    }
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    if (!sendSetupEmail && (!password || password.length < 8)) {
      setError('Password must be at least 8 characters, or enable email setup link.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await createUserAction({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password: sendSetupEmail ? undefined : password,
        department: department.trim() || undefined,
        role: (role.trim() || 'Employee') as 'Admin' | 'Manager' | 'Employee',
        sendSetupEmail,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      if (!result.data || !result.authUserId) {
        setError('User creation did not return a linked auth profile.');
        return;
      }

      setSuccess({
        email: result.data.email,
        role: result.data.role,
        temporaryPassword: result.temporaryPassword,
        setupLink: result.setupLink,
        authUserId: result.authUserId,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <Card className="erp-dark-glass border border-emerald-500/25 bg-[rgba(10,10,20,0.75)] text-white shadow-sm">
          <CardHeader>
            <CardTitle>User provisioned successfully</CardTitle>
            <CardDescription>
              Supabase Auth and public.users are linked. Share credentials securely with the new team member.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-400">Email</span>
                <span className="font-medium">{success.email}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-400">Role</span>
                <span className="font-medium">{success.role}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-400">Auth user ID</span>
                <span className="font-mono text-xs text-zinc-300">{success.authUserId}</span>
              </div>
              {success.temporaryPassword ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-400">Temporary password</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-emerald-300">{success.temporaryPassword}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => copyText(success.temporaryPassword!)}
                    >
                      <CopyIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
              {success.setupLink ? (
                <div className="space-y-2">
                  <span className="text-zinc-400">Password setup link</span>
                  <div className="flex items-start gap-2">
                    <p className="break-all font-mono text-xs text-violet-300">{success.setupLink}</p>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => copyText(success.setupLink!)}
                    >
                      <CopyIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex gap-3">
              <Button onClick={() => router.push('/dashboard/users')}>Back to Team Management</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSuccess(null);
                  setPassword('');
                  setFirstName('');
                  setLastName('');
                  setEmail('');
                  setDepartment('');
                }}
              >
                Add another user
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href="/dashboard/users" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="mr-2 h-4 w-4" />
        Back to Users
      </Link>

      <Card className="erp-dark-glass border border-[rgba(139,92,246,0.15)] bg-[rgba(10,10,20,0.75)] text-white shadow-sm">
        <CardHeader>
          <CardTitle>Add New User</CardTitle>
          <CardDescription>
            Creates a Supabase Auth account first, then links public.users with auth_id.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && <div className="mb-4"><ErrorAlert message={error} /></div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="user-first-name">First Name *</Label>
                <Input
                  id="user-first-name"
                  placeholder="e.g. John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-last-name">Last Name *</Label>
                <Input
                  id="user-last-name"
                  placeholder="e.g. Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email *</Label>
              <Input
                id="user-email"
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-department">Department</Label>
              <Input
                id="user-department"
                placeholder="e.g. IT, Finance, HR..."
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="user-password">Temporary Password *</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleGeneratePassword}>
                  <RefreshCwIcon className="mr-2 h-3.5 w-3.5" />
                  Generate
                </Button>
              </div>
              <Input
                id="user-password"
                type="text"
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={sendSetupEmail}
                minLength={8}
              />
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={sendSetupEmail}
                onChange={(e) => setSendSetupEmail(e.target.checked)}
              />
              <span>
                Email password setup link instead of showing a temporary password in this screen.
                A secure password is still provisioned in Supabase Auth.
              </span>
            </label>
            <div className="space-y-2">
              <Label htmlFor="user-role">Role</Label>
              <select
                id="user-role"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                Create User
              </Button>
              <Link href="/dashboard/users">
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
