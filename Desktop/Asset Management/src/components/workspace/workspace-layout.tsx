'use client';

import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { PremiumKpiCard, type PremiumKpiCardProps } from '@/components/dashboard/premium-kpi-card';
import { Skeleton } from '@/components/common/Skeleton';
import { cn } from '@/lib/utils';

export type ModuleKpi = {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  trend?: number;
  trendLabel?: string;
  sparklineData?: number[];
  icon: LucideIcon;
  accent?: PremiumKpiCardProps['accent'];
};

export function WorkspaceHero({
  badge,
  title,
  description,
  actions,
}: {
  badge: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-5 border-b border-white/[0.06] pb-8 lg:flex-row lg:items-end lg:justify-between"
    >
      <div className="space-y-3">
        <span className="inline-flex items-center rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300">
          {badge}
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
        <p className="max-w-2xl text-base leading-relaxed text-zinc-400">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}

export function WorkspaceKpiGrid({
  kpis,
  loading,
  columns = 4,
}: {
  kpis: ModuleKpi[];
  loading?: boolean;
  columns?: 4 | 5 | 6;
}) {
  const gridClass =
    columns === 6
      ? 'sm:grid-cols-2 xl:grid-cols-6'
      : columns === 5
        ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
        : 'sm:grid-cols-2 lg:grid-cols-4';

  if (loading) {
    return (
      <div className={cn('grid gap-4', gridClass)}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-[7.5rem] rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid gap-4', gridClass)}>
      {kpis.map((kpi, i) => (
        <PremiumKpiCard key={kpi.title} {...kpi} accent={kpi.accent ?? 'violet'} delay={i * 0.04} />
      ))}
    </div>
  );
}

export function WorkspaceSection({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-4', className)}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export function WorkspaceAnalyticsGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-3">{children}</div>;
}

export function WorkspaceDataPanel({
  toolbar,
  children,
  footer,
}: {
  toolbar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[rgba(139,92,246,0.15)] bg-[rgba(7,7,16,0.55)] shadow-xl shadow-black/20 backdrop-blur-xl">
      {toolbar && (
        <div className="border-b border-white/[0.06] bg-white/[0.02] px-5 py-4">{toolbar}</div>
      )}
      <div className="p-5">{children}</div>
      {footer && (
        <div className="border-t border-white/[0.06] bg-white/[0.02] px-5 py-4">{footer}</div>
      )}
    </div>
  );
}
