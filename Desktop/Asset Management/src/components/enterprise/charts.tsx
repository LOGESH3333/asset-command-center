"use client";

import { useState } from "react";
import { motion } from "framer-motion";
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
} from "recharts";
import { GlassPanel } from "./glass-panel";
import { cn } from "@/lib/utils";

const CHART_COLORS = {
  violet: "#8b5cf6",
  indigo: "#6366f1",
  blue: "#3b82f6",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  cyan: "#06b6d4",
};

const PIE_COLORS = ["#8b5cf6", "#6366f1", "#10b981", "#f59e0b", "#06b6d4", "#f43f5e"];

function PremiumTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-violet-500/20 bg-[#0c0c14]/95 px-4 py-3 shadow-2xl shadow-violet-500/20 backdrop-blur-xl">
      <p className="mb-2 text-xs font-medium text-zinc-400">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-semibold text-white">
          <span style={{ color: p.color }}>{p.name}: </span>
          {typeof p.value === "number" && p.name?.toLowerCase().includes("cost")
            ? `$${p.value.toLocaleString()}`
            : p.value}
        </p>
      ))}
    </div>
  );
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  loading?: boolean;
}

export function ChartCard({ title, subtitle, children, className, loading }: ChartCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      <GlassPanel
        className={cn(
          "card-shine overflow-hidden transition-all duration-200",
          hovered && "border-violet-500/25 shadow-xl shadow-violet-500/15",
          className
        )}
      >
        <div className="relative border-b border-white/[0.06] bg-gradient-to-r from-violet-950/40 via-indigo-950/20 to-transparent px-5 py-4">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
          <h3 className="text-sm font-semibold tracking-tight text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
        </div>
        <div className="p-4">
          {loading ? (
            <div className="flex h-[260px] items-center justify-center">
              <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="h-32 w-full max-w-xs rounded-xl bg-gradient-to-r from-violet-600/10 via-indigo-600/20 to-violet-600/10"
              />
            </div>
          ) : (
            children
          )}
        </div>
      </GlassPanel>
    </motion.div>
  );
}

export function AssetGrowthTrendChart({
  data,
  loading,
}: {
  data: { month: string; total: number }[];
  loading?: boolean;
}) {
  return (
    <ChartCard title="Asset Growth Trend" subtitle="Cumulative portfolio expansion" loading={loading}>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.violet} stopOpacity={0.5} />
              <stop offset="100%" stopColor={CHART_COLORS.violet} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
          <Tooltip content={<PremiumTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
          <Area
            type="monotone"
            dataKey="total"
            name="Total Assets"
            stroke={CHART_COLORS.violet}
            fill="url(#growthGrad)"
            strokeWidth={2.5}
            dot={{ fill: CHART_COLORS.violet, r: 3, strokeWidth: 0 }}
            activeDot={{ r: 6, fill: CHART_COLORS.violet, stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
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
    <ChartCard title="Asset Allocation Analytics" subtitle="Allocated vs available capacity" loading={loading}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <defs>
            <linearGradient id="allocLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={CHART_COLORS.violet} />
              <stop offset="100%" stopColor={CHART_COLORS.indigo} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
          <Tooltip content={<PremiumTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
          <Line
            type="monotone"
            dataKey="allocated"
            name="Allocated"
            stroke={CHART_COLORS.violet}
            strokeWidth={2.5}
            dot={{ r: 3, fill: CHART_COLORS.violet }}
            activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="available"
            name="Available"
            stroke={CHART_COLORS.emerald}
            strokeWidth={2.5}
            dot={{ r: 3, fill: CHART_COLORS.emerald }}
            activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function MaintenanceCostChart({
  data,
  loading,
}: {
  data: { month: string; cost: number }[];
  loading?: boolean;
}) {
  return (
    <ChartCard title="Maintenance Cost Trend" subtitle="Spend trajectory by period" loading={loading}>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.amber} stopOpacity={0.45} />
              <stop offset="100%" stopColor={CHART_COLORS.amber} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
          <Tooltip content={<PremiumTooltip />} />
          <Area
            type="monotone"
            dataKey="cost"
            name="Cost"
            stroke={CHART_COLORS.amber}
            fill="url(#costGrad)"
            strokeWidth={2}
            activeDot={{ r: 6, fill: CHART_COLORS.amber, stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function CategoryDistributionChart({
  data,
  loading,
}: {
  data: { name: string; value: number }[];
  loading?: boolean;
}) {
  return (
    <ChartCard title="Category Distribution" subtitle="Portfolio composition by category" loading={loading}>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data.length ? data : [{ name: "No data", value: 1 }]}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={4}
            dataKey="value"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={2}
          >
            {(data.length ? data : [{ name: "No data", value: 1 }]).map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<PremiumTooltip />} />
          <Legend wrapperStyle={{ fontSize: 10, color: "#a1a1aa" }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function LifecycleChart({
  data,
  loading,
}: {
  data: { stage: string; count: number }[];
  loading?: boolean;
}) {
  return (
    <ChartCard title="Asset Lifecycle Status" subtitle="Operational state distribution" loading={loading}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data}>
          <defs>
            <linearGradient id="lifeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.indigo} />
              <stop offset="100%" stopColor={CHART_COLORS.violet} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="stage" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
          <Tooltip content={<PremiumTooltip />} />
          <Bar dataKey="count" name="Assets" fill="url(#lifeGrad)" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
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
    <ChartCard title="Vendor Performance" subtitle="Asset volume by supplier" loading={loading}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="vendor"
            tick={{ fontSize: 10, fill: "#71717a" }}
            width={110}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<PremiumTooltip />} />
          <Bar dataKey="assets" name="Assets" fill={CHART_COLORS.cyan} radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function HealthScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  return (
    <motion.div className="h-full">
      <GlassPanel className="card-shine flex h-full min-h-[280px] flex-col items-center justify-center border border-white/[0.06] p-6 transition-all duration-200 hover:border-violet-500/25 hover:shadow-xl hover:shadow-violet-500/15">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400">
          Asset Health Score
        </p>
        <p className="mb-4 text-[10px] font-medium text-zinc-500">
          {score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs Attention'}
        </p>
        <div className="relative">
          <svg width="150" height="150" className="-rotate-90 drop-shadow-[0_0_20px_rgba(139,92,246,0.4)]">
            <circle cx="75" cy="75" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
            <motion.circle
              cx="75"
              cy="75"
              r="54"
              fill="none"
              stroke="url(#healthGrad)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            />
            <defs>
              <linearGradient id="healthGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-white">{score}</span>
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">/ 100</span>
          </div>
        </div>
        <p className="mt-4 max-w-[200px] text-center text-xs text-zinc-500">
          Composite index across availability, warranty & maintenance
        </p>
      </GlassPanel>
    </motion.div>
  );
}

export function MonthlyRequestsChart({
  data,
  loading,
}: {
  data: { month: string; requests: number }[];
  loading?: boolean;
}) {
  return (
    <ChartCard title="Request Volume" subtitle="Monthly asset requests" loading={loading}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
          <Tooltip content={<PremiumTooltip />} />
          <Line
            type="monotone"
            dataKey="requests"
            name="Requests"
            stroke={CHART_COLORS.rose}
            strokeWidth={2.5}
            dot={{ fill: CHART_COLORS.rose, r: 4 }}
            activeDot={{ r: 7, stroke: "#fff", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
