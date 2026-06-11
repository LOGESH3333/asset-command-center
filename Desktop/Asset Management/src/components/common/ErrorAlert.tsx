import React from 'react';
import { AlertCircleIcon } from 'lucide-react';

interface ErrorAlertProps {
  title?: string;
  message: string;
}

export function ErrorAlert({ title = 'Error', message }: ErrorAlertProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive">
      <AlertCircleIcon className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <h4 className="font-semibold">{title}</h4>
        <p className="mt-1 text-sm">{message}</p>
      </div>
    </div>
  );
}
