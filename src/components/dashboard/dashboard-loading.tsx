'use client';

import { motion } from 'framer-motion';

function Block({ className }: { className?: string }) {
  return <div className={className} />;
}

export function DashboardLoadingSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-5 md:space-y-6"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 xl:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <Block key={i} className="ops-skeleton h-[9.5rem] rounded-2xl" />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Block key={i} className="ops-skeleton h-64 rounded-2xl" />
        ))}
      </div>

      <div className="grid auto-rows-fr gap-4 md:grid-cols-2">
        {[...Array(6)].map((_, i) => (
          <Block key={i} className="ops-skeleton min-h-[21.5rem] rounded-2xl" />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Block className="ops-skeleton min-h-[32rem] rounded-2xl xl:col-span-7" />
        <div className="space-y-4 xl:col-span-5">
          <Block className="ops-skeleton h-72 rounded-2xl" />
          <Block className="ops-skeleton h-64 rounded-2xl" />
        </div>
      </div>

      <Block className="ops-skeleton h-56 rounded-2xl" />
    </motion.div>
  );
}
