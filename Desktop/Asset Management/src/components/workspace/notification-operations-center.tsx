'use client';

import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import {
  ArrowRightLeft,
  Bell,
  Check,
  CheckCircle2,
  ShoppingCart,
  Trash2,
  Wrench,
  Eye,
} from 'lucide-react';
import type { Notification } from '@/lib/supabase/notifications';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type NotificationCategory = 'approval' | 'maintenance' | 'procurement' | 'allocation' | 'general';

function categorizeNotification(n: Notification): NotificationCategory {
  const text = `${n.title} ${n.message}`.toLowerCase();
  if (text.includes('approval') || text.includes('approved') || text.includes('reject')) return 'approval';
  if (text.includes('maintenance') || text.includes('repair')) return 'maintenance';
  if (text.includes('procurement') || text.includes('purchase') || text.includes('po ')) return 'procurement';
  if (text.includes('allocat') || text.includes('assign')) return 'allocation';
  return 'general';
}

const categoryMeta: Record<
  NotificationCategory,
  { label: string; icon: typeof Bell; color: string }
> = {
  approval: { label: 'Approval', icon: CheckCircle2, color: 'text-violet-400 bg-violet-500/15 border-violet-500/25' },
  maintenance: { label: 'Maintenance', icon: Wrench, color: 'text-amber-400 bg-amber-500/15 border-amber-500/25' },
  procurement: { label: 'Procurement', icon: ShoppingCart, color: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/25' },
  allocation: { label: 'Allocation', icon: ArrowRightLeft, color: 'text-blue-400 bg-blue-500/15 border-blue-500/25' },
  general: { label: 'System', icon: Bell, color: 'text-zinc-400 bg-white/5 border-white/10' },
};

function priorityFromTitle(title: string): 'high' | 'medium' | 'low' {
  const t = title.toLowerCase();
  if (t.includes('reject') || t.includes('critical') || t.includes('required')) return 'high';
  if (t.includes('pending') || t.includes('approval')) return 'medium';
  return 'low';
}

const priorityStyles = {
  high: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  medium: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  low: 'bg-zinc-500/15 text-zinc-400 ring-zinc-500/30',
};

export function useNotificationInsights(notifications: Notification[]) {
  return useMemo(() => {
    const unread = notifications.filter((n) => !n.read).length;
    const byCat = { approval: 0, maintenance: 0, procurement: 0, allocation: 0, general: 0 };
    for (const n of notifications) {
      byCat[categorizeNotification(n)] += 1;
    }
    return { unread, total: notifications.length, byCat };
  }, [notifications]);
}

type NotificationOperationsCenterProps = {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
};

export function NotificationOperationsCenter({
  notifications,
  onMarkRead,
  onDelete,
}: NotificationOperationsCenterProps) {
  if (!notifications.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10">
          <Bell className="h-8 w-8 text-violet-400" />
        </div>
        <p className="text-lg font-semibold text-white">All clear</p>
        <p className="mt-1 text-sm text-zinc-500">No operational alerts in your queue.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notifications.map((item, idx) => {
        const cat = categorizeNotification(item);
        const meta = categoryMeta[cat];
        const Icon = meta.icon;
        const priority = priorityFromTitle(item.title);

        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03 }}
            className={cn(
              'group flex items-start gap-4 rounded-2xl border p-4 transition-all',
              !item.read
                ? 'border-violet-500/25 bg-violet-500/[0.07] shadow-lg shadow-violet-500/5'
                : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1]'
            )}
          >
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', meta.color)}>
              <Icon className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ring-1', priorityStyles[priority])}>
                  {priority}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-medium text-zinc-400">
                  {meta.label}
                </span>
                {!item.read && (
                  <span className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
                )}
              </div>
              <p className="text-sm leading-relaxed text-zinc-400">{item.message}</p>
              <p className="text-[11px] text-zinc-600">
                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
              {!item.read && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  title="Mark read"
                  onClick={() => onMarkRead(item.id)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                title="Dismiss"
                onClick={() => onDelete(item.id)}
              >
                <Trash2 className="h-4 w-4 text-rose-400" />
              </Button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export function NotificationCategoryPills({ counts }: { counts: Record<NotificationCategory, number> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(categoryMeta) as NotificationCategory[]).map((key) => {
        const meta = categoryMeta[key];
        const Icon = meta.icon;
        return (
          <div
            key={key}
            className={cn('flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium', meta.color)}
          >
            <Icon className="h-3.5 w-3.5" />
            {meta.label}
            <span className="ml-1 rounded-md bg-black/20 px-1.5 py-0.5 tabular-nums">{counts[key]}</span>
          </div>
        );
      })}
    </div>
  );
}
