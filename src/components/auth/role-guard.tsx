'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import type { AppRole } from '@/lib/auth/roles';
import { isSuperAdmin } from '@/lib/auth/roles';
import { Skeleton } from '@/components/common/Skeleton';

type RoleGuardProps = {
  children: React.ReactNode;
  allowed: AppRole[];
  redirectTo?: string;
};

export function RoleGuard({ children, allowed, redirectTo = '/dashboard' }: RoleGuardProps) {
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
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!role || !permitted) {
    return null;
  }

  return <>{children}</>;
}
