'use client';

import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type SectionHeadingProps = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  className?: string;
};

export function SectionHeading({ icon: Icon, title, subtitle, className }: SectionHeadingProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn('flex items-center gap-3', className)}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 shadow-sm shadow-violet-500/10">
        <Icon className="h-4 w-4 text-violet-400" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold tracking-tight ops-text-heading">{title}</h2>
        {subtitle && <p className="text-xs ops-text-muted">{subtitle}</p>}
      </div>
      <div className="hidden h-px flex-1 bg-gradient-to-r from-violet-500/20 to-transparent sm:block" />
    </motion.div>
  );
}
