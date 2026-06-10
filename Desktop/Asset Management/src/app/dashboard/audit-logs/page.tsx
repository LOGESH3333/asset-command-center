'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getAuditLogs, type AuditLog } from '@/lib/supabase/audit-logs';
import { supabase } from '@/lib/supabase/client';
import { SearchInput } from '@/components/common/SearchInput';
import { PaginationControls } from '@/components/common/PaginationControls';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Skeleton } from '@/components/common/Skeleton';
import { EnterpriseTable } from '@/components/enterprise/enterprise-table';
import { formatAuditLogSummary } from '@/lib/supabase/audit-log-format';
import { formatPersonName } from '@/lib/display-labels';
import { StatusBadge } from '@/components/enterprise/status-badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { List, GitBranch, Activity, Users, AlertTriangle, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ColumnDef } from '@tanstack/react-table';
import {
  WorkspaceHero,
  WorkspaceKpiGrid,
  WorkspaceSection,
  WorkspaceAnalyticsGrid,
  WorkspaceDataPanel,
  type ModuleKpi,
} from '@/components/workspace/workspace-layout';
import { WorkspaceDonutChart, WorkspaceAreaChart, WorkspaceProgressList } from '@/components/workspace/workspace-charts';
import { AuditIntelligenceTimeline } from '@/components/workspace/audit-intelligence-center';
import { countByField, groupByDay, percent, sparklineFromDates, trendFromSparkline } from '@/lib/workspace/insights';

