'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { getCategories, type Category } from '@/lib/supabase/categories';
import { deleteCategoryAction } from '@/app/actions/crud';
import { supabase } from '@/lib/supabase/client';
import { SearchInput } from '@/components/common/SearchInput';
import { PaginationControls } from '@/components/common/PaginationControls';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Skeleton } from '@/components/common/Skeleton';
import { EnterpriseTable } from '@/components/enterprise/enterprise-table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PlusIcon, EyeIcon, PencilIcon, Trash2Icon, Loader2Icon, Layers, FolderTree, TrendingUp, Calendar } from 'lucide-react';
import {
  WorkspaceHero,
  WorkspaceKpiGrid,
  WorkspaceSection,
  WorkspaceAnalyticsGrid,
  WorkspaceDataPanel,
  type ModuleKpi,
} from '@/components/workspace/workspace-layout';
import { WorkspaceDonutChart, WorkspaceAreaChart, WorkspaceProgressList } from '@/components/workspace/workspace-charts';
import { groupByDay, percent, sparklineFromDates, trendFromSparkline } from '@/lib/workspace/insights';

const PAGE_SIZE = 10;

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    supabase.from('asset_categories').select('id, name, created_at').limit(500).then(({ data }) => {
      setAllCategories((data as Category[]) ?? []);
      setMetricsLoading(false);
    });
  }, []);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getCategories({ search, page, pageSize: PAGE_SIZE });
      if (result.error) setError(result.error.message);
      else { setCategories(result.data); setTotal(result.total); }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleSearch = useCallback((term: string) => { setSearch(term); setPage(1); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteCategoryAction(deleteTarget.id);
      if (result.error) setError(result.error);
      else { setDialogOpen(false); setDeleteTarget(null); fetchCategories(); }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
    } finally {
      setDeleting(false);
    }
  };

  const now = new Date();
  const thisMonth = allCategories.filter((c) => {
    const d = new Date(c.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const spark = sparklineFromDates(allCategories.map((c) => c.created_at));
  const trendData = groupByDay(allCategories, (c) => c.created_at);

  const kpis: ModuleKpi[] = [
    { title: 'Total Categories', value: allCategories.length, icon: Layers, accent: 'violet', trend: trendFromSparkline(spark), sparklineData: spark },
    { title: 'Active Taxonomy', value: allCategories.length || 1, icon: FolderTree, accent: 'cyan', trend: 5, trendLabel: 'groups' },
    { title: 'Added This Month', value: thisMonth, icon: Calendar, accent: 'emerald', trend: thisMonth > 0 ? 12 : 0, trendLabel: 'new' },
    { title: 'Coverage', value: percent(allCategories.length, Math.max(allCategories.length, 1)), suffix: '%', icon: TrendingUp, accent: 'amber', trend: 8, trendLabel: 'indexed' },
  ];

  const topCategories = [...allCategories]
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 6)
    .map((c) => ({ label: c.name, value: 1, max: 1 }));

  const columns = useMemo<ColumnDef<Category>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <Link href={`/dashboard/categories/${row.original.id}`} className="font-medium hover:text-violet-300">
          {row.original.name}
        </Link>
      ),
    },
    { accessorKey: 'created_at', header: 'Created', cell: ({ row }) => <span className="text-zinc-400">{new Date(row.original.created_at).toLocaleDateString()}</span> },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Link href={`/dashboard/categories/${row.original.id}`}><Button variant="ghost" size="icon" className="h-8 w-8"><EyeIcon className="h-4 w-4" /></Button></Link>
          <Link href={`/dashboard/categories/${row.original.id}/edit`}><Button variant="ghost" size="icon" className="h-8 w-8"><PencilIcon className="h-4 w-4" /></Button></Link>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setDeleteTarget(row.original); setDialogOpen(true); }}>
            <Trash2Icon className="h-4 w-4 text-rose-400" />
          </Button>
        </div>
      ),
    },
  ], []);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-8 pb-8">
      <WorkspaceHero
        badge="Taxonomy Intelligence"
        title="Category Operations Center"
        description="Structured classification groups powering asset discovery, reporting, and lifecycle governance."
        actions={
          <Link href="/dashboard/categories/new">
            <Button className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600"><PlusIcon className="mr-2 h-4 w-4" />Add Category</Button>
          </Link>
        }
      />

      <WorkspaceKpiGrid kpis={kpis} loading={metricsLoading} columns={4} />

      <WorkspaceSection title="Taxonomy Analytics" subtitle="Classification growth and distribution">
        <WorkspaceAnalyticsGrid>
          <WorkspaceDonutChart title="Category Index" data={allCategories.length ? allCategories.slice(0, 8).map((c) => ({ name: c.name, value: 1 })) : [{ name: 'None', value: 1 }]} />
          <WorkspaceAreaChart title="Creation Trend" data={trendData} />
          <WorkspaceProgressList title="Recent Groups" items={topCategories.length ? topCategories : [{ label: 'No data', value: 0, max: 1 }]} />
        </WorkspaceAnalyticsGrid>
      </WorkspaceSection>

      {error && <ErrorAlert message={error} />}

      <WorkspaceSection title="Category Registry" subtitle={`${total} classification groups`}>
        <WorkspaceDataPanel
          toolbar={<SearchInput placeholder="Search categories…" onSearch={handleSearch} />}
          footer={!loading && categories.length > 0 ? <PaginationControls currentPage={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} /> : undefined}
        >
          {loading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            : categories.length === 0 ? <EmptyState title="No categories found" description={search ? `No categories match "${search}".` : 'Get started by adding your first category.'} action={!search ? <Link href="/dashboard/categories/new"><Button>Add Category</Button></Link> : undefined} />
            : <EnterpriseTable columns={columns} data={categories} />}
        </WorkspaceDataPanel>
      </WorkspaceSection>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl border-white/10 bg-[#0a0a0f]">
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
