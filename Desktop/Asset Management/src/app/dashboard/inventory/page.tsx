'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { getInventoryItems } from '@/lib/supabase/brd/inventory';
import type { InventoryItem } from '@/lib/brd/types';
import { supabase } from '@/lib/supabase/client';
import { SearchInput } from '@/components/common/SearchInput';
import { PaginationControls } from '@/components/common/PaginationControls';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Skeleton } from '@/components/common/Skeleton';
import { EnterpriseTable } from '@/components/enterprise/enterprise-table';
import { Button } from '@/components/ui/button';
import {
  WorkspaceHero,
  WorkspaceKpiGrid,
  WorkspaceSection,
  WorkspaceAnalyticsGrid,
  WorkspaceDataPanel,
  type ModuleKpi,
} from '@/components/workspace/workspace-layout';
import {
  WorkspaceAreaChart,
  WorkspaceDonutChart,
  WorkspaceProgressList,
} from '@/components/workspace/workspace-charts';
import { countByField, groupByDay, percent, sparklineFromDates, trendFromSparkline } from '@/lib/workspace/insights';
import { PlusIcon, EyeIcon, AlertTriangleIcon, Package, DollarSign, MapPin, TrendingDown } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { canManageInventory } from '@/lib/auth/roles';
import { cn } from '@/lib/utils';
import { ExportToolbar } from '@/components/enterprise/export-toolbar';

const PAGE_SIZE = 10;

function isLowStock(item: InventoryItem) {
  return item.quantity_on_hand <= item.reorder_level;
}

