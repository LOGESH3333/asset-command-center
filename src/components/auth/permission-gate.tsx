'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { isSuperAdmin, type AppRole } from '@/lib/auth/roles';

type PermissionGateProps = {
  allowed: AppRole[];
  children: ReactNode;
  fallback?: ReactNode;
};

/** Hide UI affordances when the current role is not permitted. */
export function PermissionGate({ allowed, children, fallback = null }: PermissionGateProps) {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (isSuperAdmin(role)) return <>{children}</>;
  if (!role || !allowed.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}
