"use client";

import { useEffect, useCallback, useState, useMemo } from "react";
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
  Loader2,
} from "lucide-react";
import { globalSearchAction, type SearchResultGroup } from "@/app/actions/search";
import { useAuth } from "@/components/auth/auth-provider";
import { isNavVisible } from "@/lib/auth/permissions";

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
  const { role } = useAuth();
  const [query, setQuery] = useState("");
  const [searchGroups, setSearchGroups] = useState<SearchResultGroup[]>([]);
  const [searching, setSearching] = useState(false);

  const navCommands = useMemo(
    () => commands.filter((c) => isNavVisible(role, c.href)),
    [role]
  );

  const filteredCommands = useMemo(
    () =>
      navCommands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase())
      ),
    [navCommands, query]
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSearchGroups([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setSearchGroups([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      const result = await globalSearchAction(query);
      setSearchGroups(result.groups);
      setSearching(false);
    }, 280);

    return () => clearTimeout(timer);
  }, [query, open]);

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

  const hasResults = filteredCommands.length > 0 || searchGroups.length > 0;

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
            className="fixed left-1/2 top-[12%] z-[101] w-full max-w-xl -translate-x-1/2 px-4"
          >
            <div className="glass-panel-strong overflow-hidden rounded-2xl shadow-2xl glow-ring">
              <div className="flex items-center gap-3 border-b border-glass-border px-4 py-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search assets, requests, vendors, team…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                {searching && <Loader2 className="h-4 w-4 animate-spin text-violet-400" />}
                <kbd className="hidden rounded-md border border-glass-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
                  ESC
                </kbd>
              </div>
              <ul className="max-h-[min(70vh,28rem)] overflow-y-auto p-2">
                {!hasResults && !searching ? (
                  <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                    {query.length < 2 ? "Type to search records or browse shortcuts" : "No results"}
                  </li>
                ) : (
                  <>
                    {searchGroups.map((group) => (
                      <li key={group.label} className="mb-2">
                        <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-400/80">
                          {group.label}
                        </p>
                        {group.items.map((item) => (
                          <button
                            key={`${group.label}-${item.id}`}
                            type="button"
                            onClick={() => navigate(item.href)}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/50"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{item.title}</p>
                              {item.subtitle && (
                                <p className="truncate text-[10px] text-muted-foreground">{item.subtitle}</p>
                              )}
                            </div>
                          </button>
                        ))}
                      </li>
                    ))}
                    {filteredCommands.length > 0 && (
                      <li>
                        <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          Shortcuts
                        </p>
                        {filteredCommands.map((cmd) => {
                          const Icon = cmd.icon;
                          return (
                            <button
                              key={cmd.href + cmd.label}
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
                          );
                        })}
                      </li>
                    )}
                  </>
                )}
              </ul>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
