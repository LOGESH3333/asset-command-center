'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Package, ShoppingBag, Truck, TrendingUp } from 'lucide-react';

export type ProcurementSnapshotData = {
  openProcurements: number;
  purchaseOrders: number;
  expectedDeliveries: number;
  topVendor: string;
  topVendorAssets: number;
};

export function ProcurementSnapshot({ data }: { data: ProcurementSnapshotData }) {
  const items = [
    {
      label: 'Open Procurements',
      value: data.openProcurements,
      icon: ShoppingBag,
      href: '/dashboard/procurement',
      color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    },
    {
      label: 'Purchase Orders',
      value: data.purchaseOrders,
      icon: Package,
      href: '/dashboard/purchase-orders',
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    },
    {
      label: 'Expected Deliveries',
      value: data.expectedDeliveries,
      icon: Truck,
      href: '/dashboard/purchase-orders',
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
  ];

  return (
    <div className="ops-glass-card ops-card-hover bm-card-hover rounded-2xl border border-[rgba(139,92,246,0.15)] p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10">
          <ShoppingBag className="h-4 w-4 text-cyan-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold tracking-tight ops-text-primary">Procurement Snapshot</h3>
          <p className="text-xs ops-text-muted">Sourcing pipeline at a glance</p>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className="block cursor-pointer">
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition-all duration-200 hover:border-cyan-500/25 hover:bg-white/[0.04]"
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${item.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="flex-1 text-xs ops-text-secondary">{item.label}</span>
                <span className="text-lg font-bold text-white">{item.value}</span>
              </motion.div>
            </Link>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-white/[0.06] bg-gradient-to-r from-violet-950/40 to-indigo-950/20 p-3">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider ops-text-muted">
          <TrendingUp className="h-3.5 w-3.5 text-violet-400" />
          Top Vendor Performance
        </div>
        <p className="mt-1 truncate text-sm font-semibold text-white">{data.topVendor}</p>
        <p className="text-xs ops-text-muted">{data.topVendorAssets} assets supplied</p>
      </div>
    </div>
  );
}