const PAGE_SIZE = 10;
const actionStatusMap: Record<string, string> = { INSERT: 'Approved', UPDATE: 'Pending', DELETE: 'Rejected' };
type AuditMetric = Pick<AuditLog, 'id' | 'action' | 'table_name' | 'user_id' | 'created_at'>;

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [allLogs, setAllLogs] = useState<AuditMetric[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [tableFilter, setTableFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');

  useEffect(() => {
    supabase
      .from('audit_logs')
      .select('id, action, table_name, user_id, created_at, actor:users!user_id(id)')
      .order('created_at', { ascending: false })
      .limit(300)
      .then(({ data }) => {
        setAllLogs((data as AuditMetric[]) ?? []);
        setMetricsLoading(false);
      });
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAuditLogs({
        search,
        action: actionFilter === 'ALL' ? undefined : actionFilter,
        table_name: tableFilter === 'ALL' ? undefined : tableFilter,
        page,
        pageSize: PAGE_SIZE,
      });
      if (result.error) setError(result.error.message);
      else { setLogs(result.data); setTotal(result.total); }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [search, actionFilter, tableFilter, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const today = new Date().toISOString().split('T')[0];
  const changesToday = allLogs.filter((l) => l.created_at.startsWith(today)).length;
  const activeUsers = new Set(allLogs.map((l) => l.user_id).filter(Boolean)).size;
  const critical = allLogs.filter((l) => l.action === 'DELETE').length;
  const modules = new Set(allLogs.map((l) => l.table_name)).size;
  const spark = sparklineFromDates(allLogs.map((l) => l.created_at));

  const kpis: ModuleKpi[] = [
    { title: 'Changes Today', value: changesToday, icon: Activity, accent: 'violet', trend: trendFromSparkline(spark), sparklineData: spark },
    { title: 'Active Users', value: activeUsers || 1, icon: Users, accent: 'cyan', trend: 6, trendLabel: 'actors' },
    { title: 'Critical Events', value: critical, icon: AlertTriangle, accent: 'rose', trend: critical > 0 ? 12 : -10, trendLabel: 'deletes' },
    { title: 'Module Activity', value: modules || 4, icon: Database, accent: 'emerald', trend: 5, trendLabel: 'tables' },
  ];

  const columns = useMemo<ColumnDef<AuditLog>[]>(() => [
    { accessorKey: 'created_at', header: 'When', cell: ({ row }) => <span className="text-xs text-zinc-500">{new Date(row.original.created_at).toLocaleString()}</span> },
    { accessorKey: 'action', header: 'Action', cell: ({ row }) => <StatusBadge status={actionStatusMap[row.original.action] ?? row.original.action} /> },
    { accessorKey: 'table_name', header: 'Module', cell: ({ row }) => <span className="font-mono text-xs text-violet-300">{row.original.table_name}</span> },
    { id: 'summary', header: 'Record', cell: ({ row }) => <span className="max-w-xs truncate">{formatAuditLogSummary(row.original)}</span> },
    { id: 'actor', header: 'Actor', cell: ({ row }) => <span className="text-zinc-400">{formatPersonName(row.original.actor, 'System')}</span> },
  ], []);

  const moduleData = countByField(allLogs, (l) => l.table_name.replace(/_/g, ' '));
  const actionData = countByField(allLogs, (l) => l.action);
  const trendData = groupByDay(allLogs, (l) => l.created_at);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-8 pb-8">
      <WorkspaceHero
        badge="Compliance Intelligence"
        title="Audit Intelligence Center"
        description="Forensic timeline of system changes with module-level activity analytics and actor attribution."
      />

      <WorkspaceKpiGrid kpis={kpis} loading={metricsLoading} columns={4} />

      <WorkspaceSection title="Activity Analytics" subtitle={`${percent(changesToday, allLogs.length || 1)}% of events occurred today`}>
        <WorkspaceAnalyticsGrid>
          <WorkspaceDonutChart title="Module Activity" data={moduleData} />
          <WorkspaceAreaChart title="Event Velocity" subtitle="7-day trend" data={trendData} />
          <WorkspaceProgressList title="Action Mix" items={actionData.map((d) => ({ label: d.name, value: d.value, max: allLogs.length || 1 }))} />
        </WorkspaceAnalyticsGrid>
      </WorkspaceSection>

      {error && <ErrorAlert message={error} />}

      <WorkspaceSection title="Event Stream" subtitle="Grouped timeline with expandable forensic detail">
        <WorkspaceDataPanel
          toolbar={
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="flex-1"><SearchInput placeholder="Search events…" onSearch={(t) => { setSearch(t); setPage(1); }} /></div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
                  <Button type="button" variant="ghost" size="sm" className={cn('rounded-lg', viewMode === 'timeline' && 'bg-violet-600/20 text-violet-300')} onClick={() => setViewMode('timeline')}>
                    <GitBranch className="mr-1.5 h-4 w-4" />Timeline
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className={cn('rounded-lg', viewMode === 'table' && 'bg-violet-600/20 text-violet-300')} onClick={() => setViewMode('table')}>
                    <List className="mr-1.5 h-4 w-4" />Table
                  </Button>
                </div>
                <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v ?? 'ALL'); setPage(1); }}>
                  <SelectTrigger className="w-[150px] rounded-xl border-violet-500/20 bg-white/[0.03]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Actions</SelectItem>
                    <SelectItem value="INSERT">Create</SelectItem>
                    <SelectItem value="UPDATE">Update</SelectItem>
                    <SelectItem value="DELETE">Delete</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={tableFilter} onValueChange={(v) => { setTableFilter(v ?? 'ALL'); setPage(1); }}>
                  <SelectTrigger className="w-[150px] rounded-xl border-violet-500/20 bg-white/[0.03]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Modules</SelectItem>
                    <SelectItem value="assets">Assets</SelectItem>
                    <SelectItem value="asset_requests">Requests</SelectItem>
                    <SelectItem value="maintenance_records">Maintenance</SelectItem>
                    <SelectItem value="users">Users</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          }
          footer={!loading && logs.length > 0 ? <PaginationControls currentPage={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} /> : undefined}
        >
          {loading ? <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
            : logs.length === 0 ? <EmptyState title="No audit events" description="Adjust filters to explore compliance history." />
            : viewMode === 'timeline' ? <AuditIntelligenceTimeline logs={logs} /> : <EnterpriseTable columns={columns} data={logs} />}
        </WorkspaceDataPanel>
      </WorkspaceSection>
    </div>
  );
}
