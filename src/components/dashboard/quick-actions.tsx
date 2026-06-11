'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  BarChart3,
  Building2,
  FileText,
  Package,
  Tags,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const actions = [
  {
    href: '/dashboard/assets/new',
    label: 'Register Asset',
    shortcut: 'A',
    icon: Package,
    grad: 'from-violet-600/30 to-violet-900/10',
    iconColor: 'text-violet-300',
    border: 'hover:border-violet-500/40',
  },
  {
    href: '/dashboard/requests/new',
    label: 'Create Request',
    shortcut: 'R',
    icon: FileText,
    grad: 'from-blue-600/30 to-blue-900/10',
    iconColor: 'text-blue-300',
    border: 'hover:border-blue-500/40',
  },
  {
    href: '/dashboard/maintenance/new',
    label: 'Schedule Maintenance',
    shortcut: 'M',
    icon: Wrench,
    grad: 'from-amber-600/30 to-amber-900/10',
    iconColor: 'text-amber-300',
    border: 'hover:border-amber-500/40',
  },
  {
    href: '/dashboard/vendors/new',
    label: 'Create Vendor',
    shortcut: 'V',
    icon: Building2,
    grad: 'from-cyan-600/30 to-cyan-900/10',
    iconColor: 'text-cyan-300',
    border: 'hover:border-cyan-500/40',
  },
  {
    href: '/dashboard/categories/new',
    label: 'Create Category',
    shortcut: 'C',
    icon: Tags,
    grad: 'from-emerald-600/30 to-emerald-900/10',
    iconColor: 'text-emerald-300',
    border: 'hover:border-emerald-500/40',
  },
  {
    href: '/dashboard/reports',
    label: 'Generate Report',
    shortcut: 'G',
    icon: BarChart3,
    grad: 'from-rose-600/30 to-rose-900/10',
    iconColor: 'text-rose-300',
    border: 'hover:border-rose-500/40',
  },
];

export function QuickActionsPanel() {
  return (
    <div className="ops-glass-card ops-card-hover bm-card-hover rounded-2xl border border-[rgba(139,92,246,0.15)] p-5 md:p-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
        {actions.map((action, i) => {
          const Icon = action.icon;
          return (
            <Link key={action.href} href={action.href} className="cursor-pointer">
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                className={cn(
                  'group relative flex min-h-[7.75rem] flex-col justify-between overflow-hidden rounded-xl border border-[rgba(139,92,246,0.12)] bg-gradient-to-br p-4 transition-all duration-200',
                  action.grad,
                  action.border,
                  'hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-500/12'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.1] bg-black/30 transition-colors duration-200 group-hover:border-white/[0.2] group-hover:bg-black/50">
                    <Icon className={cn('h-5 w-5', action.iconColor)} />
                  </div>
                  <kbd className="rounded-md border border-white/[0.1] bg-black/40 px-1.5 py-0.5 font-mono text-[10px] ops-text-muted">
                    ⌘{action.shortcut}
                  </kbd>
                </div>
                <p className="text-sm font-semibold text-white">{action.label}</p>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
