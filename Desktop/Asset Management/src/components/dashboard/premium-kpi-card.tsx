'use client';

import { motion } from 'framer-motion';
import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { AnimatedCounter } from '@/components/enterprise/animated-counter';
import { cn } from '@/lib/utils';

type Accent = 'violet' | 'emerald' | 'blue' | 'amber' | 'cyan' | 'rose';

const accents: Record<
  Accent,
  { grad: string; glow: string; border: string; spark: string; icon: string; kpiClass: string }
> = {
  violet: {
    grad: 'from-violet-600/18 via-violet-950/8 to-transparent',
    glow: 'group-hover:shadow-violet-500/20',
    border: 'group-hover:border-violet-500/35',
    spark: '#a78bfa',
    icon: 'from-violet-500 to-indigo-600 text-white shadow-violet-500/30',
    kpiClass: 'ops-kpi-violet',
  },
  emerald: {
    grad: 'from-emerald-600/18 via-emerald-950/8 to-transparent',
    glow: 'group-hover:shadow-emerald-500/20',
    border: 'group-hover:border-emerald-500/35',
    spark: '#34d399',
    icon: 'from-emerald-500 to-teal-600 text-white shadow-emerald-500/30',
    kpiClass: 'ops-kpi-emerald',
  },
  blue: {
    grad: 'from-blue-600/18 via-blue-950/8 to-transparent',
    glow: 'group-hover:shadow-blue-500/20',
    border: 'group-hover:border-blue-500/35',
    spark: '#60a5fa',
    icon: 'from-blue-500 to-indigo-600 text-white shadow-blue-500/30',
    kpiClass: 'ops-kpi-blue',
  },
  amber: {
    grad: 'from-amber-600/18 via-amber-950/8 to-transparent',
    glow: 'group-hover:shadow-amber-500/20',
    border: 'group-hover:border-amber-500/35',
    spark: '#fbbf24',
    icon: 'from-amber-500 to-orange-600 text-white shadow-amber-500/30',
    kpiClass: 'ops-kpi-amber',
  },
  cyan: {
    grad: 'from-cyan-600/18 via-cyan-950/8 to-transparent',
    glow: 'group-hover:shadow-cyan-500/20',
    border: 'group-hover:border-cyan-500/35',
    spark: '#22d3ee',
    icon: 'from-cyan-500 to-sky-600 text-white shadow-cyan-500/30',
    kpiClass: 'ops-kpi-cyan',
  },
  rose: {
    grad: 'from-rose-600/18 via-rose-950/8 to-transparent',
    glow: 'group-hover:shadow-rose-500/20',
    border: 'group-hover:border-rose-500/35',
    spark: '#fb7185',
    icon: 'from-rose-500 to-pink-600 text-white shadow-rose-500/30',
    kpiClass: 'ops-kpi-rose',
  },
};

function Sparkline({ data, color, id }: { data: number[]; color: string; id: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 88;
  const h = 32;
  const pts = data
    .map((v, i) => {
      const x = data.length === 1 ? w / 2 : (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 6) - 3;
      return `${x},${y}`;
    })
    .join(' ');
  const areaPts = `0,${h} ${pts} ${w},${h}`;

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="opacity-90">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon fill={`url(#${id})`} points={areaPts} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
}

export type PremiumKpiCardProps = {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  trend?: number;
  trendLabel?: string;
  sparklineData?: number[];
  icon: LucideIcon;
  accent?: Accent;
  delay?: number;
};

export function PremiumKpiCard({
  title,
  value,
  prefix,
  suffix,
  decimals,
  trend,
  trendLabel,
  sparklineData,
  icon: Icon,
  accent = 'violet',
  delay = 0,
}: PremiumKpiCardProps) {
  const colors = accents[accent];
  const isPositive = trend !== undefined && trend >= 0;
  const sparkId = `kpi-spark-${accent}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'ops-kpi-card card-shine group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[rgba(139,92,246,0.15)] p-4 backdrop-blur-xl',
        colors.kpiClass,
        colors.border,
        colors.glow
      )}
    >
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br', colors.grad)} />

      <div className="relative flex flex-1 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] ops-text-muted">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-white lg:text-[1.65rem]">
            <AnimatedCounter value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
          </p>
          {trend !== undefined && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                  isPositive ? 'bg-emerald-500/12 text-emerald-400 ring-1 ring-emerald-500/20' : 'bg-rose-500/12 text-rose-400 ring-1 ring-rose-500/20'
                )}
              >
                {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {isPositive ? '+' : ''}
                {trend}%
              </span>
              {trendLabel && <span className="text-[10px] ops-text-caption">{trendLabel}</span>}
            </div>
          )}
        </div>
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg ring-1 ring-white/10',
            colors.icon
          )}
        >
          <Icon className="h-[1.125rem] w-[1.125rem]" />
        </div>
      </div>

      {sparklineData && sparklineData.length > 0 && (
        <div className="relative mt-auto border-t border-white/[0.06] pt-2.5">
          <Sparkline data={sparklineData} color={colors.spark} id={sparkId} />
        </div>
      )}
    </motion.div>
  );
}
