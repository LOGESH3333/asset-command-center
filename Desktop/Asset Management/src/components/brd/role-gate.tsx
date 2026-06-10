'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import type { AppRole } from '@/lib/auth/roles';
import { Loader2Icon } from 'lucide-react';

type BrdRoleGateProps = {
  children: React.ReactNode;
  allowed: AppRole[];
  redirectTo?: string;
};

export function BrdRoleGate({ children, allowed, redirectTo = '/dashboard' }: BrdRoleGateProps) {
  const { role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && role && !allowed.includes(role)) {
      router.replace(redirectTo);
    }
  }, [loading, role, allowed, redirectTo, router]);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!role || !allowed.includes(role)) return null;

  return <>{children}</>;
}
