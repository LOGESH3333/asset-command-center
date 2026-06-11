import React from 'react';
import { AlertCircleIcon } from 'lucide-react';
import { sanitizeErrorMessageForUi } from '@/lib/supabase/audit-db-errors';
import { cn } from '@/lib/utils';

interface ErrorAlertProps {
  title?: string;
  message: string;
  /** Compact card with scrollable body for longer messages */
  variant?: 'default' | 'compact';
  className?: string;
  raw?: boolean;
}

export function ErrorAlert({
  title = 'Error',
  message,
  variant = 'default',
  className,
  raw = false,
}: ErrorAlertProps) {
  const displayMessage = raw ? message : sanitizeErrorMessageForUi(message);
  const isCompact = variant === 'compact';

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-950/20 backdrop-blur-sm',
        'shadow-[0_0_28px_-6px_rgba(239,68,68,0.4),inset_0_1px_0_rgba(255,255,255,0.04)]',
        isCompact ? 'p-3.5' : 'p-4',
        className
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-500/25 bg-red-500/10">
        <AlertCircleIcon className="h-4 w-4 text-red-400" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-semibold tracking-tight text-red-200">{title}</h4>
        <pre
          className={cn(
            'mt-1.5 whitespace-pre-wrap font-sans text-sm leading-relaxed text-red-100/85 break-words [overflow-wrap:anywhere]',
            isCompact && 'max-h-24 overflow-y-auto pr-1 scrollbar-thin'
          )}
        >
          {displayMessage}
        </pre>
      </div>
    </div>
  );
}
