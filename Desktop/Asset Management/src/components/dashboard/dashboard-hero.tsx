'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, AlertTriangle, Calendar, Clock, Package, ShoppingCart, Wrench } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { AnimatedCounter } from '@/components/enterprise/animated-counter';

export type HeroStats = {
  activeAssets: number;
  maintenanceAssets: number;
  pendingRequests: number;
  procurementPipeline: number;
  alertsCount: number;
};

function getGreeting(date: Date | null) {
  if (!date) return 'Welcome';
  const h = date.getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function formatDisplayName(firstName?: string | null) {
  if (!firstName) return 'Commander';
  const clean = firstName.replace(/\d+/g, '').trim() || firstName;
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

export function DashboardHero({ stats }: { stats: HeroStats }) {
  const { profile } = useAuth();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const name = formatDisplayName(profile?.first_name);

  const statChips = [
    { label: 'Active Assets', value: stats.activeAssets, icon: Package, accent: 'text-violet-400', border: 'hover:border-violet-500/30' },
    { label: 'In Maintenance', value: stats.maintenanceAssets, icon: Wrench, accent: 'text-amber-400', border: 'hover:border-amber-500/30' },
    { label: 'Pending Requests', value: stats.pendingRequests, icon: Activity, accent: 'text-blue-400', border: 'hover:border-blue-500/30' },
    { label: 'Procurement', value: stats.procurementPipeline, icon: ShoppingCart, accent: 'text-cyan-400', border: 'hover:border-cyan-500/30' },
    { label: 'Alerts', value: stats.alertsCount, icon: AlertTriangle, accent: 'text-rose-400', border: 'hover:border-rose-500/30' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="ops-hero bm-card-hover relative overflow-hidden rounded-2xl border border-[rgba(139,92,246,0.15)] p-5 md:p-7"
    >
      <div className="command-grid pointer-events-none absolute inset-0 opacity-25" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-violet-600/18 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-indigo-600/12 blur-[80px]" />

      <div className="relative space-y-5 md:space-y-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2.5 md:gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-400 ring-1 ring-emerald-500/15">
              <span className="relative flex h-2 w-2">
                <span className="live-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              System Operational
            </span>
            <span className="flex items-center gap-1.5 text-xs ops-text-muted">
              <Calendar className="h-3.5 w-3.5 ops-text-caption" />
              {now
                ? now.toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : '—'}
            </span>
            <span className="flex items-center gap-1.5 font-mono text-xs tabular-nums ops-text-muted">
              <Clock className="h-3.5 w-3.5 ops-text-caption" />
              {now
                ? now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : '--:--:--'}
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl lg:text-[2.125rem] lg:leading-tight">
              {getGreeting(now)},{' '}
              <span className="bg-gradient-to-r from-violet-200 via-indigo-100 to-cyan-200 bg-clip-text text-transparent">
                {name}
              </span>
            </h1>
            <p className="mt-1.5 text-sm font-medium ops-text-muted md:text-base">
              Enterprise Asset Operations Command Center
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 md:gap-3">
          {statChips.map((chip, i) => {
            const Icon = chip.icon;
            return (
              <motion.div
                key={chip.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.04 }}
                className={`flex min-h-[4.75rem] flex-col justify-center rounded-xl border border-[rgba(139,92,246,0.12)] bg-[rgba(16,16,24,0.85)] px-3.5 py-3 backdrop-blur-sm transition-all duration-200 ${chip.border} hover:border-[rgba(139,92,246,0.28)] hover:bg-[rgba(16,16,24,0.95)] hover:shadow-[0_0_24px_-8px_rgba(139,92,246,0.25)]`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${chip.accent}`} />
                  <span className="truncate text-[10px] font-medium uppercase tracking-wide ops-text-muted">{chip.label}</span>
                </div>
                <p className="mt-1.5 text-xl font-semibold tabular-nums text-white">
                  <AnimatedCounter value={chip.value} />
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
