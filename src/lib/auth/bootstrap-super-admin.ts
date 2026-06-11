import { supabaseAdmin } from '@/lib/supabase/admin';
import { logAuthEvent } from '@/lib/auth/auth-log';

let bootstrapPromise: Promise<void> | null = null;

/**
 * Ensures the Super Admin auth account + users row exist.
 * Creates the account if missing. Does not reset password after first creation.
 */
export async function bootstrapSuperAdmin(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.SUPER_ADMIN_PASSWORD;

    if (!email || !password) return;

    const { data: byEmail } = await supabaseAdmin
      .from('users')
      .select('id, auth_id, role')
      .eq('email', email)
      .maybeSingle();

    let authId = byEmail?.auth_id ?? null;

    if (!authId) {
      const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      authId = authList?.users.find((user) => user.email?.toLowerCase() === email)?.id ?? null;
    }

    if (!authId) {
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: 'Super', last_name: 'Admin', role: 'Admin' },
      });

      if (createError) {
        const exists = createError.message.toLowerCase().includes('already been registered');
        if (exists) {
          const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          authId = authList?.users.find((user) => user.email?.toLowerCase() === email)?.id ?? null;
        } else {
          logAuthEvent('profile-sync', {
            step: 'bootstrap-super-admin-auth-error',
            error: createError.message,
          });
        }
      } else {
        authId = created.user?.id ?? null;
      }
    }

    if (authId && password && process.env.NODE_ENV === 'development') {
      const { error: passwordSyncError } = await supabaseAdmin.auth.admin.updateUserById(authId, {
        password,
        email_confirm: true,
      });
      if (passwordSyncError) {
        logAuthEvent('profile-sync', {
          step: 'bootstrap-super-admin-password-sync',
          error: passwordSyncError.message,
        });
      }
    }

    const profileRow = {
      email,
      first_name: 'Super',
      last_name: 'Admin',
      department: 'Executive',
      role: 'Super_Admin',
      updated_at: new Date().toISOString(),
      ...(authId ? { auth_id: authId } : {}),
    };

    if (byEmail?.id) {
      const { error } = await supabaseAdmin.from('users').update(profileRow).eq('id', byEmail.id);
      if (error) {
        await supabaseAdmin.from('users').update({ ...profileRow, role: 'Admin' }).eq('id', byEmail.id);
      }
    } else {
      const { error: insertError } = await supabaseAdmin.from('users').insert(profileRow);
      if (insertError?.code === '23505') {
        await supabaseAdmin.from('users').update(profileRow).eq('email', email);
      } else if (insertError) {
        await supabaseAdmin.from('users').insert({ ...profileRow, role: 'Admin' });
      }
    }

    logAuthEvent('profile-sync', { step: 'bootstrap-super-admin-complete', email, authId });
  })();

  return bootstrapPromise;
}
