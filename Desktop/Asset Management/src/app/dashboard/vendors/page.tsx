'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { getVendors, type Vendor, getVendorEmail, getVendorPhone } from '@/lib/supabase/vendors';
import { deleteVendorAction } from '@/app/actions/crud';
import { supabase } from '@/lib/supabase/client';
import { SearchInput } from '@/components/common/SearchInput';
import { PaginationControls } from '@/components/common/PaginationControls';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { Skeleton } from '@/components/common/Skeleton';
import { EnterpriseTable } from '@/components/enterprise/enterprise-table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PlusIcon, EyeIcon, PencilIcon, Trash2Icon, Loader2Icon, Building2, Mail, Phone, Users } from 'lucide-react';
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

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [allVendors, setAllVendors] = useState<Vendor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    supabase.from('vendors').select('id, name, email, phone, created_at').limit(500).then(({ data }) => {
      setAllVendors((data as Vendor[]) ?? []);
      setMetricsLoading(false);
    });
  }, []);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getVendors({ search, page, pageSize: PAGE_SIZE });
      if (result.error) setError(result.error.message);
      else { setVendors(result.data); setTotal(result.total); }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const handleSearch = useCallback((term: string) => { setSearch(term); setPage(1); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteVendorAction(deleteTarget.id);
      if (result.error) setError(result.error);
      else { setDialogOpen(false); setDeleteTarget(null); fetchVendors(); }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete vendor');
    } finally {
      setDeleting(false);
    }
  };

  const withEmail = allVendors.filter((v) => getVendorEmail(v)).length;
  const withPhone = allVendors.filter((v) => getVendorPhone(v)).length;
  const spark = sparklineFromDates(allVendors.map((v) => v.created_at));
  const trendData = groupByDay(allVendors, (v) => v.created_at);

  const kpis: ModuleKpi[] = [
    { title: 'Total Vendors', value: allVendors.length, icon: Building2, accent: 'violet', trend: trendFromSparkline(spark), sparklineData: spark },
    { title: 'With Email', value: withEmail, icon: Mail, accent: 'cyan', trend: percent(withEmail, allVendors.length || 1), trendLabel: 'contactable' },
    { title: 'With Phone', value: withPhone, icon: Phone, accent: 'emerald', trend: 4, trendLabel: 'reachable' },
    { title: 'Partner Index', value: percent(allVendors.length, Math.max(allVendors.length, 1)), suffix: '%', icon: Users, accent: 'amber', trend: 6, trendLabel: 'active' },
  ];

  const columns = useMemo<ColumnDef<Vendor>[]>(() => [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <Link href={`/dashboard/vendors/${row.original.id}`} className="font-medium hover:text-violet-300">{row.original.name}</Link>
      ),
    },
    { accessorKey: 'email', header: 'Email', cell: ({ row }) => <span className="text-zinc-400">{getVendorEmail(row.original) || '—'}</span> },
    { accessorKey: 'phone', header: 'Phone', cell: ({ row }) => <span className="text-zinc-400">{getVendorPhone(row.original) || '—'}</span> },
    { accessorKey: 'created_at', header: 'Created', cell: ({ row }) => <span className="text-zinc-400">{new Date(row.original.created_at).toLocaleDateString()}</span> },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Link href={`/dashboard/vendors/${row.original.id}`}><Button variant="ghost" size="icon" className="h-8 w-8"><EyeIcon className="h-4 w-4" /></Button></Link>
          <Link href={`/dashboard/vendors/${row.original.id}/edit`}><Button variant="ghost" size="icon" className="h-8 w-8"><PencilIcon className="h-4 w-4" /></Button></Link>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setDeleteTarget(row.original); setDialogOpen(true); }}>
            <Trash2Icon className="h-4 w-4 text-rose-400" />
          </Button>
        </div>
      ),
    },
  ], []);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const contactData = [
    { name: 'Email', value: withEmail },
    { name: 'Phone', value: withPhone },
    { name: 'Both', value: allVendors.filter((v) => getVendorEmail(v) && getVendorPhone(v)).length },
  ];

  return (
    <div className="space-y-8 pb-8">
      <WorkspaceHero
        badge="Supplier Intelligence"
        title="Vendor Operations Center"
        description="Procurement partner directory with contact coverage analytics and onboarding velocity."
        actions={
          <Link href="/dashboard/vendors/new">
            <Button className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600"><PlusIcon className="mr-2 h-4 w-4" />Add Vendor</Button>
          </Link>
        }
      />

      <WorkspaceKpiGrid kpis={kpis} loading={metricsLoading} columns={4} />

      <WorkspaceSection title="Supplier Analytics" subtitle="Partner network health and growth">
        <WorkspaceAnalyticsGrid>
          <WorkspaceDonutChart title="Contact Coverage" data={contactData} />
          <WorkspaceAreaChart title="Onboarding Trend" data={trendData} />
          <WorkspaceProgressList title="Top Partners" items={allVendors.slice(0, 6).map((v) => ({ label: v.name, value: 1, max: 1 }))} />
        </WorkspaceAnalyticsGrid>
      </WorkspaceSection>

      {error && <ErrorAlert message={error} />}

      <WorkspaceSection title="Vendor Directory" subtitle={`${total} registered suppliers`}>
        <WorkspaceDataPanel
          toolbar={<SearchInput placeholder="Search vendors…" onSearch={handleSearch} />}
          footer={!loading && vendors.length > 0 ? <PaginationControls currentPage={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} /> : undefined}
        >
          {loading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            : vendors.length === 0 ? <EmptyState title="No vendors found" description={search ? `No vendors match "${search}".` : 'Get started by adding your first vendor.'} action={!search ? <Link href="/dashboard/vendors/new"><Button>Add Vendor</Button></Link> : undefined} />
            : <EnterpriseTable columns={columns} data={vendors} />}
        </WorkspaceDataPanel>
      </WorkspaceSection>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl border-white/10 bg-[#0a0a0f]">
          <DialogHeader>
            <DialogTitle>Delete Vendor</DialogTitle>
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
