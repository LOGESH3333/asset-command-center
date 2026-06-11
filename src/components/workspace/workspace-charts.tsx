'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';

const PIE_COLORS = ['#7c3aed', '#4f46e5', '#059669', '#d97706', '#0891b2', '#e11d48', '#a78bfa'];

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-violet-500/25 bg-[rgba(11,11,18,0.98)] px-3 py-2 shadow-xl backdrop-blur-xl">
      {label && <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-medium text-white">
          {p.name}: <span className="text-violet-300">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'erp-dark-glass ops-glass-card h-full overflow-hidden rounded-2xl p-5 transition-shadow',
        hovered && 'border-violet-500/35 shadow-lg shadow-violet-500/15',
        className
      )}
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold tracking-tight text-white">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
      </div>
      {children}
    </motion.div>
  );
}

export function WorkspaceDonutChart({
  title,
  subtitle,
  data,
  height = 200,
}: {
  title: string;
  subtitle?: string;
  data: { name: string; value: number }[];
  height?: number;
}) {
  const chartData = data.length ? data : [{ name: 'No data', value: 1 }];
  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <ChartCard title={title} subtitle={subtitle}>
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={72}
              paddingAngle={3}
              dataKey="value"
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="w-full min-w-0 flex-1 space-y-2">
          {chartData.slice(0, 5).map((d, i) => (
            <div key={d.name} className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
              <span className="truncate text-zinc-400">{d.name}</span>
              <span className="ml-auto font-semibold tabular-nums text-white">{d.value}</span>
            </div>
          ))}
          <p className="pt-1 text-[10px] text-zinc-600">Total: {total}</p>
        </div>
      </div>
    </ChartCard>
  );
}

export function WorkspaceAreaChart({
  title,
  subtitle,
  data,
  height = 200,
}: {
  title: string;
  subtitle?: string;
  data: { name: string; value: number }[];
  height?: number;
}) {
  const chartData = data.length ? data : [{ name: '—', value: 0 }];

  return (
    <ChartCard title={title} subtitle={subtitle}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="wsAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#a1a1aa', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey="value" stroke="#a78bfa" strokeWidth={2} fill="url(#wsAreaGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function WorkspaceProgressList({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle?: string;
  items: { label: string; value: number; max: number; color?: string }[];
}) {
  const list = items.length ? items : [{ label: 'No activity', value: 0, max: 1 }];

  return (
    <ChartCard title={title} subtitle={subtitle}>
      <div className="space-y-4">
        {list.map((item) => {
          const pct = item.max > 0 ? Math.round((item.value / item.max) * 100) : 0;
          return (
            <div key={item.label}>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-300">{item.label}</span>
                <span className="tabular-nums text-zinc-500">
                  {item.value} <span className="text-violet-400">({pct}%)</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full"
                  style={{ background: item.color ?? 'linear-gradient(90deg, #7c3aed, #4f46e5)' }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}
