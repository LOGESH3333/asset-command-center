'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { listManagedUsersAction, type ManagedUser } from '@/app/actions/user-management';
import {
  suspendUserAction,
  reactivateUserAction,
  changeUserRoleAction,
} from '@/app/actions/invitations';
import { deleteUserAction } from '@/app/actions/users';
import { isDeleteBlocked, type DeleteBlockingInfo } from '@/lib/delete/delete-fk-blocking';
import { RoleGuard } from '@/components/auth/role-guard';
import { InviteMemberDialog } from '@/components/user-management/invite-member-dialog';
import { RoleBadge } from '@/components/user-management/role-badge';
import { EnterpriseTable } from '@/components/enterprise/enterprise-table';
import { StatusBadge } from '@/components/enterprise/status-badge';
import { SearchInput } from '@/components/common/SearchInput';
import { PaginationControls } from '@/components/common/PaginationControls';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { RegistryDeleteDialog } from '@/components/common/delete-confirm-dialog';
import { RegistryDeleteButton } from '@/components/common/registry-delete-button';
import { Skeleton } from '@/components/common/Skeleton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  WorkspaceHero,
  WorkspaceKpiGrid,
  WorkspaceSection,
  WorkspaceDataPanel,
  type ModuleKpi,
} from '@/components/workspace/workspace-layout';
import type { AppRole } from '@/lib/auth/roles';
import { INVITABLE_ROLES } from '@/lib/auth/roles';
import {
  UserPlus,
  Users,
  Shield,
  Mail,
  Loader2,
  Ban,
  CheckCircle2,
} from 'lucide-react';

const PAGE_SIZE = 10;

export default function UserManagementPage() {
  return (
    <RoleGuard allowed={['Super_Admin']}>
      <UserManagementContent />
    </RoleGuard>
  );
}

