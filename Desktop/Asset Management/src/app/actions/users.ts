'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { canManageUsers } from '@/lib/auth/roles';
import type { AppRole } from '@/lib/auth/roles';

export type SyncedUser = {
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

async function requireAdmin() {
  const { profile } = await getSessionUser();
  if (!profile || !canManageUsers(profile.role)) {
    throw new Error('Unauthorized: Admin access required.');
  }
  return profile;
}

export async function syncCurrentUserAction(): Promise<{
  data?: SyncedUser;
  error?: string;
}> {
  try {
    const { user, profile } = await getSessionUser();
    if (!user) return { error: 'Not authenticated' };

    if (profile) return { data: profile as SyncedUser };

    const email = user.email?.toLowerCase() ?? '';
    const meta = 'user_metadata' in user ? (user.user_metadata ?? {}) : {};

    const { data: created, error } = await supabaseAdmin
      .from('users')
      .insert([
        {
          auth_id: user.id,
          email,
          first_name: meta.first_name ?? user.email?.split('@')[0] ?? '',
          last_name: meta.last_name ?? '',
          department: meta.department ?? null,
          role: 'Employee',
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        const { data: existing } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('auth_id', user.id)
          .maybeSingle();
        if (existing) return { data: existing as SyncedUser };
      }
      return { error: error.message };
    }

    return { data: created as SyncedUser };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to sync user' };
  }
}

export async function createUserAction(formData: {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  department?: string;
  role?: AppRole;
}) {
  try {
    await requireAdmin();
    const { first_name, last_name, email, password, department, role } = formData;
    const normalizedEmail = email.trim().toLowerCase();

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        first_name,
        last_name,
        department: department ?? '',
        role: role ?? 'Employee',
      },
    });

    if (authError) throw new Error(authError.message);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .upsert(
        {
          auth_id: authUser.user.id,
          email: normalizedEmail,
          first_name,
          last_name,
          department: department ?? null,
          role: role ?? 'Employee',
        },
        { onConflict: 'auth_id' }
      )
      .select()
      .single();

    if (profileError) throw new Error(profileError.message);

    revalidatePath('/dashboard/users');
    return { data: profile };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create user' };
  }
}

export async function updateUserAction(
  id: string,
  formData: {
    first_name: string;
    last_name: string;
    email: string;
    department?: string;
    role?: AppRole;
  }
) {
  try {
    await requireAdmin();
    const { first_name, last_name, email, department, role } = formData;

    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('auth_id')
      .eq('id', id)
      .single();

    if (existing?.auth_id) {
      await supabaseAdmin.auth.admin.updateUserById(existing.auth_id, {
        email: email.toLowerCase(),
        user_metadata: { first_name, last_name, department, role: role ?? 'Employee' },
      });
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        first_name,
        last_name,
        email: email.toLowerCase(),
        department: department ?? null,
        role: role ?? 'Employee',
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidatePath('/dashboard/users');
    revalidatePath(`/dashboard/users/${id}`);
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update user' };
  }
}

export async function deleteUserAction(id: string) {
  try {
    await requireAdmin();

    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('auth_id')
      .eq('id', id)
      .single();

    if (existing?.auth_id) {
      await supabaseAdmin.auth.admin.deleteUser(existing.auth_id);
    }

    const { error } = await supabaseAdmin.from('users').delete().eq('id', id);
    if (error) throw new Error(error.message);

    revalidatePath('/dashboard/users');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete user' };
  }
}
