'use client';

import { motion } from 'framer-motion';
import { Brain, Gauge, Shield, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

type InsightProps = {
  healthScore: number;
  total: number;
  allocated: number;
  maintenanceDue: number;
  vendorCount: number;
};

export function ExecutiveInsights({ healthScore, total, allocated, maintenanceDue, vendorCount }: InsightProps) {
  const efficiency = total > 0 ? Math.round((allocated / total) * 100) : 0;
  const maintRisk = maintenanceDue > 5 ? 'High' : maintenanceDue > 2 ? 'Medium' : 'Low';
  const vendorReliability = vendorCount >= 5 ? 'High' : vendorCount > 0 ? 'Medium' : 'Low';

  const insights = [
    {
      label: 'Asset Health',
      value: `${healthScore}%`,
      icon: Gauge,
      status: healthScore >= 80 ? 'good' : healthScore >= 60 ? 'warn' : 'bad',
      sub: 'Portfolio condition index',
    },
    {
      label: 'Operational Efficiency',
      value: `${efficiency}%`,
      icon: Brain,
      status: efficiency >= 70 ? 'good' : efficiency >= 40 ? 'warn' : 'bad',
      sub: 'Active allocation rate',
    },
    {
      label: 'Maintenance Risk',
      value: maintRisk,
      icon: Shield,
      status: maintRisk === 'Low' ? 'good' : maintRisk === 'Medium' ? 'warn' : 'bad',
      sub: `${maintenanceDue} open work orders`,
    },
    {
      label: 'Vendor Reliability',
      value: vendorReliability,
      icon: Truck,
      status: vendorReliability === 'High' ? 'good' : vendorReliability === 'Medium' ? 'warn' : 'bad',
      sub: `${vendorCount} active suppliers`,
    },
  ] as const;

  const statusColors = {
    good: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    warn: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    bad: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {insights.map((item, i) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06 }}
            className="card-shine group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-xl transition-all duration-200 hover:border-violet-500/20 hover:shadow-xl hover:shadow-violet-500/10"
          >
            <div
              className={cn(
                'absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-40',
                item.status === 'good' && 'text-emerald-400',
                item.status === 'warn' && 'text-amber-400',
                item.status === 'bad' && 'text-rose-400'
              )}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-600/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider ops-text-muted">{item.label}</p>
                <p className="mt-2 text-2xl font-bold text-white">{item.value}</p>
                <p className="mt-1 text-[11px] ops-text-muted">{item.sub}</p>
              </div>
              <div className={cn('rounded-xl border p-2.5', statusColors[item.status])}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <div className="relative mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: item.status === 'good' ? '85%' : item.status === 'warn' ? '55%' : '30%' }}
                transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
                className={cn(
                  'h-full rounded-full',
                  item.status === 'good' && 'bg-gradient-to-r from-emerald-500 to-teal-400',
                  item.status === 'warn' && 'bg-gradient-to-r from-amber-500 to-orange-400',
                  item.status === 'bad' && 'bg-gradient-to-r from-rose-500 to-pink-400'
                )}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
