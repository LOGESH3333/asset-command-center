'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/auth/session';
import { logAuthEvent, normalizeAuthEmail, serializeAuthError } from '@/lib/auth/auth-log';
import { mapSignupError } from '@/lib/auth/errors';

export async function getAuthSessionAction() {
  return getSessionUser();
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return { success: true };
}

/** Resolve profile user id for notification scoping. */
export async function getCurrentUserIdAction(): Promise<string | null> {
  const { profile } = await getSessionUser();
  return profile?.id ?? null;
}

export async function getUsersByRolesAction(roles: string[]) {
  const { data } = await supabaseAdmin
    .from('users')
    .select('id, email, role')
    .in('role', roles);
  return data ?? [];
}

/**
 * Public signup — uses the same admin createUser path as Team Management,
 * with email_confirm: true so sign-in works immediately (no verification gate).
 */
export async function signUpAction(input: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}): Promise<{ success?: boolean; userId?: string; error?: string }> {
  const email = normalizeAuthEmail(input.email);

  logAuthEvent('signup-server', {
    email,
    provider: 'supabase-admin-createUser',
    email_confirm: true,
  });

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      first_name: input.first_name,
      last_name: input.last_name,
    },
  });

  logAuthEvent('signup-server', {
    email,
    response: {
      userId: data?.user?.id,
      emailConfirmedAt: data?.user?.email_confirmed_at,
      error: serializeAuthError(error),
    },
  });

  if (error) {
    return { error: mapSignupError(error.message) };
  }

  if (!data?.user?.id) {
    return { error: 'Unable to create account. Please try again.' };
  }

  // Trigger handle_new_user creates public.users; ensure row exists for edge cases
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('auth_id', data.user.id)
    .maybeSingle();

  if (!existing) {
    const { error: profileError } = await supabaseAdmin.from('users').upsert(
      {
        auth_id: data.user.id,
        email,
        first_name: input.first_name,
        last_name: input.last_name,
        role: 'Employee',
      },
      { onConflict: 'auth_id' }
    );
    if (profileError) {
      logAuthEvent('signup-server', {
        email,
        profileUpsertError: profileError.message,
      });
    }
  }

  return { success: true, userId: data.user.id };
}
