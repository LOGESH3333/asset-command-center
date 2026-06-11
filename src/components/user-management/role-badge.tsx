import { cn } from '@/lib/utils';
import type { AppRole } from '@/lib/auth/roles';
import { formatRoleLabel } from '@/lib/auth/roles';

const roleStyles: Record<string, string> = {
  Super_Admin:
    'bg-purple-500/15 text-purple-300 border-purple-500/30',
  Admin:
    'bg-blue-500/15 text-blue-300 border-blue-500/30',
  Manager:
    'bg-orange-500/15 text-orange-300 border-orange-500/30',
  Employee:
    'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

export function RoleBadge({ role, className }: { role: AppRole | string; className?: string }) {
  const key = role in roleStyles ? role : 'Employee';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide',
        roleStyles[key],
        className
      )}
    >
      {formatRoleLabel(role as AppRole)}
    </span>
  );
}
