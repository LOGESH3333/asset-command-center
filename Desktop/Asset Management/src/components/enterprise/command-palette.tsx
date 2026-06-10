"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Store,
  ClipboardList,
  Wrench,
  BarChart3,
  Bell,
  History,
  Settings,
  Users,
  Search,
} from "lucide-react";

const commands = [
  { label: "Command Center", href: "/dashboard", icon: LayoutDashboard, group: "Navigate" },
  { label: "Asset Registry", href: "/dashboard/assets", icon: Package, group: "Navigate" },
  { label: "Categories", href: "/dashboard/categories", icon: FolderTree, group: "Navigate" },
  { label: "Vendors", href: "/dashboard/vendors", icon: Store, group: "Navigate" },
  { label: "Users", href: "/dashboard/users", icon: Users, group: "Navigate" },
  { label: "Requests", href: "/dashboard/requests", icon: ClipboardList, group: "Navigate" },
  { label: "Maintenance", href: "/dashboard/maintenance", icon: Wrench, group: "Navigate" },
  { label: "Reports", href: "/dashboard/reports", icon: BarChart3, group: "Navigate" },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell, group: "Navigate" },
  { label: "Audit Logs", href: "/dashboard/audit-logs", icon: History, group: "Navigate" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, group: "Navigate" },
  { label: "Add Asset", href: "/dashboard/assets/new", icon: Package, group: "Actions" },
  { label: "New Request", href: "/dashboard/requests/new", icon: ClipboardList, group: "Actions" },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  const navigate = useCallback(
    (href: string) => {
      onOpenChange(false);
      setQuery("");
      router.push(href);
    },
    [router, onOpenChange]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -12 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-[18%] z-[101] w-full max-w-lg -translate-x-1/2 px-4"
          >
            <div className="glass-panel-strong overflow-hidden rounded-2xl shadow-2xl glow-ring">
              <div className="flex items-center gap-3 border-b border-glass-border px-4 py-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search commands, pages, actions..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <kbd className="hidden rounded-md border border-glass-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
                  ESC
                </kbd>
              </div>
              <ul className="max-h-80 overflow-y-auto p-2">
                {filtered.length === 0 ? (
                  <li className="px-3 py-8 text-center text-sm text-muted-foreground">No results</li>
                ) : (
                  filtered.map((cmd) => {
                    const Icon = cmd.icon;
                    return (
                      <li key={cmd.href + cmd.label}>
                        <button
                          type="button"
                          onClick={() => navigate(cmd.href)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/50"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{cmd.label}</p>
                            <p className="text-[10px] text-muted-foreground">{cmd.group}</p>
                          </div>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
