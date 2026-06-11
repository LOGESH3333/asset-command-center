'use server';

import { getSessionUser } from '@/lib/auth/session';
import { isSuperAdmin, type AppRole } from '@/lib/auth/roles';

export async function requireBrdRole(allowed: AppRole[]) {
  const { profile } = await getSessionUser();
  if (!profile || (!isSuperAdmin(profile.role) && !allowed.includes(profile.role))) {
    return { error: 'You do not have permission to perform this action.', profile: null };
  }
  return { profile, error: undefined };
}
