'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { getApprovals } from '@/lib/supabase/brd/approvals';
import { formatRequestLabel } from '@/lib/supabase/requests';
import type { RequestApproval } from '@/lib/brd/types';
import { supabase } from '@/lib/supabase/client';
import { deleteApprovalAction } from '@/app/actions/brd/approvals';
import { PaginationControls } from '@/components/common/PaginationControls';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Skeleton } from '@/components/common/Skeleton';
import { EnterpriseTable } from '@/components/enterprise/enterprise-table';
import { StatusBadge } from '@/components/enterprise/status-badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PlusIcon, EyeIcon, Trash2Icon, Loader2Icon, Users, Briefcase, Landmark, Percent } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { canManageApprovals } from '@/lib/auth/roles';
import {
  WorkspaceHero,
  WorkspaceKpiGrid,
  WorkspaceSection,
  WorkspaceAnalyticsGrid,
  WorkspaceDataPanel,
  type ModuleKpi,
} from '@/components/workspace/workspace-layout';
import { WorkspaceDonutChart, WorkspaceAreaChart, WorkspaceProgressList } from '@/components/workspace/workspace-charts';
import { countByField, groupByDay, percent, trendFromSparkline, sparklineFromDates } from '@/lib/workspace/insights';

const PAGE_SIZE = 10;

