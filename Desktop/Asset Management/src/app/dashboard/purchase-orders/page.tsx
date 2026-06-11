'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { getPurchaseOrders } from '@/lib/supabase/brd/purchase-orders';
import type { PurchaseOrder } from '@/lib/brd/types';
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
import { PlusIcon, EyeIcon, FileText, DollarSign, Truck, Send } from 'lucide-react';
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

export default function PurchaseOrdersPage() {
  const { role } = useAuth();
  const [rows, setRows] = useState<PurchaseOrder[]>([]);
  const [allRows, setAllRows] = useState<PurchaseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('purchase_orders').select('id, status, total_amount, order_date, created_at').limit(500).then(({ data }) => {
      setAllRows((data as PurchaseOrder[]) ?? []);
      setMetricsLoading(false);
    });
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getPurchaseOrders({ status, search, page, pageSize: PAGE_SIZE });
      if (result.error) setError(result.error.message);
      else { setRows(result.data); setTotal(result.total); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  useEffect(() => {
    const timer = setTimeout(fetchRows, 300);
    return () => clearTimeout(timer);
  }, [fetchRows]);

  const openPOs = allRows.filter((p) => p.status === 'Draft' || p.status === 'Sent').length;
  const received = allRows.filter((p) => p.status === 'Received').length;
  const sent = allRows.filter((p) => p.status === 'Sent').length;
  const totalValue = allRows.reduce((sum, p) => sum + (p.total_amount ?? 0), 0);
  const fulfillment = percent(received, allRows.length || 1);
  const spark = sparklineFromDates(allRows.map((p) => p.order_date ?? p.created_at));

  const kpis: ModuleKpi[] = [
    { title: 'Open POs', value: openPOs, icon: FileText, accent: 'violet', trend: trendFromSparkline(spark), sparklineData: spark },
    { title: 'Sent to Vendor', value: sent, icon: Send, accent: 'cyan', trend: 5, trendLabel: 'outbound' },
    { title: 'Total Value', value: totalValue, prefix: '$', decimals: 0, icon: DollarSign, accent: 'amber', trend: 8, trendLabel: 'committed' },
    { title: 'Fulfillment', value: fulfillment, suffix: '%', icon: Truck, accent: 'emerald', trend: fulfillment, trendLabel: 'received' },
  ];

  const columns = useMemo<ColumnDef<PurchaseOrder>[]>(() => [
    {
      accessorKey: 'po_number',
      header: 'PO Number',
      cell: ({ row }) => (
        <Link href={`/dashboard/purchase-orders/${row.original.id}`} className="font-mono font-medium hover:text-violet-300">{row.original.po_number}</Link>
      ),
    },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { accessorKey: 'vendors', header: 'Vendor', cell: ({ row }) => <span className="text-zinc-400">{row.original.vendors?.name ?? '—'}</span> },
    { accessorKey: 'procurements', header: 'Procurement', cell: ({ row }) => row.original.procurements?.title ?? '—' },
    {
      accessorKey: 'total_amount',
      header: 'Total',
      cell: ({ row }) => row.original.total_amount != null ? `$${row.original.total_amount.toLocaleString()}` : '—',
    },
    {
      accessorKey: 'order_date',
      header: 'Order Date',
      cell: ({ row }) => row.original.order_date ? <span className="text-zinc-400">{new Date(row.original.order_date).toLocaleDateString()}</span> : '—',
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Link href={`/dashboard/purchase-orders/${row.original.id}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8"><EyeIcon className="h-4 w-4" /></Button>
        </Link>
      ),
    },
  ], []);

  const statusData = countByField(allRows, (p) => p.status);
  const trendData = groupByDay(allRows, (p) => p.order_date ?? p.created_at);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8 pb-8">
      <WorkspaceHero
        badge="Purchase Intelligence"
        title="Purchase Order Operations Center"
        description="PO lifecycle management with fulfillment tracking, vendor commitments, and spend analytics."
        actions={
          canManageProcurement(role) ? (
            <Link href="/dashboard/purchase-orders/new">
              <Button className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600"><PlusIcon className="mr-2 h-4 w-4" />New PO</Button>
            </Link>
          ) : null
        }
      />

      <WorkspaceKpiGrid kpis={kpis} loading={metricsLoading} columns={4} />

      <WorkspaceSection title="PO Analytics" subtitle={`$${totalValue.toLocaleString()} total committed value`}>
        <WorkspaceAnalyticsGrid>
          <WorkspaceDonutChart title="By Status" data={statusData} />
          <WorkspaceAreaChart title="Order Volume" data={trendData} />
          <WorkspaceProgressList title="Status Pipeline" items={statusData.map((d) => ({ label: d.name, value: d.value, max: allRows.length || 1 }))} />
        </WorkspaceAnalyticsGrid>
      </WorkspaceSection>

      {error && <ErrorAlert message={error} />}

      <WorkspaceSection title="Purchase Order Registry" subtitle={`${total} purchase orders`}>
        <WorkspaceDataPanel
          toolbar={
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex-1"><SearchInput placeholder="Search PO number…" onSearch={(term) => { setSearch(term); setPage(1); }} /></div>
              <Select value={status} onValueChange={(v) => { setStatus(v ?? 'ALL'); setPage(1); }}>
                <SelectTrigger className="w-full rounded-xl border-violet-500/20 bg-white/[0.03] md:w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Sent">Sent</SelectItem>
                  <SelectItem value="Received">Received</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
          footer={!loading && rows.length > 0 ? <PaginationControls currentPage={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} /> : undefined}
        >
          {loading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            : rows.length === 0 ? <EmptyState title="No purchase orders" description="Create a purchase order for a procurement case." action={canManageProcurement(role) ? <Link href="/dashboard/purchase-orders/new"><Button>New PO</Button></Link> : undefined} />
            : <EnterpriseTable columns={columns} data={rows} />}
        </WorkspaceDataPanel>
      </WorkspaceSection>
    </div>
  );
}
