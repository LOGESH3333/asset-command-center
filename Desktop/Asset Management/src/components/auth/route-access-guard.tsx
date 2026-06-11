'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { canAccessRoute } from '@/lib/auth/permissions';
import { Skeleton } from '@/components/common/Skeleton';
import { ErrorAlert } from '@/components/common/ErrorAlert';

export function RouteAccessGuard({ children }: { children: React.ReactNode }) {
  const { role, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const allowed = canAccessRoute(role, pathname);

  useEffect(() => {
    if (!loading && role && !allowed) {
      router.replace('/dashboard');
    }
  }, [loading, role, allowed, router]);

  if (loading) {
    return (
      <div className="space-y-4 p-2">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="p-4">
        <ErrorAlert message="You do not have permission to access this module." />
      </div>
    );
  }

  return <>{children}</>;
}
