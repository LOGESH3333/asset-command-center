'use client';

import { motion } from 'framer-motion';
import { GitBranch, Layers, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PipelineCounts = {
  requested: number;
  approved: number;
  procurement: number;
  purchased: number;
  allocated: number;
};

export type LifecycleCounts = {
  available: number;
  allocated: number;
  maintenance: number;
  retired: number;
};

type OperationsOverviewProps = {
  lifecycle: LifecycleCounts;
  pipeline: PipelineCounts;
  pendingApprovals: number;
  openProcurements: number;
};

const pipelineStages = [
  { key: 'requested' as const, label: 'Requested', color: 'from-amber-500 to-orange-500' },
  { key: 'approved' as const, label: 'Approved', color: 'from-emerald-500 to-teal-500' },
  { key: 'procurement' as const, label: 'Procurement', color: 'from-violet-500 to-indigo-500' },
  { key: 'purchased' as const, label: 'Purchased', color: 'from-blue-500 to-cyan-500' },
  { key: 'allocated' as const, label: 'Allocated', color: 'from-indigo-500 to-purple-500' },
];

function PanelShell({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="ops-glass-card ops-card-hover bm-card-hover flex h-full min-h-[17.5rem] flex-col rounded-2xl border border-[rgba(139,92,246,0.15)] p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 shadow-sm shadow-violet-500/10">
          <Icon className="h-4 w-4 text-violet-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold tracking-tight ops-text-primary">{title}</h3>
          <p className="text-xs ops-text-muted">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function OperationsOverview({
  lifecycle,
  pipeline,
  pendingApprovals,
  openProcurements,
}: OperationsOverviewProps) {
  const lifecycleTotal =
    lifecycle.available + lifecycle.allocated + lifecycle.maintenance + lifecycle.retired || 1;
  const pipelineMax = Math.max(...pipelineStages.map((s) => pipeline[s.key]), 1);

  const lifecycleItems = [
    { label: 'Available', count: lifecycle.available, color: 'bg-emerald-500' },
    { label: 'Allocated', count: lifecycle.allocated, color: 'bg-blue-500' },
    { label: 'Maintenance', count: lifecycle.maintenance, color: 'bg-amber-500' },
    { label: 'Retired', count: lifecycle.retired, color: 'bg-zinc-500' },
  ];

  return (
    <div className="grid auto-rows-fr gap-4 lg:grid-cols-3">
      <PanelShell title="Asset Lifecycle Overview" subtitle="Current operational state" icon={Layers}>
        <div className="space-y-3">
          {lifecycleItems.map((item, i) => (
            <div key={item.label}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="ops-text-secondary">{item.label}</span>
                <span className="font-semibold text-white">{item.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(item.count / lifecycleTotal) * 100}%` }}
                  transition={{ duration: 0.8, delay: i * 0.08 }}
                  className={cn('h-full rounded-full', item.color)}
                />
              </div>
            </div>
          ))}
        </div>
      </PanelShell>

      <PanelShell title="Request Approval Pipeline" subtitle="Workflow stage volume" icon={GitBranch}>
        <div className="flex flex-1 flex-col justify-center gap-2">
          <div className="mb-2 flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
            <span className="text-xs font-medium text-amber-200">Pending Approvals</span>
            <span className="text-lg font-bold text-white">{pendingApprovals}</span>
          </div>
          <div className="flex items-center justify-between gap-1 py-4">
            {pipelineStages.map((stage, i) => (
              <div key={stage.key} className="relative flex flex-1 flex-col items-center">
                {i > 0 && (
                  <div className="absolute -left-1/2 top-5 hidden h-px w-full bg-gradient-to-r from-violet-500/30 to-indigo-500/30 lg:block" />
                )}
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 + i * 0.07 }}
                  className={cn(
                    'relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white shadow-lg ring-2 ring-black/40',
                    stage.color
                  )}
                >
                  {pipeline[stage.key]}
                </motion.div>
                <p className="mt-2 text-center text-[9px] font-medium uppercase tracking-wide ops-text-muted">
                  {stage.label}
                </p>
              </div>
            ))}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(pipeline.approved / pipelineMax) * 100}%` }}
              transition={{ duration: 1 }}
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-violet-500 to-indigo-500"
            />
          </div>
        </div>
      </PanelShell>

      <PanelShell title="Procurement Pipeline" subtitle="Sourcing to delivery flow" icon={ShoppingCart}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider ops-text-muted">Open Cases</p>
              <p className="mt-1 text-2xl font-bold text-white">{openProcurements}</p>
            </div>
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider ops-text-muted">Purchased</p>
              <p className="mt-1 text-2xl font-bold text-white">{pipeline.purchased}</p>
            </div>
          </div>
          {pipelineStages.slice(2).map((stage, i) => (
            <div key={stage.key}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="ops-text-secondary">{stage.label}</span>
                <span className="font-semibold text-white">{pipeline[stage.key]}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(pipeline[stage.key] / pipelineMax) * 100}%` }}
                  transition={{ duration: 0.7, delay: 0.2 + i * 0.1 }}
                  className={cn('h-full rounded-full bg-gradient-to-r', stage.color)}
                />
              </div>
            </div>
          ))}
        </div>
      </PanelShell>
    </div>
  );
}
