'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { canAccessRoute } from '@/lib/auth/permissions';
import { Skeleton } from '@/components/common/Skeleton';
import { ErrorAlert } from '@/components/common/ErrorAlert';

export function RouteAccessGuard({ children }: { children: React.ReactNode }) {
  const { user, role, profile, profileError, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const blockedStatus =
    profile?.status === 'Invited' ||
    profile?.status === 'Pending' ||
    profile?.status === 'Suspended';
  const allowed = !blockedStatus && canAccessRoute(role, pathname, profile?.id);

  useEffect(() => {
    if (!loading && user && blockedStatus) {
      router.replace(profile?.status === 'Invited' ? '/activate-account' : '/login');
      return;
    }
    if (!loading && role && !allowed) {
      router.replace('/dashboard');
    }
  }, [loading, user, role, allowed, blockedStatus, profile?.status, router]);

  if (loading) {
    return (
      <div className="space-y-4 p-2">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (user && blockedStatus) {
    return (
      <div className="p-4">
        <ErrorAlert
          message={
            profile?.status === 'Suspended'
              ? 'Your account is suspended. Contact an administrator.'
              : 'Complete account activation before accessing the dashboard.'
          }
        />
      </div>
    );
  }

  if (user && !role) {
    return (
      <div className="p-4">
        <ErrorAlert
          message={
            profileError ??
            'Your account is signed in but no role profile was found. Try signing out and back in, or contact an administrator.'
          }
        />
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
