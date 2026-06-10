'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import type { AppRole } from '@/lib/auth/roles';

type PermissionGateProps = {
  allowed: AppRole[];
  children: ReactNode;
  fallback?: ReactNode;
};

/** Hide UI affordances when the current role is not permitted. */
export function PermissionGate({ allowed, children, fallback = null }: PermissionGateProps) {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (!role || !allowed.includes(role)) return <>{fallback}</>;
  if (role === 'Admin') return <>{children}</>;
  if (!allowed.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}
