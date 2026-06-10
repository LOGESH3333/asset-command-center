'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { getProcurements } from '@/lib/supabase/brd/procurement';
import type { Procurement } from '@/lib/brd/types';
import { supabase } from '@/lib/supabase/client';
import { SearchInput } from '@/components/common/SearchInput';
import { PaginationControls } from '@/components/common/PaginationControls';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Skeleton } from '@/components/common/Skeleton';
import { EnterpriseTable } from '@/components/enterprise/enterprise-table';
import { StatusBadge } from '@/components/enterprise/status-badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusIcon, EyeIcon, Briefcase, DollarSign, Percent, Activity } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { canManageProcurement } from '@/lib/auth/roles';
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
const BUDGET_CAP = 500000;
const ACTIVE_STATUSES = ['Draft', 'Submitted', 'Approved', 'Ordered'];

export default function ProcurementPage() {
  const { role } = useAuth();
  const [rows, setRows] = useState<Procurement[]>([]);
  const [allRows, setAllRows] = useState<Procurement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('procurements').select('id, status, priority, estimated_cost, created_at').limit(500).then(({ data }) => {
      setAllRows((data as Procurement[]) ?? []);
      setMetricsLoading(false);
    });
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getProcurements({ status, search, page, pageSize: PAGE_SIZE });
      if (result.error) setError(result.error.message);
      else { setRows(result.data); setTotal(result.total); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load procurements');
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  useEffect(() => {
    const timer = setTimeout(fetchRows, 300);
    return () => clearTimeout(timer);
  }, [fetchRows]);

  const activeCases = allRows.filter((p) => ACTIVE_STATUSES.includes(p.status)).length;
  const totalSpend = allRows.reduce((sum, p) => sum + (p.estimated_cost ?? 0), 0);
  const closed = allRows.filter((p) => p.status === 'Closed').length;
  const completion = percent(closed, allRows.length || 1);
  const budgetUsed = percent(totalSpend, BUDGET_CAP);
  const spark = sparklineFromDates(allRows.map((p) => p.created_at));

  const kpis: ModuleKpi[] = [
    { title: 'Budget Used', value: budgetUsed, suffix: '%', icon: DollarSign, accent: 'violet', trend: trendFromSparkline(spark), sparklineData: spark },
    { title: 'Active Cases', value: activeCases, icon: Activity, accent: 'cyan', trend: 6, trendLabel: 'in-flight' },
    { title: 'Est. Spend', value: totalSpend, prefix: '$', decimals: 0, icon: Briefcase, accent: 'amber', trend: 9, trendLabel: 'pipeline' },
    { title: 'Completion', value: completion, suffix: '%', icon: Percent, accent: 'emerald', trend: completion, trendLabel: 'closed' },
  ];

  const columns = useMemo<ColumnDef<Procurement>[]>(() => [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <Link href={`/dashboard/procurement/${row.original.id}`} className="font-medium hover:text-violet-300">{row.original.title}</Link>
      ),
    },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { accessorKey: 'priority', header: 'Priority', cell: ({ row }) => <StatusBadge status={row.original.priority} /> },
    { accessorKey: 'vendors', header: 'Vendor', cell: ({ row }) => <span className="text-zinc-400">{row.original.vendors?.name ?? '—'}</span> },
    {
      accessorKey: 'estimated_cost',
      header: 'Est. Cost',
      cell: ({ row }) => row.original.estimated_cost != null ? `$${row.original.estimated_cost.toLocaleString()}` : '—',
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Link href={`/dashboard/procurement/${row.original.id}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8"><EyeIcon className="h-4 w-4" /></Button>
        </Link>
      ),
    },
  ], []);

  const statusData = countByField(allRows, (p) => p.status);
  const priorityData = countByField(allRows, (p) => p.priority);
  const trendData = groupByDay(allRows, (p) => p.created_at);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8 pb-8">
      <WorkspaceHero
        badge="Sourcing Intelligence"
        title="Procurement Operations Center"
        description="End-to-end purchasing pipeline with budget utilization, spend analytics, and case completion tracking."
        actions={
          canManageProcurement(role) ? (
            <Link href="/dashboard/procurement/new">
              <Button className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600"><PlusIcon className="mr-2 h-4 w-4" />New Procurement</Button>
            </Link>
          ) : null
        }
      />

      <WorkspaceKpiGrid kpis={kpis} loading={metricsLoading} columns={4} />

      <WorkspaceSection title="Sourcing Analytics" subtitle={`$${totalSpend.toLocaleString()} estimated pipeline spend`}>
        <WorkspaceAnalyticsGrid>
          <WorkspaceDonutChart title="By Status" data={statusData} />
          <WorkspaceAreaChart title="Case Volume" data={trendData} />
          <WorkspaceProgressList title="Priority Mix" items={priorityData.map((d) => ({ label: d.name, value: d.value, max: allRows.length || 1 }))} />
        </WorkspaceAnalyticsGrid>
      </WorkspaceSection>

      {error && <ErrorAlert message={error} />}

      <WorkspaceSection title="Procurement Registry" subtitle={`${total} active sourcing cases`}>
        <WorkspaceDataPanel
          toolbar={
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex-1"><SearchInput placeholder="Search procurements…" onSearch={(term) => { setSearch(term); setPage(1); }} /></div>
              <Select value={status} onValueChange={(v) => { setStatus(v ?? 'ALL'); setPage(1); }}>
                <SelectTrigger className="w-full rounded-xl border-violet-500/20 bg-white/[0.03] md:w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Submitted">Submitted</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Ordered">Ordered</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
          footer={!loading && rows.length > 0 ? <PaginationControls currentPage={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} /> : undefined}
        >
          {loading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            : rows.length === 0 ? <EmptyState title="No procurements" description="Create a procurement case to track purchasing." action={canManageProcurement(role) ? <Link href="/dashboard/procurement/new"><Button>New Procurement</Button></Link> : undefined} />
            : <EnterpriseTable columns={columns} data={rows} />}
        </WorkspaceDataPanel>
      </WorkspaceSection>
    </div>
  );
}
