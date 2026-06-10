"use client";

import { motion } from "framer-motion";
import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "./animated-counter";

interface KpiCardProps {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  trend?: number;
  trendLabel?: string;
  sparklineData?: number[];
  icon: LucideIcon;
  accent?: "blue" | "green" | "amber" | "rose" | "violet" | "cyan";
  delay?: number;
}

const accentMap = {
  blue: {
    grad: "from-blue-500/25 to-indigo-600/10",
    icon: "from-blue-500/30 to-indigo-600/20 text-blue-400",
    spark: "#60a5fa",
    glow: "group-hover:shadow-blue-500/20",
  },
  green: {
    grad: "from-emerald-500/25 to-teal-600/10",
    icon: "from-emerald-500/30 to-teal-600/20 text-emerald-400",
    spark: "#34d399",
    glow: "group-hover:shadow-emerald-500/20",
  },
  amber: {
    grad: "from-amber-500/25 to-orange-600/10",
    icon: "from-amber-500/30 to-orange-600/20 text-amber-400",
    spark: "#fbbf24",
    glow: "group-hover:shadow-amber-500/20",
  },
  rose: {
    grad: "from-rose-500/25 to-pink-600/10",
    icon: "from-rose-500/30 to-pink-600/20 text-rose-400",
    spark: "#fb7185",
    glow: "group-hover:shadow-rose-500/20",
  },
  violet: {
    grad: "from-violet-500/25 to-purple-600/10",
    icon: "from-violet-500/30 to-purple-600/20 text-violet-400",
    spark: "#a78bfa",
    glow: "group-hover:shadow-violet-500/25",
  },
  cyan: {
    grad: "from-cyan-500/25 to-sky-600/10",
    icon: "from-cyan-500/30 to-sky-600/20 text-cyan-400",
    spark: "#22d3ee",
    glow: "group-hover:shadow-cyan-500/20",
  },
};

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 72;
  const h = 24;
  const pts = data
    .map((v, i) => {
      const x = data.length === 1 ? w / 2 : (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} className="opacity-70">
      <defs>
        <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.4} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
}

export function KpiCard({
  title,
  value,
  prefix,
  suffix,
  decimals,
  trend,
  trendLabel,
  sparklineData,
  icon: Icon,
  accent = "blue",
  delay = 0,
}: KpiCardProps) {
  const isPositive = trend !== undefined && trend >= 0;
  const colors = accentMap[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "card-shine group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-xl transition-all duration-200",
        colors.glow,
        "hover:border-violet-500/20 hover:shadow-2xl"
      )}
    >
      <div
        className={cn(
          "absolute -right-6 -top-6 h-28 w-28 rounded-full bg-gradient-to-br blur-2xl transition-opacity duration-300 group-hover:opacity-100 opacity-50",
          colors.grad
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
            {title}
          </p>
          <p className="text-3xl font-bold tracking-tight text-white">
            <AnimatedCounter value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
          </p>
          {trend !== undefined && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold",
                  isPositive
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-rose-500/15 text-rose-400"
                )}
              >
                {isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {isPositive ? "+" : ""}
                {trend}%
              </span>
              {trendLabel && (
                <span className="text-[10px] text-zinc-600">{trendLabel}</span>
              )}
            </div>
          )}
        </div>

        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg",
            colors.icon
          )}
        >
          <Icon className="h-5 w-5 drop-shadow-[0_0_8px_currentColor]" />
        </motion.div>
      </div>

      {sparklineData && sparklineData.length > 0 && (
        <div className="relative mt-4 border-t border-white/[0.04] pt-3">
          <MiniSparkline data={sparklineData} color={colors.spark} />
        </div>
      )}
    </motion.div>
  );
}
