"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, Search, Sun, Moon, Command, PanelRight, Menu } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { type Theme, getStoredTheme, applyTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/enterprise/status-badge";

interface TopbarProps {
  onToggleActivity?: () => void;
  onToggleMobileNav?: () => void;
  onOpenCommandPalette?: () => void;
  activityOpen?: boolean;
}

export function Topbar({ onToggleActivity, onToggleMobileNav, onOpenCommandPalette, activityOpen }: TopbarProps) {
  const [theme, setTheme] = useState<Theme>("dark");
  const { profile } = useAuth();

  useEffect(() => {
    const current = getStoredTheme();
    applyTheme(current);
    setTheme(current);
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
  };

  return (
    <header className="sticky top-0 z-20 px-4 pt-3 pb-2">
      <div className="bm-topbar-panel flex h-[3.75rem] items-center justify-between gap-4 rounded-2xl px-5">
        <div className="flex flex-1 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl text-[#a1a1aa] hover:bg-[rgba(139,92,246,0.1)] hover:text-white md:hidden"
            onClick={onToggleMobileNav}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="group relative hidden flex-1 sm:block sm:max-w-lg"
          >
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#c4b5fd] transition-colors group-hover:text-violet-300" />
            <span className="bm-search-field flex h-10 w-full items-center rounded-xl pl-10 pr-20 text-sm text-[#a1a1aa] transition-colors group-hover:text-[#f5f5f7]">
              Search assets, requests, vendors...
            </span>
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-[rgba(139,92,246,0.2)] bg-[rgba(2,2,4,0.8)] px-2 py-1 text-[10px] font-medium text-[#c4b5fd] lg:inline-flex">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {profile?.role && (
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="hidden sm:inline-flex"
            >
              <StatusBadge
                status={profile.role}
                className="border-[rgba(139,92,246,0.25)] bg-[rgba(139,92,246,0.12)] px-3 py-1 text-[11px] font-semibold text-[#c4b5fd] shadow-[0_0_20px_-4px_rgba(139,92,246,0.4)]"
              />
            </motion.span>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-10 w-10 rounded-xl text-[#a1a1aa] transition-colors hover:bg-[rgba(139,92,246,0.1)] hover:text-white"
          >
            {theme === "dark" ? <Sun className="h-[18px] w-[18px] text-amber-300" /> : <Moon className="h-[18px] w-[18px]" />}
          </Button>

          <Link href="/dashboard/notifications">
            <Button
              variant="ghost"
              size="icon"
              className="relative h-10 w-10 rounded-xl text-[#a1a1aa] transition-colors hover:bg-[rgba(139,92,246,0.1)] hover:text-white"
            >
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-violet-500 ring-2 ring-[#0b0b12] bm-glow-pulse" />
            </Button>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleActivity}
            className={cn(
              "hidden h-10 w-10 rounded-xl text-[#a1a1aa] transition-all hover:bg-[rgba(139,92,246,0.1)] hover:text-white xl:inline-flex",
              activityOpen && "bg-[rgba(139,92,246,0.15)] text-[#c4b5fd] shadow-[0_0_20px_-4px_rgba(139,92,246,0.35)]"
            )}
          >
            <PanelRight className="h-[18px] w-[18px]" />
          </Button>
        </div>
      </div>
    </header>
  );
}
