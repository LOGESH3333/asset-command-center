'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
} from 'recharts';
import { cn } from '@/lib/utils';

/** Stripe / Linear inspired chart palette */
const C = {
  violet: '#7c3aed',
  indigo: '#4f46e5',
  blue: '#3b82f6',
  emerald: '#059669',
  amber: '#d97706',
  rose: '#e11d48',
  cyan: '#0891b2',
  slate: '#71717a',
};

/** WCAG AA axis/label fills on ops dark surfaces (~oklch 0.07 bg) */
const CHART_TEXT = {
  axis: '#a1a1aa',
  label: '#c4b5fd',
};

const PIE_COLORS = [C.violet, C.indigo, C.emerald, C.amber, C.cyan, C.rose];
const CHART_HEIGHT = 256;
const GRID_STROKE = 'rgba(255,255,255,0.055)';

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[rgba(139,92,246,0.25)] bg-[rgba(11,11,18,0.98)] px-4 py-3 shadow-2xl shadow-violet-500/25 backdrop-blur-xl ring-1 ring-[rgba(139,92,246,0.1)]">
      <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wider ops-text-muted">{label}</p>
      <div className="space-y-1.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-sm font-medium ops-text-primary">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="ops-text-secondary">{p.name}</span>
            <span className="ml-auto tabular-nums text-white">
              {typeof p.value === 'number' && p.name?.toLowerCase().includes('cost')
                ? `$${p.value.toLocaleString()}`
                : p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartShell({
  title,
  subtitle,
  children,
  loading,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  loading?: boolean;
  className?: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'ops-glass-card ops-chart-card ops-card-hover bm-card-hover h-full overflow-hidden rounded-2xl border border-[rgba(139,92,246,0.15)]',
        hovered && 'border-violet-500/28',
        className
      )}
    >
      <div className="relative border-b border-[rgba(139,92,246,0.12)] bg-gradient-to-r from-violet-950/50 via-[#0b0b12]/60 to-transparent px-5 py-4">
        <h3 className="text-sm font-semibold tracking-tight ops-text-primary">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs ops-text-muted">{subtitle}</p>}
      </div>
      <div className="ops-chart-body p-4 pt-3">
        {loading ? (
          <div className="flex h-full min-h-[16rem] items-center justify-center">
            <div className="ops-skeleton h-32 w-full rounded-xl" />
          </div>
        ) : (
          children
        )}
      </div>
    </motion.div>
  );
}

const axisProps = {
  tick: { fontSize: 11, fill: CHART_TEXT.axis, fontFamily: 'inherit' },
  axisLine: false,
  tickLine: false,
};

const legendStyle = { fontSize: 11, color: CHART_TEXT.label, paddingTop: 8 };

