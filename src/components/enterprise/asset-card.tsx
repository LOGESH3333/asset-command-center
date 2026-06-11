'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Eye, Pencil, Package, QrCode } from 'lucide-react';
import { RegistryDeleteButton } from '@/components/common/registry-delete-button';
import type { Asset } from '@/lib/supabase/assets';
import { StatusBadge } from '@/components/enterprise/status-badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type AssetCardProps = {
  asset: Asset;
  index?: number;
  onDelete?: (asset: Asset) => void;
  onQr?: (asset: Asset) => void;
};

export function AssetCard({ asset, index = 0, onDelete, onQr }: AssetCardProps) {
  const costLabel =
    asset.cost != null
      ? `$${Number(asset.cost).toLocaleString(undefined, { minimumFractionDigits: 0 })}`
      : '—';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      className="bm-card bm-card-hover card-shine group relative overflow-hidden rounded-2xl p-5"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-violet-600/20 blur-3xl transition-opacity group-hover:opacity-100" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-600/5 via-transparent to-indigo-600/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[rgba(139,92,246,0.2)] bg-[rgba(139,92,246,0.1)] shadow-[0_0_16px_-4px_rgba(139,92,246,0.3)]">
            <Package className="h-5 w-5 text-[#c4b5fd]" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#c4b5fd]">{asset.asset_tag}</p>
            <h3 className="mt-1 truncate text-base font-semibold text-white">{asset.name}</h3>
          </div>
        </div>
        <StatusBadge status={asset.status} className="shrink-0 font-semibold" />
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-4 rounded-xl border border-[rgba(139,92,246,0.1)] bg-[rgba(7,7,16,0.6)] p-3.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#c4b5fd]">Cost</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-white">{costLabel}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#c4b5fd]">Purchased</p>
          <p className="mt-1 text-sm font-semibold text-[#f5f5f7]">
            {asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : '—'}
          </p>
        </div>
      </div>

      <div className={cn('relative mt-5 flex items-center gap-1 border-t border-[rgba(139,92,246,0.12)] pt-4')}>
        <Link href={`/dashboard/assets/${asset.asset_tag}`} className="flex-1">
          <Button variant="ghost" size="sm" className="h-9 w-full rounded-lg text-[#a1a1aa] hover:bg-[rgba(139,92,246,0.1)] hover:text-white">
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            View
          </Button>
        </Link>
        <Link href={`/dashboard/assets/${asset.asset_tag}/edit`}>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-[#a1a1aa] hover:bg-[rgba(139,92,246,0.1)] hover:text-white">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </Link>
        {onQr && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg text-[#a1a1aa] hover:bg-[rgba(139,92,246,0.1)] hover:text-[#c4b5fd]"
            onClick={() => onQr(asset)}
          >
            <QrCode className="h-3.5 w-3.5" />
          </Button>
        )}
        {onDelete && (
          <RegistryDeleteButton onClick={() => onDelete(asset)} />
        )}
      </div>
    </motion.div>
  );
}
