'use server';

import { getSessionUser } from '@/lib/auth/session';
import type { AppRole } from '@/lib/auth/roles';

export async function requireBrdRole(allowed: AppRole[]) {
  const { profile } = await getSessionUser();
  if (!profile || !allowed.includes(profile.role)) {
    return { error: 'You do not have permission to perform this action.', profile: null };
  }
  return { profile, error: undefined };
}
