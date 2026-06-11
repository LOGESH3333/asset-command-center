import React from 'react';
import { PackageOpenIcon } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  title = 'No data found',
  description = 'There are no records to display.',
  action,
}: EmptyStateProps) {
  return (
    <div className="erp-dark-glass flex flex-col items-center justify-center rounded-2xl py-20 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_32px_-24px_rgba(139,92,246,0.45)] backdrop-blur-xl">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10">
        <PackageOpenIcon className="h-8 w-8 text-violet-300" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-white">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-zinc-400">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
