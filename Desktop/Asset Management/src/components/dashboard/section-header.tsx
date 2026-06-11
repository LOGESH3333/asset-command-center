'use client';

import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type SectionHeaderProps = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  badge?: string;
  className?: string;
};

export function SectionHeader({ icon: Icon, title, subtitle, badge, className }: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
      className={cn('flex items-end justify-between gap-4', className)}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 shadow-lg shadow-violet-500/10">
          <Icon className="h-4 w-4 text-violet-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-white">{title}</h2>
          {subtitle && <p className="text-xs ops-text-muted">{subtitle}</p>}
        </div>
      </div>
      {badge && (
        <span className="shrink-0 rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
          {badge}
        </span>
      )}
    </motion.div>
  );
}
