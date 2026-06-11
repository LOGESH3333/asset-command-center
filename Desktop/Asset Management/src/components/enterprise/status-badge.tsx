import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  Available:
    "bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:text-emerald-300 dark:border-emerald-400/30",
  Allocated:
    "bg-blue-500/15 text-blue-700 border-blue-500/25 dark:text-blue-300 dark:border-blue-400/30",
  "Under Maintenance":
    "bg-amber-500/15 text-amber-700 border-amber-500/25 dark:text-amber-300 dark:border-amber-400/30",
  Retired:
    "bg-zinc-500/15 text-zinc-700 border-zinc-500/25 dark:text-zinc-300 dark:border-zinc-400/30",
  Pending:
    "bg-amber-500/15 text-amber-700 border-amber-500/25 dark:text-amber-300 dark:border-amber-400/30",
  "Pending Manager":
    "bg-amber-500/15 text-amber-700 border-amber-500/25 dark:text-amber-300 dark:border-amber-400/30",
  "Pending Procurement":
    "bg-orange-500/15 text-orange-700 border-orange-500/25 dark:text-orange-300 dark:border-orange-400/30",
  "Pending Finance":
    "bg-yellow-500/15 text-yellow-800 border-yellow-500/25 dark:text-yellow-300 dark:border-yellow-400/30",
  Purchasing:
    "bg-violet-500/15 text-violet-700 border-violet-500/25 dark:text-violet-300 dark:border-violet-400/30",
  Received:
    "bg-cyan-500/15 text-cyan-700 border-cyan-500/25 dark:text-cyan-300 dark:border-cyan-400/30",
  Approved:
    "bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:text-emerald-300 dark:border-emerald-400/30",
  Rejected:
    "bg-rose-500/15 text-rose-700 border-rose-500/25 dark:text-rose-300 dark:border-rose-400/30",
  Active:
    "bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:text-emerald-300 dark:border-emerald-400/30",
  Preventive:
    "bg-cyan-500/15 text-cyan-700 border-cyan-500/25 dark:text-cyan-300 dark:border-cyan-400/30",
  Corrective:
    "bg-orange-500/15 text-orange-700 border-orange-500/25 dark:text-orange-300 dark:border-orange-400/30",
  Fulfilled:
    "bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:text-emerald-300 dark:border-emerald-400/30",
  Low:
    "bg-zinc-500/15 text-zinc-700 border-zinc-500/25 dark:text-zinc-300 dark:border-zinc-400/30",
  Medium:
    "bg-blue-500/15 text-blue-700 border-blue-500/25 dark:text-blue-300 dark:border-blue-400/30",
  High:
    "bg-rose-500/15 text-rose-700 border-rose-500/25 dark:text-rose-300 dark:border-rose-400/30",
  Admin:
    "bg-violet-500/15 text-violet-700 border-violet-500/25 dark:text-violet-300 dark:border-violet-400/30",
  Manager:
    "bg-indigo-500/15 text-indigo-700 border-indigo-500/25 dark:text-indigo-300 dark:border-indigo-400/30",
  Employee:
    "bg-slate-500/15 text-slate-700 border-slate-500/25 dark:text-slate-300 dark:border-slate-400/30",
  Finance:
    "bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:text-emerald-300 dark:border-emerald-400/30",
  Procurement:
    "bg-amber-500/15 text-amber-700 border-amber-500/25 dark:text-amber-300 dark:border-amber-400/30",
  Inactive:
    "bg-zinc-500/15 text-zinc-700 border-zinc-500/25 dark:text-zinc-300 dark:border-zinc-400/30",
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
        statusStyles[status] ?? "bg-muted text-muted-foreground border-border",
        className
      )}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {status}
    </span>
  );
}
