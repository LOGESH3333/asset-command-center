'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

type AuthShellProps = {
  children: React.ReactNode;
  heading?: string;
};

export function AuthShell({ children, heading }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050508] px-4 py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-1/4 h-[420px] w-[420px] rounded-full bg-violet-600/25 blur-[140px]" />
        <div className="absolute -right-40 bottom-1/4 h-[420px] w-[420px] rounded-full bg-indigo-600/20 blur-[140px]" />
        <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 shadow-2xl shadow-violet-500/40 ring-1 ring-violet-400/30">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Asset Command Center</h1>
          <p className="mt-2 text-sm text-zinc-400">Enterprise Asset Intelligence Platform</p>
          {heading && <p className="mt-4 text-base font-medium text-zinc-300">{heading}</p>}
        </div>

        <div className="glass-panel-strong glow-ring rounded-2xl border border-white/10 p-8 shadow-2xl shadow-violet-950/50 backdrop-blur-xl">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
