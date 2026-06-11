'use client';

import { motion, useReducedMotion } from 'framer-motion';

export function AmbientBackground() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#020204]">
      <div className="bm-shell-grid absolute inset-0 opacity-60" />
      <div className="absolute -left-[12%] top-0 h-[650px] w-[650px] rounded-full bg-violet-600/16 blur-[140px]" />
      <div className="absolute -right-[8%] top-[8%] h-[520px] w-[520px] rounded-full bg-indigo-600/12 blur-[120px]" />
      <div className="absolute bottom-[-8%] left-[20%] h-[420px] w-[420px] rounded-full bg-purple-600/10 blur-[110px]" />
      <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />

      {!reduceMotion && (
        <motion.div
          className="absolute inset-0 opacity-40"
          animate={{
            background: [
              'radial-gradient(ellipse 65% 55% at 15% 15%, rgba(139,92,246,0.14), transparent)',
              'radial-gradient(ellipse 65% 55% at 85% 25%, rgba(99,102,241,0.14), transparent)',
              'radial-gradient(ellipse 65% 55% at 50% 65%, rgba(139,92,246,0.12), transparent)',
              'radial-gradient(ellipse 65% 55% at 15% 15%, rgba(139,92,246,0.14), transparent)',
            ],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </div>
  );
}
