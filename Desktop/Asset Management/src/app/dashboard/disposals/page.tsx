'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { getDisposals } from '@/lib/supabase/brd/disposals';
import type { AssetDisposal } from '@/lib/brd/types';
import { supabase } from '@/lib/supabase/client';
import { PaginationControls } from '@/components/common/PaginationControls';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Skeleton } from '@/components/common/Skeleton';
import { EnterpriseTable } from '@/components/enterprise/enterprise-table';
import { StatusBadge } from '@/components/enterprise/status-badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusIcon, EyeIcon, Recycle, Clock, CheckCircle, XCircle, DollarSign } from 'lucide-react';
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

const PAGE_SIZE = 10;

export default function DisposalsPage() {
  const [rows, setRows] = useState<AssetDisposal[]>([]);
  const [allRows, setAllRows] = useState<AssetDisposal[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('asset_disposals').select('id, status, disposal_method, salvage_value, created_at').limit(500).then(({ data }) => {
      setAllRows((data as AssetDisposal[]) ?? []);
      setMetricsLoading(false);
    });
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDisposals({ status, page, pageSize: PAGE_SIZE });
      if (result.error) setError(result.error.message);
      else { setRows(result.data); setTotal(result.total); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load disposals');
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const pending = allRows.filter((d) => d.status === 'Pending').length;
  const completed = allRows.filter((d) => d.status === 'Completed').length;
  const rejected = allRows.filter((d) => d.status === 'Rejected').length;
  const salvageTotal = allRows.reduce((sum, d) => sum + (d.salvage_value ?? 0), 0);
  const completionRate = percent(completed, allRows.length || 1);
  const spark = sparklineFromDates(allRows.map((d) => d.created_at));

  const kpis: ModuleKpi[] = [
    { title: 'Pending Review', value: pending, icon: Clock, accent: 'amber', trend: trendFromSparkline(spark), sparklineData: spark },
    { title: 'Completed', value: completed, icon: CheckCircle, accent: 'emerald', trend: completionRate, trendLabel: 'closed' },
    { title: 'Rejected', value: rejected, icon: XCircle, accent: 'rose', trend: rejected > 0 ? 8 : -5, trendLabel: 'denied' },
    { title: 'Salvage Value', value: salvageTotal, prefix: '$', decimals: 0, icon: DollarSign, accent: 'violet', trend: 3, trendLabel: 'recovered' },
  ];

  const columns = useMemo<ColumnDef<AssetDisposal>[]>(() => [
    {
      accessorKey: 'assets',
      header: 'Asset',
      cell: ({ row }) => {
        const a = row.original.assets;
        return a ? <span className="font-medium">{a.name} <span className="text-zinc-500">({a.asset_tag})</span></span> : '—';
      },
    },
    { accessorKey: 'reason', header: 'Reason', cell: ({ row }) => <span className="max-w-[14rem] truncate text-zinc-400">{row.original.reason}</span> },
    { accessorKey: 'disposal_method', header: 'Method', cell: ({ row }) => row.original.disposal_method ?? '—' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { accessorKey: 'created_at', header: 'Requested', cell: ({ row }) => <span className="text-zinc-400">{new Date(row.original.created_at).toLocaleDateString()}</span> },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Link href={`/dashboard/disposals/${row.original.id}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8"><EyeIcon className="h-4 w-4" /></Button>
        </Link>
      ),
    },
  ], []);

  const statusData = countByField(allRows, (d) => d.status);
  const methodData = countByField(allRows, (d) => d.disposal_method ?? 'Unspecified');
  const trendData = groupByDay(allRows, (d) => d.created_at);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8 pb-8">
      <WorkspaceHero
        badge="Retirement Operations"
        title="Disposal Command Center"
        description="Asset retirement pipeline with approval tracking, method analytics, and salvage recovery insights."
        actions={
          <Link href="/dashboard/disposals/new">
            <Button className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600"><PlusIcon className="mr-2 h-4 w-4" />New Disposal</Button>
          </Link>
        }
      />

      <WorkspaceKpiGrid kpis={kpis} loading={metricsLoading} columns={4} />

      <WorkspaceSection title="Retirement Analytics" subtitle={`${completionRate}% completion rate`}>
        <WorkspaceAnalyticsGrid>
          <WorkspaceDonutChart title="By Status" data={statusData} />
          <WorkspaceAreaChart title="Request Volume" data={trendData} />
          <WorkspaceProgressList title="Disposal Methods" items={methodData.map((d) => ({ label: d.name, value: d.value, max: allRows.length || 1 }))} />
        </WorkspaceAnalyticsGrid>
      </WorkspaceSection>

      {error && <ErrorAlert message={error} />}

      <WorkspaceSection title="Disposal Queue" subtitle="Filtered retirement registry">
        <WorkspaceDataPanel
          toolbar={
            <Select value={status} onValueChange={(v) => { setStatus(v ?? 'ALL'); setPage(1); }}>
              <SelectTrigger className="w-[170px] rounded-xl border-violet-500/20 bg-white/[0.03]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          }
          footer={!loading && rows.length > 0 ? <PaginationControls currentPage={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} /> : undefined}
        >
          {loading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            : rows.length === 0 ? <EmptyState title="No disposals" description="Submit a disposal request for an asset." action={<Link href="/dashboard/disposals/new"><Button>New Disposal</Button></Link>} />
            : <EnterpriseTable columns={columns} data={rows} />}
        </WorkspaceDataPanel>
      </WorkspaceSection>
    </div>
  );
}
