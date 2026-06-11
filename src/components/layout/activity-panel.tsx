"use client";



import { useEffect, useState } from "react";

import { motion, AnimatePresence } from "framer-motion";

import Link from "next/link";

import {

  Activity,

  ArrowRightLeft,

  Bell,

  Building2,

  CheckCircle2,

  Clock,

  Radio,

  Wrench,

} from "lucide-react";

import { getActivityStreamAction } from "@/app/actions/activity";

import { formatRequestLabel } from "@/lib/supabase/requests";
import { formatAuditLogSummary } from "@/lib/supabase/audit-log-format";

import { cn } from "@/lib/utils";

import { formatDistanceToNow } from "date-fns";



type ActivityItem = {

  id: string;

  type: "allocation" | "request" | "maintenance" | "vendor" | "notification";

  title: string;

  description: string;

  time: string;

  href?: string;

};

type PanelRequestRow = {
  id: string;
  justification: string | null;
  status: string | null;
  created_at: string;
};

type PanelMaintenanceRow = {
  id: string;
  description: string | null;
  type: string | null;
  scheduled_date: string | null;
};

type PanelNotificationRow = {
  id: string;
  title: string;
  message: string | null;
  created_at: string;
};

type PanelAuditRow = {
  id: string;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

type PanelAllocationRow = {
  asset_tag: string;
  name: string;
  updated_at: string;
};

type PanelApprovalRow = {
  id: string;
  approval_stage: string;
  status: string | null;
  decided_at: string | null;
  created_at: string;
  asset_requests: { justification?: string } | { justification?: string }[] | null;
};



const typeConfig = {

  allocation: {

    icon: ArrowRightLeft,

    ring: "border-blue-400/40 bg-blue-500/15 text-blue-300",

    dot: "bg-blue-400",

    line: "from-blue-500/60",

  },

  request: {

    icon: CheckCircle2,

    ring: "border-violet-400/40 bg-violet-500/15 text-violet-300",

    dot: "bg-violet-400",

    line: "from-violet-500/60",

  },

  maintenance: {

    icon: Wrench,

    ring: "border-amber-400/40 bg-amber-500/15 text-amber-300",

    dot: "bg-amber-400",

    line: "from-amber-500/60",

  },

  vendor: {

    icon: Building2,

    ring: "border-cyan-400/40 bg-cyan-500/15 text-cyan-300",

    dot: "bg-cyan-400",

    line: "from-cyan-500/60",

  },

  notification: {

    icon: Bell,

    ring: "border-rose-400/40 bg-rose-500/15 text-rose-300",

    dot: "bg-rose-400",

    line: "from-rose-500/60",

  },

};



interface ActivityPanelProps {

  open: boolean;

  className?: string;

}



export function ActivityPanel({ open, className }: ActivityPanelProps) {

  const [items, setItems] = useState<ActivityItem[]>([]);

  const [loading, setLoading] = useState(true);



  useEffect(() => {

    async function loadActivity() {

      setLoading(true);

      try {

        const stream = await getActivityStreamAction();
        if (stream.error) {
          console.warn("Activity panel:", stream.error);
          setItems([]);
          return;
        }

        const combined: ActivityItem[] = [];
        const approvalRows = (stream.approvalRows ?? []) as PanelApprovalRow[];
        const requestRows = (stream.recentRequestRows ?? []) as PanelRequestRow[];
        const maintenanceRows = (stream.maintScheduledRows ?? []) as PanelMaintenanceRow[];
        const notificationRows = (stream.notificationRows ?? []) as PanelNotificationRow[];
        const auditRows = (stream.auditRows ?? []) as PanelAuditRow[];
        const allocationRows = (stream.allocationRows ?? []) as PanelAllocationRow[];



        approvalRows.forEach((a: PanelApprovalRow) => {
          const justification = Array.isArray(a.asset_requests)
            ? a.asset_requests[0]?.justification
            : a.asset_requests?.justification;
          combined.push({
            id: `approval-${a.id}`,
            type: "request",
            title: `${a.approval_stage} ${String(a.status).toLowerCase()}`,
            description: formatRequestLabel(justification),
            time: a.decided_at ?? a.created_at,
            href: `/dashboard/approvals/${a.id}`,
          });
        });

        requestRows.forEach((r: PanelRequestRow) =>

          combined.push({

            id: `req-${r.id}`,

            type: "request",

            title: formatRequestLabel(r.justification),

            description: `Request ${r.status}`,

            time: r.created_at,

            href: `/dashboard/requests/${r.id}`,

          })

        );



        maintenanceRows.forEach((m: PanelMaintenanceRow) =>

          combined.push({

            id: `maint-${m.id}`,

            type: "maintenance",

            title: m.type ?? "Maintenance",

            description: m.description?.slice(0, 60) ?? "Scheduled maintenance",

            time: m.scheduled_date ?? new Date().toISOString(),

            href: `/dashboard/maintenance/${m.id}`,

          })

        );



        notificationRows.forEach((n: PanelNotificationRow) =>

          combined.push({

            id: `notif-${n.id}`,

            type: "notification",

            title: n.title,

            description: n.message?.slice(0, 60) ?? "System alert",

            time: n.created_at,

            href: "/dashboard/notifications",

          })

        );



        auditRows.forEach((a: PanelAuditRow) =>

          combined.push({

            id: `audit-${a.id}`,

            type: "allocation",

            title: `${a.action} · ${a.table_name}`,

            description: formatAuditLogSummary({
              action: a.action,
              table_name: a.table_name,
              record_id: a.record_id ?? null,
              old_data: a.old_data as Record<string, unknown> | null,
              new_data: a.new_data as Record<string, unknown> | null,
            }),

            time: a.created_at,

            href: "/dashboard/audit-logs",

          })

        );



        allocationRows.forEach((a: PanelAllocationRow) =>

          combined.push({

            id: `alloc-${a.asset_tag}`,

            type: "allocation",

            title: `Allocated: ${a.name}`,

            description: a.asset_tag,

            time: a.updated_at,

            href: `/dashboard/assets/${a.asset_tag}`,

          })

        );



        combined.sort(

          (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()

        );

        setItems(combined.slice(0, 12));

      } catch (e) {

        console.error("Activity load error:", e);

      } finally {

        setLoading(false);

      }

    }



    if (open) loadActivity();

  }, [open]);



  return (

    <AnimatePresence>

      {open && (

        <motion.aside

          initial={{ width: 0, opacity: 0 }}

          animate={{ width: 336, opacity: 1 }}

          exit={{ width: 0, opacity: 0 }}

          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}

          className={cn("hidden shrink-0 overflow-hidden xl:block", className)}

        >

          <div className="bm-card mr-3 mt-2 flex h-[calc(100vh-1.25rem)] w-[324px] flex-col overflow-hidden rounded-2xl">

            <div className="flex items-center justify-between border-b border-[rgba(139,92,246,0.12)] px-5 py-4">

              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(139,92,246,0.25)] bg-[rgba(139,92,246,0.12)] shadow-[0_0_20px_-4px_rgba(139,92,246,0.35)]">

                  <Activity className="h-4 w-4 text-[#c4b5fd]" />

                </div>

                <div>

                  <h3 className="text-sm font-semibold text-white">Activity Center</h3>

                  <p className="text-[11px] font-medium text-[#c4b5fd]">Live operations feed</p>

                </div>

              </div>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-300">

                <Radio className="h-3 w-3" />

                Live

              </span>

            </div>



            <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">

              {loading ? (

                <div className="space-y-3">

                  {[...Array(5)].map((_, i) => (

                    <div key={i} className="ops-skeleton h-[4.5rem] rounded-xl" />

                  ))}

                </div>

              ) : items.length === 0 ? (

                <div className="flex flex-col items-center justify-center py-14 text-center">

                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(139,92,246,0.15)] bg-[rgba(16,16,24,0.8)]">

                    <Clock className="h-7 w-7 text-[#c4b5fd]" />

                  </div>

                  <p className="text-sm font-medium text-[#f5f5f7]">No recent activity</p>

                  <p className="mt-1 text-xs text-[#a1a1aa]">Events appear here in real time</p>

                </div>

              ) : (

                <div className="relative pl-1">

                  <div className="ops-timeline-line absolute bottom-4 left-[21px] top-4 w-px" />

                  <ul className="space-y-0.5">

                    {items.map((item, idx) => {

                      const config = typeConfig[item.type];

                      const Icon = config.icon;



                      const row = (

                        <motion.li

                          initial={{ opacity: 0, x: 8 }}

                          animate={{ opacity: 1, x: 0 }}

                          transition={{ delay: idx * 0.03 }}

                          className="group relative flex gap-3 rounded-xl py-2.5 pr-2 transition-all duration-200 hover:bg-[rgba(139,92,246,0.06)]"

                        >

                          <div className="relative z-10 flex shrink-0 flex-col items-center">

                            <div

                              className={cn(

                                "flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#020204] ring-1 ring-[rgba(139,92,246,0.15)] transition-all duration-200 group-hover:ring-violet-400/40",

                                config.ring

                              )}

                            >

                              <Icon className="h-4 w-4" />

                            </div>

                          </div>

                          <div className="min-w-0 flex-1 border-b border-[rgba(139,92,246,0.08)] pb-2.5 group-last:border-0">

                            <div className="flex items-baseline justify-between gap-2">

                              <p className="truncate text-sm font-semibold text-[#f5f5f7] transition-colors group-hover:text-white">

                                {item.title}

                              </p>

                              <time className="shrink-0 text-[10px] tabular-nums text-[#a1a1aa]">

                                {formatDistanceToNow(new Date(item.time), { addSuffix: true })}

                              </time>

                            </div>

                            <p className="mt-0.5 truncate text-xs text-[#c4b5fd]">{item.description}</p>

                          </div>

                        </motion.li>

                      );



                      return item.href ? (

                        <Link key={item.id} href={item.href} className="block">

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



            <div className="border-t border-[rgba(139,92,246,0.12)] px-5 py-3.5">

              <Link

                href="/dashboard/audit-logs"

                className="text-xs font-semibold text-[#c4b5fd] transition-colors hover:text-white"

              >

                View full audit trail →

              </Link>

            </div>

          </div>

        </motion.aside>

      )}

    </AnimatePresence>

  );

}

