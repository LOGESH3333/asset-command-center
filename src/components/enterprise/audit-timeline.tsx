'use client';

import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, Database } from 'lucide-react';
import type { AuditLog } from '@/lib/supabase/audit-logs';
import { formatAuditLogDetail, formatAuditLogSummary } from '@/lib/supabase/audit-log-format';
import { formatPersonName } from '@/lib/display-labels';
import { cn } from '@/lib/utils';

const actionConfig: Record<string, { icon: typeof Plus; color: string; label: string }> = {
  INSERT: { icon: Plus, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'Created' },
  UPDATE: { icon: Pencil, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', label: 'Updated' },
  DELETE: { icon: Trash2, color: 'text-red-400 bg-red-500/10 border-red-500/20', label: 'Deleted' },
};

type AuditTimelineProps = {
  logs: AuditLog[];
};

export function AuditTimeline({ logs }: AuditTimelineProps) {
  return (
    <div className="relative space-y-0">
      <div className="absolute bottom-4 left-[19px] top-4 w-px bg-gradient-to-b from-violet-500/40 via-indigo-500/20 to-transparent" />

      {logs.map((log, i) => {
        const config = actionConfig[log.action] ?? {
          icon: Database,
          color: 'text-zinc-400 bg-white/5 border-white/10',
          label: log.action,
        };
        const Icon = config.icon;

        return (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="relative flex gap-4 pb-8 last:pb-0"
          >
            <div
              className={cn(
                'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
                config.color
              )}
            >
              <Icon className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-white">{config.label}</span>
                <span className="rounded-md bg-violet-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-violet-300">
                  {log.table_name}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-300">{formatAuditLogSummary(log)}</p>
              {log.actor && (
                <p className="mt-1 text-xs text-zinc-500">
                  by {formatPersonName(log.actor)}
                </p>
              )}
              {(() => {
                const detail = formatAuditLogDetail(log);
                return detail ? <p className="mt-1 text-xs text-zinc-500">{detail}</p> : null;
              })()}
              <p className="mt-2 text-[11px] text-zinc-600">
                {new Date(log.created_at).toLocaleString()}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
