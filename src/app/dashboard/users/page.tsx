'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { deleteUserAction } from '@/app/actions/users';
import { getUsers, type User } from '@/lib/supabase/users';
import { supabase } from '@/lib/supabase/client';
import { SearchInput } from '@/components/common/SearchInput';
import { PaginationControls } from '@/components/common/PaginationControls';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Skeleton } from '@/components/common/Skeleton';
import { EnterpriseTable } from '@/components/enterprise/enterprise-table';
import { StatusBadge } from '@/components/enterprise/status-badge';
import { Button } from '@/components/ui/button';
import { RegistryDeleteDialog } from '@/components/common/delete-confirm-dialog';
import { RegistryDeleteButton } from '@/components/common/registry-delete-button';
import { PlusIcon, EyeIcon, PencilIcon, Users, Shield, Building2, UserPlus } from 'lucide-react';
import { RoleGuard } from '@/components/auth/role-guard';
import {
  WorkspaceHero,
  WorkspaceKpiGrid,
  WorkspaceSection,
  WorkspaceAnalyticsGrid,
  WorkspaceDataPanel,
  type ModuleKpi,
} from '@/components/workspace/workspace-layout';
import { WorkspaceDonutChart, WorkspaceAreaChart, WorkspaceProgressList } from '@/components/workspace/workspace-charts';
import { countByField, groupByDay, sparklineFromDates, trendFromSparkline } from '@/lib/workspace/insights';
import { isDeleteBlocked, type DeleteBlockingInfo } from '@/lib/delete/delete-fk-blocking';

const PAGE_SIZE = 10;

export default function UsersPage() {
  return (
    <RoleGuard allowed={['Super_Admin']}>
      <UsersPageContent />
    </RoleGuard>
  );
}

function UsersPageContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleteBlocking, setDeleteBlocking] = useState<DeleteBlockingInfo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    supabase.from('users').select('id, role, department, created_at').limit(500).then(({ data }) => {
      setAllUsers((data as User[]) ?? []);
      setMetricsLoading(false);
    });
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getUsers({ search, page, pageSize: PAGE_SIZE });
      if (result.error) setError(result.error.message);
      else { setUsers(result.data); setTotal(result.total); }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSearch = useCallback((term: string) => { setSearch(term); setPage(1); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteBlocking(null);
    try {
      const result = await deleteUserAction(deleteTarget.id);
      if (isDeleteBlocked(result)) {
        setDeleteBlocking(result.blocking);
      } else if ('error' in result && result.error) {
        setError(result.error);
      } else {
        setDialogOpen(false);
        setDeleteTarget(null);
        fetchUsers();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const admins = allUsers.filter((u) => u.role === 'Admin').length;
  const departments = new Set(allUsers.map((u) => u.department).filter(Boolean)).size;
  const now = new Date();
  const newThisMonth = allUsers.filter((u) => {
    const d = new Date(u.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const spark = sparklineFromDates(allUsers.map((u) => u.created_at));

  const kpis: ModuleKpi[] = [
    { title: 'Total Members', value: allUsers.length, icon: Users, accent: 'violet', trend: trendFromSparkline(spark), sparklineData: spark },
    { title: 'Administrators', value: admins, icon: Shield, accent: 'rose', trend: 4, trendLabel: 'elevated' },
    { title: 'Departments', value: departments || 1, icon: Building2, accent: 'cyan', trend: 6, trendLabel: 'org units' },
    { title: 'New This Month', value: newThisMonth, icon: UserPlus, accent: 'emerald', trend: newThisMonth > 0 ? 12 : 0, trendLabel: 'onboarded' },
  ];

  const columns = useMemo<ColumnDef<User>[]>(() => [
    {
      accessorKey: 'first_name',
      header: 'Name',
      cell: ({ row }) => (
        <Link href={`/dashboard/users/${row.original.id}`} className="font-medium hover:text-violet-300">
          {row.original.first_name} {row.original.last_name}
        </Link>
      ),
    },
    { accessorKey: 'email', header: 'Email', cell: ({ row }) => <span className="text-zinc-400">{row.original.email}</span> },
    { accessorKey: 'department', header: 'Department', cell: ({ row }) => row.original.department || '—' },
    { accessorKey: 'role', header: 'Role', cell: ({ row }) => row.original.role ? <StatusBadge status={row.original.role} /> : '—' },
    { accessorKey: 'created_at', header: 'Created', cell: ({ row }) => <span className="text-zinc-400">{new Date(row.original.created_at).toLocaleDateString()}</span> },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Link href={`/dashboard/users/${row.original.id}`}><Button variant="ghost" size="icon" className="h-8 w-8"><EyeIcon className="h-4 w-4" /></Button></Link>
          <Link href={`/dashboard/users/${row.original.id}/edit`}><Button variant="ghost" size="icon" className="h-8 w-8"><PencilIcon className="h-4 w-4" /></Button></Link>
          <RegistryDeleteButton onClick={() => { setDeleteBlocking(null); setDeleteTarget(row.original); setDialogOpen(true); }} />
        </div>
      ),
    },
  ], []);

  const roleData = countByField(allUsers, (u) => u.role ?? 'Unassigned');
  const deptData = countByField(allUsers, (u) => u.department ?? 'Unassigned');
  const trendData = groupByDay(allUsers, (u) => u.created_at);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-8 pb-8">
      <WorkspaceHero
        badge="Identity Operations"
        title="Team Management Center"
        description="Organization directory with role distribution, department coverage, and onboarding analytics."
        actions={
          <Link href="/dashboard/users/new">
            <Button className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600"><PlusIcon className="mr-2 h-4 w-4" />Add User</Button>
          </Link>
        }
      />

      <WorkspaceKpiGrid kpis={kpis} loading={metricsLoading} columns={4} />

      <WorkspaceSection title="Workforce Analytics" subtitle={`${departments} active departments`}>
        <WorkspaceAnalyticsGrid>
          <WorkspaceDonutChart title="By Role" data={roleData} />
          <WorkspaceAreaChart title="Onboarding Trend" data={trendData} />
          <WorkspaceProgressList title="Department Mix" items={deptData.slice(0, 6).map((d) => ({ label: d.name, value: d.value, max: allUsers.length || 1 }))} />
        </WorkspaceAnalyticsGrid>
      </WorkspaceSection>

      {error && <ErrorAlert message={error} />}

      <WorkspaceSection title="Member Directory" subtitle={`${total} team members`}>
        <WorkspaceDataPanel
          toolbar={<SearchInput placeholder="Search users by name, email, or department…" onSearch={handleSearch} />}
          footer={!loading && users.length > 0 ? <PaginationControls currentPage={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} /> : undefined}
        >
          {loading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            : users.length === 0 ? <EmptyState title="No users found" description={search ? `No users match "${search}".` : 'Get started by adding your first user.'} action={!search ? <Link href="/dashboard/users/new"><Button>Add User</Button></Link> : undefined} />
            : <EnterpriseTable columns={columns} data={users} />}
        </WorkspaceDataPanel>
      </WorkspaceSection>

      <RegistryDeleteDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setDeleteTarget(null);
            setDeleteBlocking(null);
          }
        }}
        title="Delete User"
        description="Permanently remove this user and related references. This action cannot be undone."
        detail={deleteTarget ? `${deleteTarget.first_name} ${deleteTarget.last_name}` : null}
        blocking={deleteBlocking}
        onConfirm={handleDelete}
        confirming={deleting}
      />
    </div>
  );
}
