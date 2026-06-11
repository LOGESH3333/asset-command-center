'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import type { AppRole } from '@/lib/auth/roles';
import { isSuperAdmin } from '@/lib/auth/roles';
import { Loader2Icon } from 'lucide-react';

type BrdRoleGateProps = {
  children: React.ReactNode;
  allowed: AppRole[];
  redirectTo?: string;
};

export function BrdRoleGate({ children, allowed, redirectTo = '/dashboard' }: BrdRoleGateProps) {
  const { role, loading } = useAuth();
  const router = useRouter();

  const permitted = role ? isSuperAdmin(role) || allowed.includes(role) : false;

  useEffect(() => {
    if (!loading && role && !permitted) {
      router.replace(redirectTo);
    }
  }, [loading, role, permitted, redirectTo, router]);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!role || !permitted) return null;

  return <>{children}</>;
}
