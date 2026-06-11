'use client';

import { useAuth } from '@/components/auth/auth-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { LogOut, Settings, User } from 'lucide-react';
import { StatusBadge } from '@/components/enterprise/status-badge';

export function UserMenu() {
  const { user, profile, signOut } = useAuth();

  const initials = profile
    ? `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.toUpperCase() || 'U'
    : user?.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-3 rounded-xl p-1.5 outline-none transition-colors hover:bg-white/[0.04]">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-xs font-bold text-white shadow-lg shadow-violet-500/25">
          {initials}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-xl border-white/10">
        <DropdownMenuLabel className="space-y-1">
          <p className="text-sm font-semibold">
            {profile ? `${profile.first_name} ${profile.last_name}` : user?.email}
          </p>
          <p className="text-xs font-normal text-muted-foreground">{user?.email}</p>
          {profile?.role && (
            <div className="pt-1">
              <StatusBadge status={profile.role} />
            </div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Link href="/dashboard/settings" className="flex w-full items-center gap-2">
            <Settings className="h-4 w-4" /> Settings
          </Link>
        </DropdownMenuItem>
        {profile && (
          <DropdownMenuItem>
            <Link href={`/dashboard/users/${profile.id}`} className="flex w-full items-center gap-2">
              <User className="h-4 w-4" /> Profile
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
