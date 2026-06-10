"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Package,
  FileText,
  Wrench,
  Tags,
  Building2,
  Users,
  BarChart3,
  Bell,
  History,
  Settings,
  X,
  Sparkles,
  Zap,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import { isNavVisible } from "@/lib/auth/permissions";

const mobileNav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/assets", label: "Assets", icon: Package },
  { href: "/dashboard/requests", label: "Requests", icon: FileText },
  { href: "/dashboard/approvals", label: "Approvals", icon: FileText },
  { href: "/dashboard/allocations", label: "Allocations", icon: Layers },
  { href: "/dashboard/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/dashboard/inventory", label: "Stock", icon: Package },
  { href: "/dashboard/procurement", label: "Procurement", icon: Zap },
  { href: "/dashboard/purchase-orders", label: "POs", icon: BarChart3 },
  { href: "/dashboard/disposals", label: "Disposals", icon: Tags },
  { href: "/dashboard/categories", label: "Categories", icon: Tags },
  { href: "/dashboard/vendors", label: "Vendors", icon: Building2 },
  { href: "/dashboard/users", label: "Users", icon: Users },
  { href: "/dashboard/reports", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/notifications", label: "Alerts", icon: Bell },
  { href: "/dashboard/audit-logs", label: "Audit", icon: History },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNav({ open, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const { role } = useAuth();

  const filteredNav = mobileNav.filter((item) => isNavVisible(role, item.href));

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={onClose}
          />
          <motion.nav
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="bm-sidebar-panel fixed inset-y-0 left-0 z-50 w-[min(300px,85vw)] p-4 md:hidden"
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-white">Asset Command</span>
              </div>
              <button onClick={onClose} className="rounded-lg p-2 text-[#a1a1aa] hover:bg-[rgba(139,92,246,0.1)] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-1">
              {filteredNav.map((item) => {
                const active =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-all",
                      active
                        ? "bg-gradient-to-r from-violet-600/90 to-indigo-600/80 text-white bm-nav-active-glow"
                        : "text-[#a1a1aa] hover:bg-[rgba(139,92,246,0.08)] hover:text-[#f5f5f7]"
                    )}
                  >
                    <Icon className={cn("h-[18px] w-[18px]", active ? "text-white" : "text-[#a1a1aa]")} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  );
}
