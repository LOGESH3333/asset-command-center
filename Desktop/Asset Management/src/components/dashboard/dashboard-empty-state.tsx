'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Package, Radar } from 'lucide-react';
import { MagneticButton } from '@/components/enterprise/magnetic-button';

const steps = [
  'Register your first asset in the registry',
  'Configure categories and vendors',
  'Monitor operations from this command center',
];

export function DashboardEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="ops-glass-card bm-card relative overflow-hidden rounded-2xl border border-dashed border-[rgba(139,92,246,0.35)] px-6 py-16 text-center md:px-12 md:py-20"
    >
      <div className="command-grid pointer-events-none absolute inset-0 opacity-25" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-violet-600/15 blur-[80px]" />

      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="relative mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-600/20 to-indigo-600/10 shadow-xl shadow-violet-500/15 ring-1 ring-white/10"
      >
        <Package className="h-9 w-9 text-violet-400" />
        <Radar className="absolute -right-1.5 -top-1.5 h-5 w-5 text-indigo-400" />
      </motion.div>

      <h2 className="relative text-xl font-semibold tracking-tight text-white md:text-2xl">
        Your command center is ready
      </h2>
      <p className="relative mx-auto mt-2 max-w-md text-sm leading-relaxed ops-text-muted">
        No assets in the registry yet. Initialize your portfolio to unlock real-time operations intelligence.
      </p>

      <ul className="relative mx-auto mt-8 max-w-sm space-y-2.5 text-left">
        {steps.map((step, i) => (
          <motion.li
            key={step}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.08 }}
            className="flex items-center gap-3 text-xs ops-text-secondary"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-violet-500/25 bg-violet-500/10 text-[10px] font-semibold text-violet-400">
              {i + 1}
            </span>
            {step}
          </motion.li>
        ))}
      </ul>

      <Link href="/dashboard/assets/new" className="relative mt-10 inline-block cursor-pointer">
        <MagneticButton className="neon-button inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-3 text-sm font-semibold text-white shadow-xl shadow-violet-500/25 transition-shadow duration-200 hover:shadow-violet-500/40">
          Register First Asset
          <ArrowRight className="h-4 w-4" />
        </MagneticButton>
      </Link>
    </motion.div>
  );
}
