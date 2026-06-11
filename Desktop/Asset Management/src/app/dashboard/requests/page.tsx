'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { getRequests, AssetRequest, formatRequestLabel } from '@/lib/supabase/requests';
import { REQUEST_STATUS, REQUEST_STATUS_OPTIONS, PENDING_REQUEST_STATUSES } from '@/lib/constants/request-status';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EnterpriseTable } from '@/components/enterprise/enterprise-table';
import { StatusBadge } from '@/components/enterprise/status-badge';
import { SearchInput } from '@/components/common/SearchInput';
import { PaginationControls } from '@/components/common/PaginationControls';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/common/Skeleton';
import { PlusIcon, EyeIcon, FileText, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { ExportToolbar } from '@/components/enterprise/export-toolbar';
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

export default function RequestsPage() {
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [allRequests, setAllRequests] = useState<AssetRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  useEffect(() => {
    supabase.from('asset_requests').select('id, status, priority, created_at').limit(500).then(({ data }) => {
      setAllRequests((data as AssetRequest[]) ?? []);
      setMetricsLoading(false);
    });
  }, []);

  useEffect(() => {
    async function loadRequests() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: reqError, total: reqTotal } = await getRequests({
          search,
          status: status === 'ALL' ? undefined : status,
          page,
          pageSize: PAGE_SIZE,
        });
        if (reqError) setError(reqError.message);
        else {
          setRequests(data || []);
          setTotal(reqTotal ?? 0);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load requests');
      } finally {
        setLoading(false);
      }
    }
    const timer = setTimeout(loadRequests, 300);
    return () => clearTimeout(timer);
  }, [search, status, page]);

  const open = allRequests.filter((r) => PENDING_REQUEST_STATUSES.includes(r.status as typeof PENDING_REQUEST_STATUSES[number])).length;
  const approved = allRequests.filter((r) => r.status === REQUEST_STATUS.APPROVED || r.status === REQUEST_STATUS.FULFILLED).length;
  const rejected = allRequests.filter((r) => r.status === REQUEST_STATUS.REJECTED).length;
  const spark = sparklineFromDates(allRequests.map((r) => r.created_at));

  const kpis: ModuleKpi[] = [
    { title: 'Open Pipeline', value: open, icon: Clock, accent: 'amber', trend: trendFromSparkline(spark), sparklineData: spark, trendLabel: 'in flight' },
    { title: 'Approved', value: approved, icon: CheckCircle2, accent: 'emerald', trend: 14, trendLabel: 'success' },
    { title: 'Rejected', value: rejected, icon: XCircle, accent: 'rose', trend: rejected > 0 ? 5 : -8, trendLabel: 'declined' },
    { title: 'Total Requests', value: allRequests.length || total, icon: FileText, accent: 'violet', trend: 9, trendLabel: 'volume' },
  ];

  const columns = useMemo<ColumnDef<AssetRequest>[]>(() => [
    {
      accessorKey: 'justification',
      header: 'Request',
      cell: ({ row }) => (
        <Link href={`/dashboard/requests/${row.original.id}`} className="font-medium hover:text-violet-300">
          {formatRequestLabel(row.original.justification)}
        </Link>
      ),
    },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { accessorKey: 'priority', header: 'Priority', cell: ({ row }) => <StatusBadge status={row.original.priority} /> },
    { accessorKey: 'created_at', header: 'Submitted', cell: ({ row }) => <span className="text-zinc-400">{new Date(row.original.created_at).toLocaleDateString()}</span> },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Link href={`/dashboard/requests/${row.original.id}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8"><EyeIcon className="h-4 w-4" /></Button>
        </Link>
      ),
    },
  ], []);

  const statusData = countByField(allRequests, (r) => r.status);
  const priorityData = countByField(allRequests, (r) => r.priority);
  const trendData = groupByDay(allRequests, (r) => r.created_at);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8 pb-8">
      <WorkspaceHero
        badge="Request Operations"
        title="Asset Request Workspace"
        description="Track employee requests through manager, procurement, and finance approval pipelines."
        actions={
          <Link href="/dashboard/requests/new">
            <Button className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/20">
              <PlusIcon className="mr-2 h-4 w-4" />New Request
            </Button>
          </Link>
        }
      />

      <WorkspaceKpiGrid kpis={kpis} loading={metricsLoading} />

      <WorkspaceSection title="Workflow Intelligence" subtitle={`${percent(open, allRequests.length || 1)}% awaiting action`}>
        <WorkspaceAnalyticsGrid>
          <WorkspaceDonutChart title="Status Mix" data={statusData} />
          <WorkspaceAreaChart title="Submission Trend" subtitle="7-day volume" data={trendData} />
          <WorkspaceProgressList
            title="Priority Distribution"
            items={priorityData.map((d) => ({ label: d.name, value: d.value, max: allRequests.length || 1, color: d.name === 'High' ? '#e11d48' : undefined }))}
          />
        </WorkspaceAnalyticsGrid>
      </WorkspaceSection>

      {error && <ErrorAlert message={error} />}

      <WorkspaceSection title="Request Queue" subtitle="Filtered operational view">
        <WorkspaceDataPanel
          toolbar={
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex-1"><SearchInput placeholder="Search requests…" onSearch={(t) => { setSearch(t); setPage(1); }} /></div>
              <Select value={status} onValueChange={(v) => { setStatus(v ?? 'ALL'); setPage(1); }}>
                <SelectTrigger className="w-full rounded-xl border-violet-500/20 bg-white/[0.03] md:w-[220px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  {REQUEST_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <ExportToolbar filename={`requests-${new Date().toISOString().slice(0, 10)}`} title="Requests Export" rows={allRequests} columns={[
                { header: 'Justification', accessor: (r) => r.justification },
                { header: 'Status', accessor: (r) => r.status },
                { header: 'Priority', accessor: (r) => r.priority },
                { header: 'Created', accessor: (r) => r.created_at },
              ]} />
            </div>
          }
          footer={!loading && requests.length > 0 ? <PaginationControls currentPage={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} /> : undefined}
        >
          {loading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            : requests.length === 0 ? <EmptyState title="No requests found" description="Adjust filters or create a request." action={<Link href="/dashboard/requests/new"><Button>New Request</Button></Link>} />
            : <EnterpriseTable columns={columns} data={requests} />}
        </WorkspaceDataPanel>
      </WorkspaceSection>
    </div>
  );
}