export default function InventoryPage() {
  const { role } = useAuth();
  const [rows, setRows] = useState<InventoryItem[]>([]);
  const [allItems, setAllItems] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('inventory')
      .select('id, name, quantity_on_hand, reorder_level, unit_cost, location, created_at')
      .limit(500)
      .then(({ data }) => {
        setAllItems((data as InventoryItem[]) ?? []);
        setMetricsLoading(false);
      });
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getInventoryItems({ search, page, pageSize: PAGE_SIZE });
      if (result.error) setError(result.error.message);
      else {
        setRows(result.data);
        setTotal(result.total);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    const timer = setTimeout(fetchRows, 300);
    return () => clearTimeout(timer);
  }, [fetchRows]);

  const lowStock = allItems.filter(isLowStock).length;
  const stockValue = allItems.reduce(
    (s, i) => s + (i.quantity_on_hand ?? 0) * (Number(i.unit_cost) || 0),
    0
  );
  const locations = new Set(allItems.map((i) => i.location).filter(Boolean)).size;
  const spark = sparklineFromDates(allItems.map((i) => i.created_at));

  const kpis: ModuleKpi[] = [
    { title: 'Total Items', value: allItems.length || total, icon: Package, accent: 'violet', trend: trendFromSparkline(spark), trendLabel: 'catalog', sparklineData: spark },
    { title: 'Low Stock', value: lowStock, icon: TrendingDown, accent: 'amber', trend: lowStock > 0 ? 12 : -5, trendLabel: 'risk' },
    { title: 'Stock Value', value: Math.round(stockValue), prefix: '$', icon: DollarSign, accent: 'emerald', trend: 8, trendLabel: 'valuation' },
    { title: 'Locations', value: locations || 1, icon: MapPin, accent: 'cyan', trend: 3, trendLabel: 'sites' },
  ];

  const columns = useMemo<ColumnDef<InventoryItem>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => {
        const low = isLowStock(row.original);
        return (
          <div className="flex items-center gap-2">
            {low && <AlertTriangleIcon className="h-4 w-4 shrink-0 text-amber-400" />}
            <Link href={`/dashboard/inventory/${row.original.id}`} className={cn('font-medium hover:text-violet-300', low && 'text-amber-300')}>
              {row.original.name}
            </Link>
          </div>
        );
      },
    },
    { accessorKey: 'sku', header: 'SKU', cell: ({ row }) => <span className="font-mono text-xs text-zinc-400">{row.original.sku ?? '—'}</span> },
    {
      accessorKey: 'quantity_on_hand',
      header: 'Qty on Hand',
      cell: ({ row }) => {
        const low = isLowStock(row.original);
        return <span className={cn('font-semibold tabular-nums', low && 'text-amber-300')}>{row.original.quantity_on_hand}{low && ' · Low'}</span>;
      },
    },
    { accessorKey: 'reorder_level', header: 'Reorder', cell: ({ row }) => <span className="tabular-nums text-zinc-400">{row.original.reorder_level}</span> },
    { accessorKey: 'asset_categories', header: 'Category', cell: ({ row }) => row.original.asset_categories?.name ?? '—' },
    { accessorKey: 'location', header: 'Location', cell: ({ row }) => row.original.location ?? '—' },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Link href={`/dashboard/inventory/${row.original.id}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-60 group-hover:opacity-100"><EyeIcon className="h-4 w-4" /></Button>
        </Link>
      ),
    },
  ], []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const categoryData = countByField(allItems, (i) => i.asset_categories?.name ?? 'Uncategorized');
  const locationData = countByField(allItems, (i) => i.location ?? 'Unassigned').slice(0, 5);
  const trendData = groupByDay(allItems, (i) => i.created_at);

  return (
    <div className="space-y-8 pb-8">
      <WorkspaceHero
        badge="Inventory Operations"
        title="Inventory Command Center"
        description="Real-time stock intelligence, reorder risk monitoring, and location-aware supply analytics."
        actions={
          canManageInventory(role) ? (
            <Link href="/dashboard/inventory/new">
              <Button className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/20">
                <PlusIcon className="mr-2 h-4 w-4" />Add Item
              </Button>
            </Link>
          ) : null
        }
      />

      <WorkspaceKpiGrid kpis={kpis} loading={metricsLoading} />

      <WorkspaceSection title="Supply Intelligence" subtitle="Distribution, velocity, and stock health">
        <WorkspaceAnalyticsGrid>
          <WorkspaceDonutChart title="By Category" subtitle="SKU distribution" data={categoryData} />
          <WorkspaceAreaChart title="Intake Velocity" subtitle="Last 7 days" data={trendData} />
          <WorkspaceProgressList
            title="Location Fill"
            subtitle="Units by site"
            items={locationData.map((d) => ({ label: d.name, value: d.value, max: allItems.length || 1 }))}
          />
        </WorkspaceAnalyticsGrid>
      </WorkspaceSection>

      {error && <ErrorAlert message={error} />}

      <WorkspaceSection title="Stock Registry" subtitle={`${total} items · ${percent(lowStock, allItems.length || 1)}% below reorder`}>
        <WorkspaceDataPanel
          toolbar={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1"><SearchInput placeholder="Search by name or SKU…" onSearch={(t) => { setSearch(t); setPage(1); }} /></div>
              <ExportToolbar
                filename={`inventory-${new Date().toISOString().slice(0, 10)}`}
                title="Inventory Export"
                rows={allItems}
                columns={[
                  { header: 'Name', accessor: (r) => r.name },
                  { header: 'SKU', accessor: (r) => r.sku },
                  { header: 'Qty', accessor: (r) => r.quantity_on_hand },
                  { header: 'Reorder', accessor: (r) => r.reorder_level },
                  { header: 'Unit Cost', accessor: (r) => r.unit_cost },
                  { header: 'Location', accessor: (r) => r.location },
                ]}
              />
            </div>
          }
          footer={!loading && rows.length > 0 ? (
            <PaginationControls currentPage={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
          ) : undefined}
        >
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          ) : rows.length === 0 ? (
            <EmptyState title="No inventory items" description="Add items to begin tracking stock." action={canManageInventory(role) ? <Link href="/dashboard/inventory/new"><Button>Add Item</Button></Link> : undefined} />
          ) : (
            <EnterpriseTable columns={columns} data={rows} />
          )}
        </WorkspaceDataPanel>
      </WorkspaceSection>
    </div>
  );
}
