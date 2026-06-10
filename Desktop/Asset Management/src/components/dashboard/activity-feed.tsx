'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  GitCommitHorizontal,
  Package,
  Wrench,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { formatRequestLabel } from '@/lib/supabase/requests';
import { formatAuditLogSummary, getAuditRecordHref } from '@/lib/supabase/audit-log-format';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

type FeedItem = {
  id: string;
  type: 'created' | 'assigned' | 'maintenance' | 'vendor' | 'request';
  title: string;
  subtitle: string;
  time: string;
  href?: string;
};

const typeConfig = {
  created: { icon: Package, ring: 'border-violet-500/35 bg-violet-500/12 text-violet-400', line: 'bg-violet-500' },
  assigned: { icon: ArrowRightLeft, ring: 'border-blue-500/35 bg-blue-500/12 text-blue-400', line: 'bg-blue-500' },
  maintenance: { icon: Wrench, ring: 'border-amber-500/35 bg-amber-500/12 text-amber-400', line: 'bg-amber-500' },
  vendor: { icon: Building2, ring: 'border-cyan-500/35 bg-cyan-500/12 text-cyan-400', line: 'bg-cyan-500' },
  request: { icon: CheckCircle2, ring: 'border-emerald-500/35 bg-emerald-500/12 text-emerald-400', line: 'bg-emerald-500' },
};

