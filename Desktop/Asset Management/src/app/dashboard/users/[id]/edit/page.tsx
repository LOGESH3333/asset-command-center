'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getUser, getRoleEnumValues } from '@/lib/supabase/users';
import { updateUserAction } from '@/app/actions/users';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Skeleton } from '@/components/common/Skeleton';
import { ArrowLeftIcon, Loader2Icon } from 'lucide-react';

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState('');
  const [authId, setAuthId] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [userResult, roleEnumVals] = await Promise.all([
          getUser(id),
          getRoleEnumValues()
        ]);

        setRoles(roleEnumVals);

        if (userResult.error) {
          setError(userResult.error.message);
        } else if (!userResult.data) {
          setError('User not found.');
        } else {
          const data = userResult.data;
          setFirstName(data.first_name || '');
          setLastName(data.last_name || '');
          setEmail(data.email || '');
          setDepartment(data.department || '');
          setRole(data.role || '');
          setAuthId(data.auth_id || '');
        }
      } catch (err: any) {
        setError(err.message ?? 'Failed to load user information');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setError('First name is required.');
      return;
    }
    if (!lastName.trim()) {
      setError('Last name is required.');
      return;
    }
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await updateUserAction(id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        department: department.trim() || undefined,
        role: (role.trim() || 'Employee') as 'Admin' | 'Manager' | 'Employee',
      });

      if (result.error) {
        setError(result.error);
      } else {
        router.push(`/dashboard/users/${id}`);
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <Skeleton className="h-5 w-36" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-32" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link href={`/dashboard/users/${id}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="mr-2 h-4 w-4" />
        Back to User Details
      </Link>

      <Card className="bg-card shadow-sm border-border/50">
        <CardHeader>
          <CardTitle>Edit User</CardTitle>
          <CardDescription>Update user profile and permissions.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <div className="mb-4"><ErrorAlert message={error} /></div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="user-first-name">First Name *</Label>
                <Input
                  id="user-first-name"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-last-name">Last Name *</Label>
                <Input
                  id="user-last-name"
                  placeholder="Last name"
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
              <Label htmlFor="user-auth-id">Auth ID</Label>
              <Input
                id="user-auth-id"
                placeholder="Supabase auth ID"
                value={authId}
                disabled
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
                Save Changes
              </Button>
              <Link href={`/dashboard/users/${id}`}>
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
