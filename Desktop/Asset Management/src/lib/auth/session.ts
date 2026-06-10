import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { AppRole } from './roles';
import { isAppRole } from './roles';
import { getDemoSessionServer } from './demo-session-server';
import type { DemoSession } from './demo-session';

export type UserProfile = {
  id: string;
  auth_id: string;
  email: string;
  first_name: string;
  last_name: string;
  department: string | null;
  role: AppRole;
  created_at: string;
  updated_at: string;
};

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!error && user) {
    const profile = await getProfileByAuthId(user.id);
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

export async function getProfileByAuthId(authId: string): Promise<UserProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', authId)
    .maybeSingle();
  if (error || !data) return null;
  const role = isAppRole(data.role) ? data.role : 'Employee';
  return { ...(data as UserProfile), role };
}
