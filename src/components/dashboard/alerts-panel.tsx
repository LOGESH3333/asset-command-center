'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { AlertTriangle, Bell, Clock, ShieldAlert, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AlertItem = {
  id: string;
  label: string;
  count: number;
  href: string;
  severity: 'critical' | 'warning' | 'info';
};

const severityStyles = {
  critical: {
    badge: 'bg-rose-500/12 text-rose-400 ring-rose-500/25',
    icon: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
    stripe: 'ops-alert-stripe-critical',
    bar: 'bg-rose-500',
  },
  warning: {
    badge: 'bg-amber-500/12 text-amber-400 ring-amber-500/25',
    icon: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    stripe: 'ops-alert-stripe-warning',
    bar: 'bg-amber-500',
  },
  info: {
    badge: 'bg-blue-500/12 text-blue-400 ring-blue-500/25',
    icon: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    stripe: 'ops-alert-stripe-info',
    bar: 'bg-blue-500',
  },
};

const severityBadge = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
};

const icons = {
  warranty: ShieldAlert,
  maintenance: Wrench,
  overdue: Clock,
  approvals: AlertTriangle,
};

export function AlertsPanel({ alerts }: { alerts: AlertItem[] }) {
  const total = alerts.reduce((s, a) => s + a.count, 0);
  const maxCount = Math.max(...alerts.map((a) => a.count), 1);

  return (
    <div className="ops-glass-card ops-card-hover bm-card-hover rounded-2xl border border-[rgba(139,92,246,0.15)] p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 shadow-sm shadow-rose-500/10">
            <Bell className="h-4 w-4 text-rose-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight ops-text-primary">Alerts Center</h3>
            <p className="text-xs ops-text-muted">Items requiring attention</p>
          </div>
        </div>
        {total > 0 && (
          <span className="rounded-full border border-rose-500/30 bg-rose-500/12 px-2.5 py-1 text-[10px] font-bold tabular-nums text-rose-400 ring-1 ring-rose-500/20">
            {total}
          </span>
        )}
      </div>

      <div className="space-y-2.5">
        {alerts.map((alert, i) => {
          const Icon =
            alert.id === 'warranty'
              ? icons.warranty
              : alert.id === 'maintenance'
                ? icons.maintenance
                : alert.id === 'overdue'
                  ? icons.overdue
                  : icons.approvals;
          const style = severityStyles[alert.severity];
          const pct = (alert.count / maxCount) * 100;

          return (
            <Link key={alert.id} href={alert.href} className="block cursor-pointer">
              <motion.div
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  'group overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] pl-0 transition-all duration-200 hover:border-violet-500/22 hover:bg-white/[0.04]',
                  style.stripe
                )}
              >
                <div className="flex items-center gap-3 p-3 pl-3.5">
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', style.icon)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium ops-text-secondary group-hover:text-white">{alert.label}</p>
                      <span className="text-base font-semibold tabular-nums text-white">{alert.count}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ring-1', style.badge)}>
                        {severityBadge[alert.severity]}
                      </span>
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.7, delay: 0.15 + i * 0.06 }}
                          className={cn('h-full rounded-full opacity-80', style.bar)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
