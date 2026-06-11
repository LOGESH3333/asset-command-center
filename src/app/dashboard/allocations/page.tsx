'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import type { AssetAllocation } from '@/lib/brd/types';
import {
  deleteAllocationAction,
  listAllocationMetricsAction,
  listAllocationsAction,
} from '@/app/actions/brd/allocations';
import { PaginationControls } from '@/components/common/PaginationControls';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Skeleton } from '@/components/common/Skeleton';
import { EnterpriseTable } from '@/components/enterprise/enterprise-table';
import { StatusBadge } from '@/components/enterprise/status-badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RegistryDeleteDialog } from '@/components/common/delete-confirm-dialog';
import { RegistryDeleteButton } from '@/components/common/registry-delete-button';
import { PlusIcon, EyeIcon, ArrowRightLeft, CheckCircle, Clock, RotateCcw } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { canManageAllocations } from '@/lib/auth/roles';
import {
  WorkspaceHero,
  WorkspaceKpiGrid,
  WorkspaceSection,
  WorkspaceAnalyticsGrid,
  WorkspaceDataPanel,
  type ModuleKpi,
} from '@/components/workspace/workspace-layout';
import { WorkspaceDonutChart, WorkspaceAreaChart, WorkspaceProgressList } from '@/components/workspace/workspace-charts';
import { countByField, groupByDay, percent, sparklineFromDates, trendFromSparkline } from '@/lib/workspace/insights';
import { REGISTRY_SELECT_TRIGGER } from '@/lib/ui/registry-surface';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 10;

export default function AllocationsPage() {
  const { role, profile } = useAuth();
  const isEmployeeView = role === 'Employee';
  const [rows, setRows] = useState<AssetAllocation[]>([]);
  const [allRows, setAllRows] = useState<AssetAllocation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssetAllocation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    listAllocationMetricsAction({
      userId: isEmployeeView ? profile?.id : undefined,
    }).then((result) => {
      if (result.error) setError(result.error);
      setAllRows(result.data ?? []);
      setMetricsLoading(false);
    });
  }, [isEmployeeView, profile?.id]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAllocationsAction({
        status,
        page,
        pageSize: PAGE_SIZE,
        userId: isEmployeeView ? profile?.id : undefined,
      });
      if (result.error) setError(result.error);
      else { setRows(result.data); setTotal(result.total); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load allocations');
    } finally {
      setLoading(false);
    }
  }, [status, page, isEmployeeView, profile?.id]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deleteAllocationAction(deleteTarget.id);
    if (result.error) setError(result.error);
    else { setDialogOpen(false); setDeleteTarget(null); fetchRows(); }
    setDeleting(false);
  };

  const active = allRows.filter((a) => a.status === 'Active').length;
  const returned = allRows.filter((a) => a.status === 'Returned').length;
  const pendingAck = allRows.filter((a) => a.status === 'Active' && !a.acknowledged_at).length;
  const ackRate = percent(allRows.filter((a) => a.acknowledged_at).length, allRows.length || 1);
  const spark = sparklineFromDates(allRows.map((a) => a.allocated_at ?? a.created_at));

  const kpis: ModuleKpi[] = [
    { title: 'Active Assignments', value: active, icon: ArrowRightLeft, accent: 'violet', trend: trendFromSparkline(spark), sparklineData: spark },
    { title: 'Acknowledged', value: ackRate, suffix: '%', icon: CheckCircle, accent: 'emerald', trend: 7, trendLabel: 'compliance' },
    { title: 'Pending Ack', value: pendingAck, icon: Clock, accent: 'amber', trend: pendingAck > 0 ? 10 : -5, trendLabel: 'awaiting' },
    { title: 'Returned', value: returned, icon: RotateCcw, accent: 'cyan', trend: 3, trendLabel: 'closed' },
  ];

  const columns = useMemo<ColumnDef<AssetAllocation>[]>(() => [
    {
      accessorKey: 'assets',
      header: 'Asset',
      cell: ({ row }) => {
        const a = row.original.assets;
        return a ? <span className="font-medium">{a.name} <span className="text-zinc-500">({a.asset_tag})</span></span> : '—';
      },
    },
    {
      accessorKey: 'users',
      header: 'Employee',
      cell: ({ row }) => {
        const u = row.original.users;
        return u ? `${u.first_name} ${u.last_name}` : '—';
      },
    },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { accessorKey: 'allocated_at', header: 'Allocated', cell: ({ row }) => <span className="text-zinc-400">{new Date(row.original.allocated_at ?? row.original.created_at).toLocaleDateString()}</span> },
    {
      accessorKey: 'acknowledged_at',
      header: 'Acknowledged',
      cell: ({ row }) => row.original.acknowledged_at
        ? <span className="text-emerald-400">{new Date(row.original.acknowledged_at).toLocaleDateString()}</span>
        : <StatusBadge status="Pending" />,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Link href={`/dashboard/allocations/${row.original.id}`}><Button variant="ghost" size="icon" className="h-8 w-8"><EyeIcon className="h-4 w-4" /></Button></Link>
          {role === 'Admin' && (
            <RegistryDeleteButton onClick={() => { setDeleteTarget(row.original); setDialogOpen(true); }} />
          )}
        </div>
      ),
    },
  ], [role]);

  const statusData = countByField(allRows, (a) => a.status);
  const trendData = groupByDay(allRows, (a) => a.allocated_at ?? a.created_at);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-8 pb-8">
      <WorkspaceHero
        badge="Assignment Operations"
        title="Allocation Command Center"
        description="Track asset assignments, acknowledgment compliance, and return workflows across the organization."
        actions={
          canManageAllocations(role) ? (
            <Link href="/dashboard/allocations/new">
              <Button className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600"><PlusIcon className="mr-2 h-4 w-4" />New Allocation</Button>
            </Link>
          ) : null
        }
      />

      <WorkspaceKpiGrid kpis={kpis} loading={metricsLoading} columns={4} />

      <WorkspaceSection title="Assignment Analytics" subtitle={`${ackRate}% acknowledgment rate`}>
        <WorkspaceAnalyticsGrid>
          <WorkspaceDonutChart title="By Status" data={statusData} />
          <WorkspaceAreaChart title="Assignment Volume" data={trendData} />
          <WorkspaceProgressList title="Status Mix" items={statusData.map((d) => ({ label: d.name, value: d.value, max: allRows.length || 1 }))} />
        </WorkspaceAnalyticsGrid>
      </WorkspaceSection>

      {error && <ErrorAlert message={error} />}

      <WorkspaceSection title="Assignment Registry" subtitle="Filtered operational queue">
        <WorkspaceDataPanel
          toolbar={
            <Select value={status} onValueChange={(v) => { setStatus(v ?? 'ALL'); setPage(1); }}>
              <SelectTrigger className={cn(REGISTRY_SELECT_TRIGGER, 'w-[170px]')}><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Returned">Returned</SelectItem>
              </SelectContent>
            </Select>
          }
          footer={!loading && rows.length > 0 ? <PaginationControls currentPage={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} /> : undefined}
        >
          {loading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            : rows.length === 0 ? <EmptyState title="No allocations" description="Create an allocation to assign assets to employees." action={canManageAllocations(role) ? <Link href="/dashboard/allocations/new"><Button>New Allocation</Button></Link> : undefined} />
            : <EnterpriseTable columns={columns} data={rows} />}
        </WorkspaceDataPanel>
      </WorkspaceSection>

      <RegistryDeleteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Delete Allocation"
        description="Permanently remove this allocation. This action cannot be undone."
        onConfirm={handleDelete}
        confirming={deleting}
      />
    </div>
  );
}
