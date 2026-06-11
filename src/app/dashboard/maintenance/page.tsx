'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { getMaintenanceRecords, type MaintenanceRecord } from '@/lib/supabase/maintenance';
import { deleteMaintenanceAction } from '@/app/actions/crud';
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
import { RegistryDeleteDialog } from '@/components/common/delete-confirm-dialog';
import { isDeleteBlocked, type DeleteBlockingInfo } from '@/lib/delete/delete-fk-blocking';
import { RegistryDeleteButton } from '@/components/common/registry-delete-button';
import { PlusIcon, EyeIcon, PencilIcon, Wrench, CalendarClock, AlertTriangle, DollarSign, Percent } from 'lucide-react';
import { SuccessToast } from '@/components/common/SuccessToast';
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

function isOverdue(r: MaintenanceRecord) {
  if (!r.scheduled_date || r.completed_date) return false;
  return new Date(r.scheduled_date) < new Date();
}

export default function MaintenancePage() {
  const [showCreatedToast, setShowCreatedToast] = useState(false);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [allRecords, setAllRecords] = useState<MaintenanceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceRecord | null>(null);
  const [deleteBlocking, setDeleteBlocking] = useState<DeleteBlockingInfo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    supabase.from('maintenance_records').select('id, type, cost, scheduled_date, completed_date, created_at').limit(500).then(({ data }: { data: MaintenanceRecord[] | null }) => {
      setAllRecords((data as MaintenanceRecord[]) ?? []);
      setMetricsLoading(false);
    });
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getMaintenanceRecords({
        search,
        type: type && type !== 'ALL_TYPES' ? type : undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      if (result.error) setError(result.error.message);
      else { setRecords(result.data); setTotal(result.total); }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load maintenance records');
    } finally {
      setLoading(false);
    }
  }, [search, type, page]);

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('maintenance-created') === '1') {
      setShowCreatedToast(true);
      sessionStorage.removeItem('maintenance-created');
    }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleSearch = useCallback((term: string) => { setSearch(term); setPage(1); }, []);
  const handleTypeChange = (val: string | null) => { setType(val || ''); setPage(1); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteBlocking(null);
    try {
      const result = await deleteMaintenanceAction(deleteTarget.id);
      if (isDeleteBlocked(result)) {
        setDeleteBlocking(result.blocking);
      } else if ('error' in result && result.error) {
        setError(result.error);
      } else {
        setDialogOpen(false);
        setDeleteTarget(null);
        fetchRecords();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete maintenance record');
    } finally {
      setDeleting(false);
    }
  };

  const scheduled = allRecords.filter((r) => r.scheduled_date && !r.completed_date).length;
  const overdue = allRecords.filter(isOverdue).length;
  const completed = allRecords.filter((r) => r.completed_date).length;
  const compliance = percent(completed, allRecords.length || 1);
  const totalCost = allRecords.reduce((sum, r) => sum + (r.cost ?? 0), 0);
  const spark = sparklineFromDates(allRecords.map((r) => r.scheduled_date ?? r.created_at));

  const kpis: ModuleKpi[] = [
    { title: 'Scheduled', value: scheduled, icon: CalendarClock, accent: 'violet', trend: trendFromSparkline(spark), sparklineData: spark },
    { title: 'Overdue', value: overdue, icon: AlertTriangle, accent: 'rose', trend: overdue > 0 ? 15 : -10, trendLabel: 'at risk' },
    { title: 'Compliance', value: compliance, suffix: '%', icon: Percent, accent: 'emerald', trend: 6, trendLabel: 'on-time' },
    { title: 'Total Cost', value: totalCost, prefix: '$', decimals: 0, icon: DollarSign, accent: 'amber', trend: 4, trendLabel: 'spend' },
  ];

  const columns = useMemo<ColumnDef<MaintenanceRecord>[]>(() => [
    {
      accessorKey: 'assets',
      header: 'Asset',
      cell: ({ row }) => {
        const asset = row.original.assets;
        return <span className="font-medium">{asset ? `${asset.name} (${asset.asset_tag})` : 'Unknown Asset'}</span>;
      },
    },
    { accessorKey: 'type', header: 'Type', cell: ({ row }) => <StatusBadge status={row.original.type} /> },
    { accessorKey: 'vendors', header: 'Vendor', cell: ({ row }) => <span className="text-zinc-400">{row.original.vendors?.name || '—'}</span> },
    {
      accessorKey: 'scheduled_date',
      header: 'Scheduled',
      cell: ({ row }) => {
        const d = row.original.scheduled_date;
        if (!d) return '—';
        const overdueFlag = isOverdue(row.original);
        return <span className={overdueFlag ? 'text-rose-400' : 'text-zinc-400'}>{new Date(d).toLocaleDateString()}</span>;
      },
    },
    { accessorKey: 'completed_date', header: 'Completed', cell: ({ row }) => row.original.completed_date ? <span className="text-emerald-400">{new Date(row.original.completed_date).toLocaleDateString()}</span> : '—' },
    { accessorKey: 'cost', header: 'Cost', cell: ({ row }) => row.original.cost !== null ? `$${Number(row.original.cost).toFixed(2)}` : '—' },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Link href={`/dashboard/maintenance/${row.original.id}`}><Button variant="ghost" size="icon" className="h-8 w-8"><EyeIcon className="h-4 w-4" /></Button></Link>
          <Link href={`/dashboard/maintenance/${row.original.id}/edit`}><Button variant="ghost" size="icon" className="h-8 w-8"><PencilIcon className="h-4 w-4" /></Button></Link>
          <RegistryDeleteButton onClick={() => { setDeleteTarget(row.original); setDeleteBlocking(null); setDialogOpen(true); }} />
        </div>
      ),
    },
  ], []);

  const typeData = countByField(allRecords, (r) => r.type);
  const trendData = groupByDay(allRecords, (r) => r.scheduled_date ?? r.created_at);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-8 pb-8">
      {showCreatedToast && <SuccessToast message="Maintenance record logged successfully." onDismiss={() => setShowCreatedToast(false)} />}

      <WorkspaceHero
        badge="Fleet Operations"
        title="Maintenance Operations Center"
        description="Preventative and corrective servicing intelligence with compliance tracking and cost analytics."
        actions={
          <Link href="/dashboard/maintenance/new">
            <Button className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600"><PlusIcon className="mr-2 h-4 w-4" />Add Record</Button>
          </Link>
        }
      />

      <WorkspaceKpiGrid kpis={kpis} loading={metricsLoading} columns={4} />

      <WorkspaceSection title="Service Analytics" subtitle={`${compliance}% completion compliance`}>
        <WorkspaceAnalyticsGrid>
          <WorkspaceDonutChart title="By Type" data={typeData} />
          <WorkspaceAreaChart title="Service Schedule" data={trendData} />
          <WorkspaceProgressList title="Type Distribution" items={typeData.map((d) => ({ label: d.name, value: d.value, max: allRecords.length || 1 }))} />
        </WorkspaceAnalyticsGrid>
      </WorkspaceSection>

      {error && <ErrorAlert message={error} />}

      <WorkspaceSection title="Maintenance Registry" subtitle={`${total} service records`}>
        <WorkspaceDataPanel
          toolbar={
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex-1"><SearchInput placeholder="Search records…" onSearch={handleSearch} /></div>
              <Select value={type} onValueChange={handleTypeChange}>
                <SelectTrigger className="erp-dark-glass-interactive w-full rounded-xl border text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:w-[200px]"><SelectValue placeholder="All Types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_TYPES">All Types</SelectItem>
                  <SelectItem value="Preventive">Preventive</SelectItem>
                  <SelectItem value="Corrective">Corrective</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
          footer={!loading && records.length > 0 ? <PaginationControls currentPage={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} /> : undefined}
        >
          {loading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            : records.length === 0 ? <EmptyState title="No maintenance records" description={search || type ? 'No records match your filters.' : 'Start logging maintenance activities for your assets.'} action={!(search || type) ? <Link href="/dashboard/maintenance/new"><Button>Add Record</Button></Link> : undefined} />
            : <EnterpriseTable columns={columns} data={records} />}
        </WorkspaceDataPanel>
      </WorkspaceSection>

      <RegistryDeleteDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setDeleteBlocking(null);
            setDeleteTarget(null);
          }
        }}
        title="Delete Maintenance Record"
        description="Permanently remove this maintenance record. This action cannot be undone."
        blocking={deleteBlocking}
        onConfirm={handleDelete}
        confirming={deleting}
      />
    </div>
  );
}