export function DashboardActivityFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [auditRes, assetsRes, maintRes, vendRes, reqRes, approvalRes] = await Promise.all([
          supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(8),
          supabase.from('assets').select('asset_tag, name, created_at, status').order('created_at', { ascending: false }).limit(4),
          supabase.from('maintenance_records').select('id, description, completed_date, created_at').not('completed_date', 'is', null).order('completed_date', { ascending: false }).limit(4),
          supabase.from('vendors').select('name, created_at').order('created_at', { ascending: false }).limit(3),
          supabase.from('asset_requests').select('id, justification, status, created_at').eq('status', 'Fulfilled').order('updated_at', { ascending: false }).limit(3),
          supabase
            .from('request_approvals')
            .select('id, approval_stage, status, comments, decided_at, created_at, request_id, asset_requests(justification)')
            .not('decided_at', 'is', null)
            .order('decided_at', { ascending: false })
            .limit(6),
        ]);

        const feed: FeedItem[] = [];

        assetsRes.data?.forEach((a) => {
          feed.push({
            id: `asset-${a.asset_tag}`,
            type: 'created',
            title: 'Asset registered',
            subtitle: `${a.name} · ${a.asset_tag}`,
            time: a.created_at,
            href: `/dashboard/assets/${a.asset_tag}`,
          });
          if (a.status === 'Allocated') {
            feed.push({
              id: `alloc-${a.asset_tag}`,
              type: 'assigned',
              title: 'Asset allocated',
              subtitle: a.name,
              time: a.created_at,
              href: `/dashboard/assets/${a.asset_tag}`,
            });
          }
        });

        maintRes.data?.forEach((m) =>
          feed.push({
            id: `maint-${m.id}`,
            type: 'maintenance',
            title: 'Maintenance completed',
            subtitle: m.description?.slice(0, 60) ?? 'Work order closed',
            time: m.completed_date ?? m.created_at,
            href: `/dashboard/maintenance/${m.id}`,
          })
        );

        vendRes.data?.forEach((v, i) =>
          feed.push({
            id: `vendor-${i}`,
            type: 'vendor',
            title: 'Vendor onboarded',
            subtitle: v.name,
            time: v.created_at,
            href: '/dashboard/vendors',
          })
        );

        approvalRes.data?.forEach((a) => {
          const justification =
            (a.asset_requests as { justification?: string } | null)?.justification;
          feed.push({
            id: `approval-${a.id}`,
            type: 'request',
            title: `${a.approval_stage} ${a.status?.toLowerCase() ?? 'updated'}`,
            subtitle: formatRequestLabel(justification),
            time: a.decided_at ?? a.created_at,
            href: `/dashboard/approvals/${a.id}`,
          });
        });

        reqRes.data?.forEach((r) =>
          feed.push({
            id: `req-${r.id}`,
            type: 'request',
            title: 'Request fulfilled',
            subtitle: formatRequestLabel(r.justification),
            time: r.created_at,
            href: `/dashboard/requests/${r.id}`,
          })
        );

        auditRes.data?.forEach((a) => {
          if (a.action === 'INSERT' && a.table_name === 'assets') {
            const auditLog = {
              action: a.action,
              table_name: a.table_name,
              record_id: a.record_id ?? null,
              old_data: a.old_data as Record<string, unknown> | null,
              new_data: a.new_data as Record<string, unknown> | null,
            };
            feed.push({
              id: `audit-${a.id}`,
              type: 'created',
              title: 'Audit: asset created',
              subtitle: formatAuditLogSummary(auditLog),
              time: a.created_at,
              href: getAuditRecordHref(auditLog) ?? '/dashboard/assets',
            });
          }
        });

        feed.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        setItems(feed.slice(0, 12));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="ops-glass-card ops-card-hover bm-card-hover flex min-h-[32rem] flex-col rounded-2xl border border-[rgba(139,92,246,0.15)]">
      <div className="flex items-center justify-between border-b border-[rgba(139,92,246,0.12)] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10">
            <GitCommitHorizontal className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-tight ops-text-primary">Real-Time Activity</h3>
            <p className="text-xs ops-text-muted">Operational event stream</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-400">
          <span className="relative flex h-1.5 w-1.5">
            <span className="live-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Live
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin">
        {loading ? (
          <div className="space-y-5 py-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="ops-skeleton h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="ops-skeleton h-3 w-3/5 rounded-md" />
                  <div className="ops-skeleton h-2.5 w-2/5 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
              <Package className="h-7 w-7 ops-text-muted" />
            </div>
            <p className="text-sm font-medium ops-text-secondary">No activity yet</p>
            <p className="mt-1 text-xs ops-text-caption">Events will stream here as operations occur</p>
          </div>
        ) : (
          <div className="relative pl-1">
            <div className="ops-timeline-line absolute bottom-3 left-[18px] top-3 w-px" />
            <ul className="space-y-0.5">
              {items.map((item, idx) => {
                const cfg = typeConfig[item.type];
                const Icon = cfg.icon;
                const isLast = idx === items.length - 1;

                const row = (
                  <motion.li
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.025 }}
                    className="group relative flex cursor-pointer gap-3 rounded-xl py-2.5 pr-2 transition-all duration-200 hover:bg-[rgba(139,92,246,0.06)] hover:shadow-[inset_0_0_0_1px_rgba(139,92,246,0.12)]"
                  >
                    <div className="relative z-10 flex shrink-0 flex-col items-center">
                      <div
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#050508] ring-1 ring-white/[0.06] transition-all duration-200 group-hover:ring-violet-500/30',
                          cfg.ring
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      {!isLast && <div className={cn('mt-0.5 h-1 w-1 rounded-full opacity-0', cfg.line)} />}
                    </div>
                    <div className="min-w-0 flex-1 border-b border-white/[0.04] pb-2.5 group-last:border-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm font-medium ops-text-secondary transition-colors duration-200 group-hover:text-white">
                          {item.title}
                        </p>
                        <time className="shrink-0 text-[10px] tabular-nums ops-text-caption">
                          {formatDistanceToNow(new Date(item.time), { addSuffix: true })}
                        </time>
                      </div>
                      <p className="mt-0.5 truncate text-xs leading-relaxed ops-text-label">{item.subtitle}</p>
                    </div>
                  </motion.li>
                );

                return item.href ? (
                  <Link key={item.id} href={item.href} className="block cursor-pointer">
                    {row}
                  </Link>
                ) : (
                  <div key={item.id}>{row}</div>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.06] px-5 py-3.5">
        <Link
          href="/dashboard/audit-logs"
          className="cursor-pointer text-xs font-medium text-violet-400 transition-colors duration-200 hover:text-violet-300"
        >
          View full audit trail →
        </Link>
      </div>
    </div>
  );
}