export function AssetHealthTrendChart({
  data,
  loading,
}: {
  data: { month: string; score: number }[];
  loading?: boolean;
}) {
  return (
    <ChartShell title="Asset Health Trend" subtitle="Composite portfolio health index" loading={loading}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="healthTrendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.violet} stopOpacity={0.35} />
              <stop offset="95%" stopColor={C.violet} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="month" {...axisProps} dy={6} />
          <YAxis domain={[0, 100]} {...axisProps} width={32} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: C.violet, strokeWidth: 1, strokeDasharray: '4 4' }} />
          <Legend wrapperStyle={legendStyle} />
          <Area
            type="monotone"
            dataKey="score"
            name="Health Score"
            stroke={C.violet}
            fill="url(#healthTrendGrad)"
            strokeWidth={2}
            animationDuration={1000}
            dot={false}
            activeDot={{ r: 5, fill: C.violet, stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function MaintenanceCostTrendChart({
  data,
  loading,
}: {
  data: { month: string; cost: number }[];
  loading?: boolean;
}) {
  return (
    <ChartShell title="Maintenance Cost Trend" subtitle="Monthly spend across work orders" loading={loading}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={data} margin={{ top: 16, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="maintCostGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.cyan} stopOpacity={0.9} />
              <stop offset="100%" stopColor={C.indigo} stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="month" {...axisProps} dy={6} />
          <YAxis {...axisProps} width={36} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(139,92,246,0.06)' }} />
          <Legend wrapperStyle={legendStyle} />
          <Bar dataKey="cost" name="Cost" fill="url(#maintCostGrad)" radius={[5, 5, 0, 0]} maxBarSize={40} animationDuration={900}>
            <LabelList dataKey="cost" position="top" fill={CHART_TEXT.axis} fontSize={10} formatter={(v) => (typeof v === 'number' && v > 0 ? `$${v}` : '')} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function AssetDistributionChart({
  data,
  loading,
}: {
  data: { name: string; value: number }[];
  loading?: boolean;
}) {
  return (
    <ChartShell title="Asset Distribution" subtitle="Portfolio by category" loading={loading}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="46%"
            innerRadius={58}
            outerRadius={86}
            paddingAngle={2}
            animationDuration={900}
            stroke="rgba(0,0,0,0.3)"
            strokeWidth={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={legendStyle} layout="horizontal" verticalAlign="bottom" />
        </PieChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function VendorPerformanceChart({
  data,
  loading,
}: {
  data: { vendor: string; assets: number }[];
  loading?: boolean;
}) {
  return (
    <ChartShell title="Vendor Performance" subtitle="Asset volume by supplier" loading={loading}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 0 }}>
          <defs>
            {data.map((_, i) => (
              <linearGradient key={i} id={`vendorGrad${i}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={C.cyan} stopOpacity={0.85} />
                <stop offset="100%" stopColor={C.indigo} stopOpacity={0.85} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} horizontal={false} />
          <XAxis type="number" {...axisProps} />
          <YAxis type="category" dataKey="vendor" width={96} tick={{ fontSize: 10, fill: CHART_TEXT.axis }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(6,182,212,0.06)' }} />
          <Legend wrapperStyle={legendStyle} />
          <Bar dataKey="assets" name="Assets" radius={[0, 5, 5, 0]} maxBarSize={22} animationDuration={900}>
            {data.map((_, i) => (
              <Cell key={i} fill={`url(#vendorGrad${i})`} />
            ))}
            <LabelList dataKey="assets" position="right" fill={CHART_TEXT.axis} fontSize={10} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function AllocationTrendChart({
  data,
  loading,
}: {
  data: { month: string; allocated: number; available: number }[];
  loading?: boolean;
}) {
  return (
    <ChartShell title="Allocation Trend" subtitle="Allocated vs available capacity" loading={loading}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="month" {...axisProps} dy={6} />
          <YAxis {...axisProps} width={32} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: GRID_STROKE }} />
          <Legend wrapperStyle={legendStyle} />
          <Line type="monotone" dataKey="allocated" name="Allocated" stroke={C.blue} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} animationDuration={1000} />
          <Line type="monotone" dataKey="available" name="Available" stroke={C.emerald} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} animationDuration={1000} />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function RequestStatusChart({
  data,
  loading,
}: {
  data: { status: string; count: number }[];
  loading?: boolean;
}) {
  const statusColors: Record<string, string> = {
    'Pending Manager': C.amber,
    'Pending Procurement': C.amber,
    'Pending Finance': C.indigo,
    Approved: C.emerald,
    Purchasing: C.violet,
    Received: C.cyan,
    Rejected: C.rose,
    Draft: C.slate,
  };

  return (
    <ChartShell title="Request Status Overview" subtitle="Workflow pipeline distribution" loading={loading}>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={data} margin={{ top: 16, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} vertical={false} />
          <XAxis dataKey="status" tick={{ fontSize: 10, fill: CHART_TEXT.axis }} axisLine={false} tickLine={false} dy={6} />
          <YAxis {...axisProps} width={32} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(139,92,246,0.06)' }} />
          <Legend wrapperStyle={legendStyle} />
          <Bar dataKey="count" name="Requests" radius={[5, 5, 0, 0]} maxBarSize={48} animationDuration={900}>
            {data.map((entry) => (
              <Cell key={entry.status} fill={statusColors[entry.status] ?? C.violet} />
            ))}
            <LabelList dataKey="count" position="top" fill={CHART_TEXT.axis} fontSize={10} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
