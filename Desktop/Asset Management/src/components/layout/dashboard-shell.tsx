"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ActivityPanel } from "@/components/layout/activity-panel";
import { PageTransition } from "@/components/enterprise/page-transition";
import { MobileNav } from "@/components/layout/mobile-nav";
import { CommandPalette } from "@/components/enterprise/command-palette";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [activityOpen, setActivityOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  return (
    <div className="bm-shell relative flex h-screen overflow-hidden">
      <div className="bm-shell-grid pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute -left-32 top-0 h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-[400px] w-[400px] rounded-full bg-indigo-600/8 blur-[100px]" />

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <Sidebar />
      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar
          activityOpen={activityOpen}
          onToggleActivity={() => setActivityOpen((v) => !v)}
          onToggleMobileNav={() => setMobileNavOpen(true)}
          onOpenCommandPalette={() => setCommandOpen(true)}
        />

        <div className="flex min-h-0 flex-1 gap-0">
          <main className="min-w-0 flex-1 overflow-y-auto px-4 pb-6 scrollbar-thin bm-fade-in">
            <PageTransition>{children}</PageTransition>
          </main>
          <ActivityPanel open={activityOpen} />
        </div>
      </div>
    </div>
  );
}
