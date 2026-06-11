import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  Available: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  Allocated: "bg-blue-500/15 text-blue-300 border-blue-400/30",
  "Under Maintenance": "bg-amber-500/15 text-amber-300 border-amber-400/30",
  Retired: "bg-zinc-500/15 text-zinc-300 border-zinc-400/30",
  Pending: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  "Pending Manager": "bg-amber-500/15 text-amber-200 border-amber-400/35",
  "Pending Procurement": "bg-orange-500/15 text-orange-300 border-orange-400/30",
  "Pending Finance": "bg-yellow-500/15 text-yellow-200 border-yellow-400/35",
  Purchasing: "bg-violet-500/15 text-violet-300 border-violet-400/30",
  Received: "bg-cyan-500/15 text-cyan-300 border-cyan-400/30",
  Approved: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  Rejected: "bg-rose-500/15 text-rose-300 border-rose-400/30",
  Active: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  Preventive: "bg-cyan-500/15 text-cyan-200 border-cyan-400/35",
  Corrective: "bg-orange-500/15 text-orange-300 border-orange-400/30",
  Fulfilled: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  Low: "bg-zinc-500/15 text-zinc-300 border-zinc-400/30",
  Medium: "bg-blue-500/15 text-blue-300 border-blue-400/30",
  High: "bg-rose-500/15 text-rose-200 border-rose-400/35",
  Admin: "bg-violet-500/15 text-violet-300 border-violet-400/30",
  Manager: "bg-indigo-500/15 text-indigo-300 border-indigo-400/30",
  Employee: "bg-slate-500/15 text-slate-200 border-slate-400/30",
  Finance: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  Procurement: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  Inactive: "bg-zinc-500/15 text-zinc-300 border-zinc-400/30",
  Invited: "bg-violet-500/15 text-violet-300 border-violet-400/30",
  Suspended: "bg-rose-500/15 text-rose-300 border-rose-400/30",
  Super_Admin: "bg-purple-500/15 text-purple-200 border-purple-400/35",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        statusStyles[status] ?? "border-violet-500/20 bg-violet-500/10 text-zinc-200",
        className
      )}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {status}
    </span>
  );
}
