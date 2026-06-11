'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getUser, type User } from '@/lib/supabase/users';
import { deleteUserAction } from '@/app/actions/users';
import { useAuth } from '@/components/auth/auth-provider';
import { canManageUsers } from '@/lib/auth/roles';
import { PageHeader } from '@/components/enterprise/page-header';
import { GlassPanel } from '@/components/enterprise/glass-panel';
import { StatusBadge } from '@/components/enterprise/status-badge';
import { Button } from '@/components/ui/button';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Skeleton } from '@/components/common/Skeleton';
import {
  RegistryDeleteDialog,
  RegistryDeleteDialogTriggerButton,
} from '@/components/common/delete-confirm-dialog';
import { isDeleteBlocked, type DeleteBlockingInfo } from '@/lib/delete/delete-fk-blocking';
import { ArrowLeft, Pencil, Trash2, Mail, Building2, Shield, Calendar } from 'lucide-react';

function UserDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const id = params.id as string;
  const isOwnProfile = profile?.id === id;
  const canManage = canManageUsers(profile?.role ?? null);

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteBlocking, setDeleteBlocking] = useState<DeleteBlockingInfo | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data, error: fetchError } = await getUser(id);
        if (fetchError) setError(fetchError.message);
        else if (!data) setError('User not found.');
        else setUser(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load user');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteBlocking(null);
    try {
      const result = await deleteUserAction(id);
      if (isDeleteBlocked(result)) {
        setDeleteBlocking(result.blocking);
      } else if ('error' in result && result.error) {
        setError(result.error);
      } else {
        router.push(canManage ? '/dashboard/users' : '/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-6">
        <Link href={canManage ? '/dashboard/users' : '/dashboard'} className="inline-flex items-center text-sm text-zinc-400 hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {canManage ? 'Back to Team' : 'Back to Dashboard'}
        </Link>
        <ErrorAlert message={error ?? 'User not found'} />
      </div>
    );
  }

  const fields = [
    { icon: Mail, label: 'Email', value: user.email || '—' },
    { icon: Building2, label: 'Department', value: user.department || '—' },
    { icon: Shield, label: 'Role', value: user.role },
    { icon: Calendar, label: 'Member since', value: new Date(user.created_at).toLocaleDateString() },
  ];

  return (
    <div className="space-y-6">
      <Link href={canManage ? '/dashboard/users' : '/dashboard'} className="inline-flex items-center text-sm text-zinc-400 hover:text-white">
        <ArrowLeft className="mr-2 h-4 w-4" />
        {canManage ? 'Back to Team' : 'Back to Dashboard'}
      </Link>

      <PageHeader
        badge={isOwnProfile ? 'My Profile' : 'Team Member'}
        title={`${user.first_name} ${user.last_name}`}
        description={
          isOwnProfile
            ? 'Your account profile and role assignment.'
            : 'User profile, role assignment, and access permissions.'
        }
        actions={
          canManage ? (
            <div className="flex gap-2">
              <Link href={`/dashboard/users/${id}/edit`}>
                <Button variant="outline" className="rounded-xl border-white/10 bg-white/5">
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </Link>
              <RegistryDeleteDialogTriggerButton className="rounded-xl" onClick={() => { setDeleteBlocking(null); setDialogOpen(true); }}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </RegistryDeleteDialogTriggerButton>
            </div>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <GlassPanel className="p-6 lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-2xl font-bold text-white shadow-lg shadow-violet-500/30"
            >
              {user.first_name[0]?.toUpperCase()}
              {user.last_name[0]?.toUpperCase()}
            </motion.div>
            <h2 className="mt-4 text-lg font-semibold text-white">
              {user.first_name} {user.last_name}
            </h2>
            <div className="mt-2">
              <StatusBadge status={user.role} />
            </div>
            <p className="mt-3 font-mono text-[10px] text-zinc-600">{user.auth_id || 'No auth ID'}</p>
          </div>
        </GlassPanel>

        <GlassPanel className="p-6 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">Profile Details</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map(({ icon: Icon, label, value }) => (
              <div key={label} className="erp-dark-glass rounded-xl p-4">
                <div className="flex items-center gap-2 text-zinc-500">
                  <Icon className="h-4 w-4 text-violet-400" />
                  <span className="text-xs uppercase tracking-wider">{label}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-zinc-200">
                  {label === 'Role' ? <StatusBadge status={String(value)} /> : value}
                </p>
              </div>
            ))}
          </div>
          <div className="erp-dark-glass mt-4 rounded-xl p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Internal ID</p>
            <p className="mt-1 font-mono text-xs text-zinc-400">{user.id}</p>
          </div>
        </GlassPanel>
      </div>

      <RegistryDeleteDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setDeleteBlocking(null);
        }}
        title="Delete User"
        description="Permanently remove this user and related references. This action cannot be undone."
        detail={`${user.first_name} ${user.last_name}`}
        blocking={deleteBlocking}
        onConfirm={handleDelete}
        confirming={deleting}
      />
    </div>
  );
}

export default function UserDetailPage() {
  return <UserDetailContent />;
}
