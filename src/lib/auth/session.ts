import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { AppRole } from './roles';
import { isAppRole } from './roles';
import { ensureUserProfile, toUserProfile } from './user-profile-sync';
import { isMissingAuthIdColumnError } from './users-schema';
import { getDemoSessionServer } from './demo-session-server';
import type { DemoSession } from './demo-session';
import { logAuthEvent, serializeAuthError } from './auth-log';

export type UserProfile = {
  id: string;
  auth_id: string;
  email: string;
  first_name: string;
  last_name: string;
  department: string | null;
  role: AppRole;
  status?: string;
  last_login?: string | null;
  created_at: string;
  updated_at: string;
};

export async function getSessionUser() {
  const supabase = await createClient();
  let authResponse: Awaited<ReturnType<typeof supabase.auth.getUser>>;
  try {
    authResponse = await supabase.auth.getUser();
  } catch (err) {
    console.error('[session] getCurrentUser threw', {
      error: err,
      stack: err instanceof Error ? err.stack : undefined,
    });
    logAuthEvent('login', {
      step: 'session.getCurrentUser.throw',
      message: err instanceof Error ? err.message : String(err ?? 'Unknown session error'),
      name: err instanceof Error ? err.name : 'UnknownError',
      stack: err instanceof Error ? err.stack : undefined,
    });
    return { user: null, profile: null };
  }

  const {
    data: { user },
    error,
  } = authResponse;

  if (error) {
    console.error('[session] getCurrentUser returned error', {
      error: serializeAuthError(error),
      stack: new Error().stack,
    });
    logAuthEvent('login', {
      step: 'session.getCurrentUser.error',
      error: serializeAuthError(error),
      stack: new Error().stack,
    });
  }

  if (!error && user) {
    const profile =
      (await getProfileByAuthId(user.id, user.email ?? undefined)) ??
      (await ensureUserProfile(user)).profile;
    return { user, profile };
  }

  if (process.env.NEXT_PUBLIC_DEMO_AUTH === 'true') {
    const demo = await getDemoSessionServer();
    if (demo) {
      const profile = await getDemoProfileBySession(demo);
      return {
        user: { id: profile?.auth_id ?? 'demo-session', email: demo.email },
        profile,
      };
    }
  }

  return { user: null, profile: null };
}

async function getDemoProfileBySession(session: DemoSession): Promise<UserProfile | null> {
  const email = session.email.trim().toLowerCase();
  const byEmail = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (byEmail.data) {
    const role = isAppRole(session.role) ? session.role : (byEmail.data.role as AppRole);
    return { ...(byEmail.data as UserProfile), role };
  }

  const byRole = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('role', session.role)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (byRole.data) {
    return { ...(byRole.data as UserProfile), role: session.role as AppRole };
  }

  const fallback = await supabaseAdmin
    .from('users')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fallback.data) {
    return { ...(fallback.data as UserProfile), role: session.role as AppRole };
  }

  return null;
}

export async function getProfileByAuthId(
  authId: string,
  email?: string
): Promise<UserProfile | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('auth_id', authId)
    .maybeSingle();

  if (!error && data) {
    return toUserProfile(data as Record<string, unknown>);
  }

  if (isMissingAuthIdColumnError(error) && email) {
    const { data: byEmail } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (byEmail) {
      return toUserProfile({ ...byEmail, auth_id: authId } as Record<string, unknown>);
    }
  }

  return null;
}

