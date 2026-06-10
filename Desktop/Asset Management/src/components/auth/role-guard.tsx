'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import type { AppRole } from '@/lib/auth/roles';
import { Skeleton } from '@/components/common/Skeleton';

type RoleGuardProps = {
  children: React.ReactNode;
  allowed: AppRole[];
  redirectTo?: string;
};

export function RoleGuard({ children, allowed, redirectTo = '/dashboard' }: RoleGuardProps) {
  const { role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && role && !allowed.includes(role)) {
      router.replace(redirectTo);
    }
  }, [loading, role, allowed, redirectTo, router]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!role || !allowed.includes(role)) {
    return null;
  }

  return <>{children}</>;
}
