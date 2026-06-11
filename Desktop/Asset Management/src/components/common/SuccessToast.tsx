'use client';

import React, { useEffect } from 'react';
import { CheckCircle2Icon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type SuccessToastProps = {
  message: string;
  onDismiss: () => void;
  durationMs?: number;
  className?: string;
};

export function SuccessToast({
  message,
  onDismiss,
  durationMs = 4000,
  className,
}: SuccessToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [onDismiss, durationMs]);

  return (
    <div
      role="status"
      className={cn(
        'fixed bottom-6 right-6 z-[100] flex max-w-sm items-start gap-3 rounded-xl border border-emerald-500/30 bg-background/95 px-4 py-3 text-sm shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-4 fade-in',
        className
      )}
    >
      <CheckCircle2Icon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
      <div className="flex-1">
        <p className="font-medium text-foreground">Success</p>
        <p className="text-muted-foreground">{message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Dismiss"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
