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
    <div className="glass-panel flex flex-col items-center justify-center rounded-2xl py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <PackageOpenIcon className="h-8 w-8 text-primary/60" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