export default function ApprovalsPage() {
  const { role } = useAuth();
  const searchParams = useSearchParams();
  const initialStage = searchParams.get('stage') ?? 'ALL';
  const [rows, setRows] = useState<RequestApproval[]>([]);
  const [allApprovals, setAllApprovals] = useState<RequestApproval[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [stage, setStage] = useState(initialStage);
  const [status, setStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RequestApproval | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    supabase.from('request_approvals').select('id, approval_stage, status, created_at').limit(500).then(({ data }) => {
      setAllApprovals((data as RequestApproval[]) ?? []);
      setMetricsLoading(false);
    });
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getApprovals({ stage, status, page, pageSize: PAGE_SIZE });
      if (result.error) setError(result.error.message);
      else { setRows(result.data); setTotal(result.total); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, [stage, status, page]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deleteApprovalAction(deleteTarget.id);
    if (result.error) setError(result.error);
    else { setDialogOpen(false); setDeleteTarget(null); fetchRows(); }
    setDeleting(false);
  };

  const managerQ = allApprovals.filter((a) => a.approval_stage === 'Manager' && a.status === 'Pending').length;
  const procQ = allApprovals.filter((a) => a.approval_stage === 'Procurement' && a.status === 'Pending').length;
  const financeQ = allApprovals.filter((a) => a.approval_stage === 'Finance' && a.status === 'Pending').length;
  const approved = allApprovals.filter((a) => a.status === 'Approved').length;
  const approvalRate = percent(approved, allApprovals.length || 1);
  const spark = sparklineFromDates(allApprovals.map((a) => a.created_at));

  const kpis: ModuleKpi[] = [
    { title: 'Manager Queue', value: managerQ, icon: Users, accent: 'amber', trend: managerQ > 0 ? 10 : -5, trendLabel: 'pending' },
    { title: 'Procurement Queue', value: procQ, icon: Briefcase, accent: 'cyan', trend: 4, trendLabel: 'review' },
    { title: 'Finance Queue', value: financeQ, icon: Landmark, accent: 'violet', trend: financeQ > 0 ? 8 : 0, trendLabel: 'sign-off' },
    { title: 'Approval Rate', value: approvalRate, suffix: '%', icon: Percent, accent: 'emerald', trend: trendFromSparkline(spark), sparklineData: spark },
  ];

  const columns = useMemo<ColumnDef<RequestApproval>[]>(() => [
    {
      accessorKey: 'asset_requests',
      header: 'Request',
      cell: ({ row }) => (
        <Link href={`/dashboard/approvals/${row.original.id}`} className="font-medium hover:text-violet-300">
          {formatRequestLabel(row.original.asset_requests?.justification) || '—'}
        </Link>
      ),
    },
    { accessorKey: 'approval_stage', header: 'Stage', cell: ({ row }) => <StatusBadge status={row.original.approval_stage} /> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      accessorKey: 'users',
      header: 'Approver',
      cell: ({ row }) => {
        const u = row.original.users;
        return u ? `${u.first_name} ${u.last_name}` : '—';
      },
    },
    {
      accessorKey: 'comments',
      header: 'Comments',
      cell: ({ row }) => (
        <span className="max-w-[12rem] truncate text-zinc-500" title={row.original.comments ?? undefined}>
          {row.original.comments || '—'}
        </span>
      ),
    },
    { accessorKey: 'created_at', header: 'Created', cell: ({ row }) => <span className="text-zinc-400">{new Date(row.original.created_at).toLocaleDateString()}</span> },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Link href={`/dashboard/approvals/${row.original.id}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8"><EyeIcon className="h-4 w-4" /></Button>
          </Link>
          {role === 'Admin' && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setDeleteTarget(row.original); setDialogOpen(true); }}>
              <Trash2Icon className="h-4 w-4 text-rose-400" />
            </Button>
          )}
        </div>
      ),
    },
  ], [role]);

  const stageData = countByField(allApprovals, (a) => a.approval_stage);
  const statusData = countByField(allApprovals, (a) => a.status);
  const trendData = groupByDay(allApprovals, (a) => a.created_at);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8 pb-8">
      <WorkspaceHero
        badge="Approval Operations"
        title="Approval Command Center"
        description="Multi-stage governance queue for manager, procurement, and finance sign-off."
        actions={
          canManageApprovals(role) ? (
            <Link href="/dashboard/approvals/new">
              <Button className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600"><PlusIcon className="mr-2 h-4 w-4" />New Approval</Button>
            </Link>
          ) : null
        }
      />

      <WorkspaceKpiGrid kpis={kpis} loading={metricsLoading} columns={4} />

      <WorkspaceSection title="Governance Analytics" subtitle={`${approvalRate}% historical approval rate`}>
        <WorkspaceAnalyticsGrid>
          <WorkspaceDonutChart title="By Stage" data={stageData} />
          <WorkspaceAreaChart title="Decision Volume" data={trendData} />
          <WorkspaceProgressList
            title="Outcome Mix"
            items={statusData.map((d) => ({ label: d.name, value: d.value, max: allApprovals.length || 1 }))}
          />
        </WorkspaceAnalyticsGrid>
      </WorkspaceSection>

      {error && <ErrorAlert message={error} />}

      <WorkspaceSection title="Approval Queue" subtitle="Stage-filtered operational registry">
        <WorkspaceDataPanel
          toolbar={
            <div className="flex flex-wrap gap-3">
              <Select value={stage} onValueChange={(v) => { setStage(v ?? 'ALL'); setPage(1); }}>
                <SelectTrigger className="w-[170px] rounded-xl border-violet-500/20 bg-white/[0.03]"><SelectValue placeholder="Stage" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Stages</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Procurement">Procurement</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v) => { setStatus(v ?? 'ALL'); setPage(1); }}>
                <SelectTrigger className="w-[170px] rounded-xl border-violet-500/20 bg-white/[0.03]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
          footer={!loading && rows.length > 0 ? <PaginationControls currentPage={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} /> : undefined}
        >
          {loading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            : rows.length === 0 ? <EmptyState title="No approvals" description="Queue is clear for selected filters." action={canManageApprovals(role) ? <Link href="/dashboard/approvals/new"><Button>New Approval</Button></Link> : undefined} />
            : <EnterpriseTable columns={columns} data={rows} />}
        </WorkspaceDataPanel>
      </WorkspaceSection>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl border-white/10 bg-[#0a0a0f]">
          <DialogHeader><DialogTitle>Delete approval?</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