function UserManagementContent() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<ManagedUser | null>(null);
  const [newRole, setNewRole] = useState<AppRole>('Employee');
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [deleteBlocking, setDeleteBlocking] = useState<DeleteBlockingInfo | null>(null);

  const fetchUsers = useCallback(async () => {
    console.log('[DELETE] REFRESH USERS START', { search, page });
    setLoading(true);
    setError(null);
    const result = await listManagedUsersAction({ search, page, pageSize: PAGE_SIZE });
    console.log('[DELETE] REFRESH USERS RESULT', {
      search,
      page,
      total: result.total,
      count: result.data.length,
      error: result.error ?? null,
    });
    if (result.error) setError(result.error);
    setUsers(result.data);
    setTotal(result.total);
    setLoading(false);
    console.log('[DELETE] UI REFRESH SUCCESS', {
      search,
      page,
      total: result.total,
      count: result.data.length,
    });
  }, [search, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const kpis: ModuleKpi[] = useMemo(() => {
    const active = users.filter((u) => u.status === 'Active').length;
    const invited = users.filter((u) => u.status === 'Invited' || u.status === 'Pending').length;
    const admins = users.filter((u) => u.role === 'Admin' || u.role === 'Super_Admin').length;
    return [
      { title: 'Total Users', value: total, icon: Users, accent: 'violet' as const, trend: 0 },
      { title: 'Active', value: active, icon: CheckCircle2, accent: 'emerald' as const, trend: 0 },
      { title: 'Pending Invites', value: invited, icon: Mail, accent: 'cyan' as const, trend: 0 },
      { title: 'Admins', value: admins, icon: Shield, accent: 'rose' as const, trend: 0 },
    ];
  }, [users, total]);

  const handleSuspend = useCallback(async (user: ManagedUser) => {
    setActionLoading(true);
    const result =
      user.status === 'Suspended'
        ? await reactivateUserAction(user.id)
        : await suspendUserAction(user.id);
    setActionLoading(false);
    if (result.error) setError(result.error);
    else fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async () => {
    if (!roleTarget) return;
    setActionLoading(true);
    const result = await changeUserRoleAction(roleTarget.id, newRole);
    setActionLoading(false);
    if (result.error) setError(result.error);
    else {
      setRoleTarget(null);
      fetchUsers();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      console.log('[DELETE] CONFIRM CLICKED WITHOUT TARGET');
      return;
    }
    const target = deleteTarget;
    console.log('[DELETE] CALLING SERVER ACTION', target.id);
    setDeleteBlocking(null);
    setActionLoading(true);
    try {
      const result = await deleteUserAction(target.id);
      console.log('[DELETE] SERVER ACTION RESULT', target.id, result);
      if (isDeleteBlocked(result)) {
        setDeleteBlocking(result.blocking);
      } else if ('error' in result && result.error) {
        setError(result.error);
      } else {
        setDeleteTarget(null);
        setUsers((current) => current.filter((user) => user.id !== target.id));
        setTotal((current) => Math.max(0, current - 1));
        await fetchUsers();
      }
    } catch (err) {
      console.error('[DELETE] SERVER ACTION THREW', target.id, err);
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setActionLoading(false);
    }
  };

  const columns: ColumnDef<ManagedUser>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        meta: {
          headerClassName: 'w-[11%]',
          cellClassName: 'max-w-0 truncate',
        },
        cell: ({ row }) => {
          const name = `${row.original.first_name} ${row.original.last_name}`;
          return (
            <span className="block truncate font-medium text-white" title={name}>
              {name}
            </span>
          );
        },
      },
      {
        accessorKey: 'email',
        header: 'Email',
        meta: {
          headerClassName: 'w-[14%]',
          cellClassName: 'max-w-0 truncate',
        },
        cell: ({ row }) => (
          <span className="block truncate" title={row.original.email}>
            {row.original.email}
          </span>
        ),
      },
      {
        accessorKey: 'role',
        header: 'Role',
        meta: {
          headerClassName: 'w-[8%]',
          cellClassName: 'max-w-0',
        },
        cell: ({ row }) => <RoleBadge role={row.original.role} />,
      },
      {
        accessorKey: 'department',
        header: 'Department',
        meta: {
          headerClassName: 'w-[9%]',
          cellClassName: 'max-w-0 truncate',
        },
        cell: ({ row }) => (
          <span className="block truncate" title={row.original.department ?? undefined}>
            {row.original.department ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        meta: {
          headerClassName: 'w-[7%]',
          cellClassName: 'max-w-0',
        },
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'last_login',
        header: 'Last Login',
        meta: {
          headerClassName: 'w-[11%]',
          cellClassName: 'max-w-0 truncate',
        },
        cell: ({ row }) => {
          const label = row.original.last_login
            ? new Date(row.original.last_login).toLocaleString()
            : '—';
          return (
            <span className="block truncate" title={row.original.last_login ? label : undefined}>
              {label}
            </span>
          );
        },
      },
      {
        accessorKey: 'created_at',
        header: 'Created',
        meta: {
          headerClassName: 'w-[7%]',
          cellClassName: 'max-w-0 truncate',
        },
        cell: ({ row }) => {
          const label = new Date(row.original.created_at).toLocaleDateString();
          return (
            <span className="block truncate" title={label}>
              {label}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        meta: {
          headerClassName: 'w-[33%]',
          cellClassName: 'whitespace-nowrap',
        },
        cell: ({ row }) => {
          const user = row.original;
          if (user.role === 'Super_Admin') return <span className="text-xs text-zinc-500">Protected</span>;
          return (
            <div className="flex flex-nowrap items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 rounded-lg border-violet-500/20 bg-[rgba(11,11,20,0.72)] text-xs text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white"
                onClick={() => {
                  setRoleTarget(user);
                  setNewRole(user.role === 'Super_Admin' ? 'Admin' : user.role);
                }}
              >
                Role
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 rounded-lg border-violet-500/20 bg-[rgba(11,11,20,0.72)] text-xs text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white"
                disabled={actionLoading}
                onClick={() => handleSuspend(user)}
              >
                <Ban className="mr-1 h-3 w-3" />
                {user.status === 'Suspended' ? 'Activate' : 'Suspend'}
              </Button>
              <RegistryDeleteButton
                onClick={() => {
                  console.log('[DELETE] BUTTON CLICKED', user.id);
                  setDeleteBlocking(null);
                  setDeleteTarget(user);
                }}
              />
            </div>
          );
        },
      },
    ],
    [actionLoading, handleSuspend]
  );

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-8 pb-8">
      <WorkspaceHero
        badge="Identity Governance"
        title="User Management Center"
        description="Invite members, assign roles, suspend access, and govern organization lifecycle."
        actions={
          <Button
            onClick={() => setInviteOpen(true)}
            className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
        }
      />

      <WorkspaceKpiGrid kpis={kpis} loading={loading} columns={4} />

      {error && <ErrorAlert message={error} />}

      <WorkspaceSection title="Organization Members" subtitle={`${total} users in directory`}>
        <WorkspaceDataPanel
          toolbar={
            <SearchInput
              placeholder="Search name, email, department..."
              onSearch={(v) => {
                setSearch(v);
                setPage(1);
              }}
            />
          }
          footer={
            !loading && users.length > 0 ? (
              <PaginationControls
                currentPage={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            ) : undefined
          }
        >
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          ) : (
            <EnterpriseTable columns={columns} data={users} fitColumns />
          )}
        </WorkspaceDataPanel>
      </WorkspaceSection>

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSuccess={fetchUsers}
      />

      <Dialog open={!!roleTarget} onOpenChange={(o) => !o && setRoleTarget(null)}>
        <DialogContent className="rounded-2xl border-white/10 bg-[#0c0c14] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
          </DialogHeader>
          <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
            <SelectTrigger className="erp-dark-glass-interactive rounded-xl border text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVITABLE_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              onClick={handleRoleChange}
              disabled={actionLoading}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600"
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RegistryDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteTarget(null);
            setDeleteBlocking(null);
          }
        }}
        title="Delete User"
        description={'Permanently remove this user and related references.\nThis action cannot be undone.'}
        detail={deleteTarget?.email}
        blocking={deleteBlocking}
        onConfirm={handleDelete}
        confirming={actionLoading}
      />
    </div>
  );
}
