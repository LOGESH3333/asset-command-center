"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Tags,
  Building2,
  FileText,
  Wrench,
  Users,
  Bell,
  History,
  Settings,
  Zap,
  Layers,
  LogOut,
  ClipboardCheck,
  ShoppingCart,
  Archive,
  LineChart,
  Boxes,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/auth/user-menu";
import { useAuth } from "@/components/auth/auth-provider";
import { isNavVisible } from "@/lib/auth/permissions";
import { BrandLogo } from "@/components/brand/brand-logo";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: "COMMAND CENTER",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "INVENTORY",
    items: [
      { href: "/dashboard/assets", label: "Assets", icon: Package },
      { href: "/dashboard/inventory", label: "Stock", icon: Boxes },
      { href: "/dashboard/categories", label: "Categories", icon: Tags },
      { href: "/dashboard/vendors", label: "Vendors", icon: Building2 },
    ],
  },
  {
    title: "REQUESTS",
    items: [
      { href: "/dashboard/requests", label: "Requests", icon: FileText },
      { href: "/dashboard/approvals", label: "Approvals", icon: ClipboardCheck },
    ],
  },
  {
    title: "LIFECYCLE",
    items: [
      { href: "/dashboard/allocations", label: "Allocations", icon: Layers },
      { href: "/dashboard/maintenance", label: "Maintenance", icon: Wrench },
      { href: "/dashboard/disposals", label: "Disposals", icon: Archive },
    ],
  },
  {
    title: "PROCUREMENT",
    items: [
      { href: "/dashboard/procurement", label: "Procurement", icon: Zap },
      { href: "/dashboard/purchase-orders", label: "Purchase Orders", icon: ShoppingCart },
    ],
  },
  {
    title: "INTELLIGENCE",
    items: [
      { href: "/dashboard/reports", label: "Executive Reports", icon: LineChart },
      { href: "/dashboard/notifications", label: "Alerts", icon: Bell },
      { href: "/dashboard/audit-logs", label: "Audit Trail", icon: History },
    ],
  },
  {
    title: "ADMINISTRATION",
    items: [
      { href: "/dashboard/users", label: "Team Management", icon: Users },
      { href: "/dashboard/user-management", label: "User Management", icon: Shield },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
];

function filterNavSections(role: ReturnType<typeof useAuth>["role"]) {
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => isNavVisible(role, item.href)),
    }))
    .filter((section) => section.items.length > 0);
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium leading-none transition-all duration-200",
        active
          ? "erp-nav-item-active text-white"
          : "text-[#a1a1aa] hover:bg-[#0b0b12] hover:text-white"
      )}
    >
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0",
          active ? "text-white" : "text-[#a1a1aa] group-hover:text-[#8b5cf6]"
        )}
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { profile, role, signOut } = useAuth();
  const sections = filterNavSections(role);

  return (
    <aside className="erp-sidebar relative z-30 hidden h-screen shrink-0 flex-col md:flex">
      {/* Brand */}
      <div className="shrink-0 border-b border-[rgba(var(--ror-purple-rgb),0.12)] px-5 py-4">
        <BrandLogo variant="sidebar" />
        {profile?.department && (
          <p className="mt-3 truncate rounded-md bg-[#0b0b12] px-3 py-1.5 text-xs font-medium text-[#a1a1aa] ring-1 ring-[rgba(var(--ror-purple-rgb),0.12)]">
            {profile.department}
          </p>
        )}
      </div>

      {/* Navigation — flat, always labeled, no collapse */}
      <nav className="erp-sidebar-nav min-h-0 flex-1 px-3 py-3">
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#a1a1aa]">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} active={isActive(pathname, item.href)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* User profile */}
      <div className="shrink-0 border-t border-[rgba(139,92,246,0.12)] bg-[#05050a] p-4">
        <div className="rounded-xl border border-[rgba(139,92,246,0.15)] bg-[#0b0b12] p-3">
          <div className="flex items-center gap-3">
            <UserMenu />
            {profile && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {profile.first_name} {profile.last_name}
                </p>
                <p className="truncate text-xs font-medium text-[#8b5cf6]">{profile.role}</p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="mt-3 h-9 w-full justify-start gap-2 rounded-lg text-[#a1a1aa] hover:bg-[rgba(139,92,246,0.1)] hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </aside>
  );
}
