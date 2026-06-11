'use client';

import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Database, Pencil, Plus, Trash2, User } from 'lucide-react';
import type { AuditLog } from '@/lib/supabase/audit-logs';
import { formatAuditLogDetail, formatAuditLogSummary } from '@/lib/supabase/audit-log-format';
import { formatPersonName } from '@/lib/display-labels';
import { StatusBadge } from '@/components/enterprise/status-badge';
import { cn } from '@/lib/utils';

const actionConfig: Record<string, { icon: typeof Plus; color: string; label: string }> = {
  INSERT: { icon: Plus, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'Created' },
  UPDATE: { icon: Pencil, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', label: 'Updated' },
  DELETE: { icon: Trash2, color: 'text-red-400 bg-red-500/10 border-red-500/20', label: 'Deleted' },
};

function groupLogsByDay(logs: AuditLog[]) {
  const groups = new Map<string, AuditLog[]>();
  for (const log of logs) {
    const day = new Date(log.created_at).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(log);
  }
  return Array.from(groups.entries());
}

function AuditEventCard({ log, index }: { log: AuditLog; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const config = actionConfig[log.action] ?? {
    icon: Database,
    color: 'text-zinc-400 bg-white/5 border-white/10',
    label: log.action,
  };
  const Icon = config.icon;
  const actor = formatPersonName(log.actor, 'System');
  const detail = formatAuditLogDetail(log);
  const initials = actor
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="relative flex gap-4 pb-6 last:pb-0"
    >
      <div
        className={cn(
          'relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border',
          config.color
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] transition-colors hover:border-violet-500/20 hover:bg-white/[0.04]">
        <button
          type="button"
          className="flex w-full items-start gap-3 p-4 text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-300 ring-1 ring-violet-500/25">
            {initials === 'SY' || initials === 'S' ? <User className="h-4 w-4" /> : initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-white">{config.label}</span>
              <StatusBadge status={log.table_name.replace(/_/g, ' ')} className="text-[9px]" />
              <span className="text-xs text-zinc-500">
                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-300">{formatAuditLogSummary(log)}</p>
            <p className="mt-0.5 text-xs text-zinc-500">by {actor}</p>
          </div>
          <ChevronDown
            className={cn('mt-1 h-4 w-4 shrink-0 text-zinc-500 transition-transform', expanded && 'rotate-180')}
          />
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-white/[0.06]"
            >
              <div className="space-y-2 px-4 py-3 text-xs text-zinc-400">
                <p>
                  <span className="text-zinc-500">Timestamp:</span>{' '}
                  {new Date(log.created_at).toLocaleString()}
                </p>
                {detail && (
                  <p className="rounded-lg bg-black/20 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
                    {detail}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function AuditIntelligenceTimeline({ logs }: { logs: AuditLog[] }) {
  const groups = useMemo(() => groupLogsByDay(logs), [logs]);

  if (!logs.length) {
    return (
      <div className="py-16 text-center text-sm text-zinc-500">
        No audit events match your filters.
      </div>
    );
  }

  return (
    <div className="relative space-y-8">
      {groups.map(([day, dayLogs]) => (
        <div key={day}>
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-violet-400/80">{day}</p>
          <div className="relative">
            <div className="absolute bottom-2 left-[21px] top-2 w-px bg-gradient-to-b from-violet-500/40 via-indigo-500/15 to-transparent" />
            {dayLogs.map((log, i) => (
              <AuditEventCard key={log.id} log={log} index={i} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
