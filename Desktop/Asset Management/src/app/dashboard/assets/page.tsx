'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { getAssets, type Asset } from '@/lib/supabase/assets';
import { deleteAssetAction } from '@/app/actions/crud';
import { SearchInput } from '@/components/common/SearchInput';
import { PaginationControls } from '@/components/common/PaginationControls';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorAlert } from '@/components/common/ErrorAlert';
import { PageHeader } from '@/components/enterprise/page-header';
import { EnterpriseTable } from '@/components/enterprise/enterprise-table';
import { StatusBadge } from '@/components/enterprise/status-badge';
import { GlassPanel } from '@/components/enterprise/glass-panel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { PlusIcon, EyeIcon, PencilIcon, Trash2Icon, Loader2Icon, LayoutGrid, Table2, QrCode } from 'lucide-react';
import { Skeleton } from '@/components/common/Skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AssetCard } from '@/components/enterprise/asset-card';
import { AssetQrCodePanel } from '@/components/enterprise/asset-qr-code-panel';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 10;

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Asset['status'] | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
  const [qrTarget, setQrTarget] = useState<Asset | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusParam = statusFilter === 'ALL' ? undefined : statusFilter;
      const result = await getAssets({ search, status: statusParam, page, pageSize: PAGE_SIZE });
      if (result.error) {
        setError(result.error?.message ?? 'Error fetching assets');
      } else {
        setAssets(result.data);
        setTotal(result.total);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleSearch = useCallback((term: string) => {
    setSearch(term);
    setPage(1);
  }, []);

  const handleStatusChange = (val: string | null) => {
    if (val) setStatusFilter(val as Asset['status'] | 'ALL');
    else setStatusFilter('ALL');
    setPage(1);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteAssetAction(deleteTarget.asset_tag);
      if (result.error) setError(result.error);
      else {
        setDialogOpen(false);
        setDeleteTarget(null);
        fetchAssets();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete asset');
    } finally {
      setDeleting(false);
    }
  };

  const columns = useMemo<ColumnDef<Asset>[]>(
    () => [
      {
        accessorKey: 'asset_tag',
        header: 'Tag',
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold text-primary">{row.original.asset_tag}</span>
        ),
      },
      { accessorKey: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'purchase_date',
        header: 'Purchase Date',
        cell: ({ row }) =>
          row.original.purchase_date
            ? new Date(row.original.purchase_date).toLocaleDateString()
            : '—',
      },
      {
        accessorKey: 'cost',
        header: 'Cost',
        cell: ({ row }) =>
          row.original.cost != null
            ? `$${Number(row.original.cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
            : '—',
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1 opacity-70 transition-opacity group-hover:opacity-100">
            <Link href={`/dashboard/assets/${row.original.asset_tag}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                <EyeIcon className="h-4 w-4" />
              </Button>
            </Link>
            <Link href={`/dashboard/assets/${row.original.asset_tag}/edit`}>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                <PencilIcon className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => {
                setDeleteTarget(row.original);
                setDialogOpen(true);
              }}
            >
              <Trash2Icon className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        badge="Inventory"
        title="Asset Registry"
        description="Track, allocate, and manage your entire corporate asset portfolio."
        actions={
          <Link href="/dashboard/assets/new">
            <Button className="rounded-xl bg-gradient-to-r from-primary to-indigo-600 shadow-lg shadow-primary/20">
              <PlusIcon className="mr-2 h-4 w-4" />
              Add Asset
            </Button>
          </Link>
        }
      />

      <GlassPanel className="p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <SearchInput placeholder="Search by tag or name..." onSearch={handleSearch} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn('rounded-lg', viewMode === 'cards' && 'bg-violet-600/20 text-violet-300')}
                onClick={() => setViewMode('cards')}
              >
                <LayoutGrid className="mr-1.5 h-4 w-4" />
                Cards
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn('rounded-lg', viewMode === 'table' && 'bg-violet-600/20 text-violet-300')}
                onClick={() => setViewMode('table')}
              >
                <Table2 className="mr-1.5 h-4 w-4" />
                Table
              </Button>
            </div>
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-full rounded-xl border-0 bg-muted/40 md:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="Available">Available</SelectItem>
                <SelectItem value="Allocated">Allocated</SelectItem>
                <SelectItem value="Under Maintenance">Under Maintenance</SelectItem>
                <SelectItem value="Retired">Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </GlassPanel>

      {error && <ErrorAlert message={error} />}

      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      )}

      {!loading && !error && assets.length === 0 && (
        <EmptyState
          title="No assets found"
          description={search || statusFilter !== 'ALL' ? 'No assets match your filters.' : 'Start building your asset inventory.'}
          action={
            !search && statusFilter === 'ALL' && (
              <Link href="/dashboard/assets/new">
                <Button className="rounded-xl">
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Add Asset
                </Button>
              </Link>
            )
          }
        />
      )}

      {!loading && assets.length > 0 && (
        <>
          {viewMode === 'cards' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {assets.map((asset, i) => (
                <AssetCard
                  key={asset.asset_tag}
                  asset={asset}
                  index={i}
                  onDelete={(a) => {
                    setDeleteTarget(a);
                    setDialogOpen(true);
                  }}
                  onQr={(a) => {
                    setQrTarget(a);
                    setQrOpen(true);
                  }}
                />
              ))}
            </div>
          ) : (
            <EnterpriseTable columns={columns} data={assets} />
          )}
          <PaginationControls
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-lg rounded-2xl border-white/10 bg-[#0a0a0f]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <QrCode className="h-5 w-5 text-violet-400" />
              Asset QR Code
            </DialogTitle>
            <DialogDescription>
              {qrTarget?.asset_tag} — {qrTarget?.name}
            </DialogDescription>
          </DialogHeader>
          {qrTarget?.id && (
            <AssetQrCodePanel
              variant="embedded"
              asset={{
                id: qrTarget.id,
                name: qrTarget.name,
                asset_tag: qrTarget.asset_tag,
                serial_number: qrTarget.serial_number,
                qr_payload: qrTarget.qr_payload,
                qr_generated_at: qrTarget.qr_generated_at,
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Delete Asset</DialogTitle>
            <DialogDescription>
              Delete <strong>{deleteTarget?.name}</strong> ({deleteTarget?.asset_tag})? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={deleting} className="rounded-xl">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="rounded-xl">
              {deleting && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
