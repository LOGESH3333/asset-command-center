import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { UserProfile } from '@/lib/auth/session';
import type { AppRole } from '@/lib/auth/roles';
import { isAppRole } from '@/lib/auth/roles';
import { logAuthEvent } from '@/lib/auth/auth-log';
import { isLegacyRequiredColumnError, isMissingAuthIdColumnError } from '@/lib/auth/users-schema';
import {
  isSuperAdminEmail,
  roleForDatabase,
  roleFromDatabase,
  isRoleEnumError,
} from '@/lib/auth/role-db';

type EnsureProfileInput = {
  authId: string;
  email: string;
  first_name?: string;
  last_name?: string;
  department?: string | null;
  roleOverride?: AppRole;
};

function formatProfileDatabaseError(
  step: string,
  error: { message?: string; code?: string; details?: string | null; hint?: string | null } | null | undefined
): string {
  return [
    `step: ${step}`,
    `message: ${error?.message ?? 'Unknown profile database error'}`,
    `code: ${error?.code ?? 'n/a'}`,
    `status: n/a`,
    `name: PostgrestError`,
    `details: ${error?.details ?? 'n/a'}`,
    `hint: ${error?.hint ?? 'n/a'}`,
    `stack: ${new Error().stack ?? 'n/a'}`,
  ].join(' | ');
}

export function normalizeStoredRole(role: string | null | undefined): AppRole {
  return roleFromDatabase(role);
}

export function toUserProfile(row: Record<string, unknown>): UserProfile {
  const email = String(row.email ?? '');
  return {
    id: String(row.id),
    auth_id: String(row.auth_id ?? ''),
    email,
    first_name: String(row.first_name ?? ''),
    last_name: String(row.last_name ?? ''),
    department: row.department ? String(row.department) : null,
    role: roleFromDatabase(row.role as string | undefined, email),
    status: row.status ? String(row.status) : 'Active',
    last_login: row.last_login ? String(row.last_login) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

function createVirtualSuperAdminProfile(input: EnsureProfileInput): UserProfile {
  const now = new Date().toISOString();
  return {
    id: input.authId,
    auth_id: input.authId,
    email: input.email,
    first_name: input.first_name || 'Super',
    last_name: input.last_name || 'Admin',
    department: input.department ?? 'Executive',
    role: 'Super_Admin',
    status: 'Active',
    last_login: now,
    created_at: now,
    updated_at: now,
  };
}

export async function resolveDefaultRoleForNewUser(email?: string): Promise<AppRole> {
  if (email && isSuperAdminEmail(email)) return 'Super_Admin';

  const { count, error } = await supabaseAdmin
    .from('users')
    .select('id', { count: 'exact', head: true });

  if (error) {
    logAuthEvent('signup-server', { resolveDefaultRoleError: error.message });
    return 'Employee';
  }

  return (count ?? 0) === 0 ? 'Super_Admin' : 'Employee';
}

function profileFromAuthUser(user: User): EnsureProfileInput {
  const meta = user.user_metadata ?? {};
  return {
    authId: user.id,
    email: (user.email ?? '').trim().toLowerCase(),
    first_name: typeof meta.first_name === 'string' ? meta.first_name : user.email?.split('@')[0] ?? '',
    last_name: typeof meta.last_name === 'string' ? meta.last_name : '',
    department: typeof meta.department === 'string' ? meta.department : null,
    roleOverride: isAppRole(meta.role) ? meta.role : undefined,
  };
}

async function ensureUserProfileByEmailOnly(
  input: EnsureProfileInput
): Promise<{ profile: UserProfile | null; error?: string }> {
  const email = input.email.trim().toLowerCase();
  const appRole = input.roleOverride ?? (await resolveDefaultRoleForNewUser(email));
  const dbRole = roleForDatabase(appRole);

  const { data: byEmail, error: byEmailError } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (byEmailError) {
    return { profile: null, error: formatProfileDatabaseError('ensureUserProfile.emailOnly.lookupByEmail', byEmailError) };
  }

  if (byEmail) {
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        ...(input.roleOverride ? { role: dbRole } : {}),
        first_name: byEmail.first_name || input.first_name || email.split('@')[0],
        last_name: byEmail.last_name || input.last_name || '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', byEmail.id)
      .select()
      .single();

    if (updateError && isRoleEnumError(updateError)) {
      return {
        profile: toUserProfile({
          ...byEmail,
          auth_id: input.authId,
          role: 'Admin',
        } as Record<string, unknown>),
      };
    }

    if (updateError && isLegacyRequiredColumnError(updateError) && isSuperAdminEmail(email)) {
      return { profile: createVirtualSuperAdminProfile(input) };
    }

    if (updateError) {
      console.error('[profile-sync] email-only users update failed', {
        email,
        authId: input.authId,
        error: updateError,
      });
      return {
        profile: null,
        error: formatProfileDatabaseError('ensureUserProfile.emailOnly.updateExistingProfile', updateError),
      };
    }

    return {
      profile: toUserProfile({ ...(updated ?? byEmail), auth_id: input.authId } as Record<string, unknown>),
    };
  }

  const { data: created, error: createError } = await supabaseAdmin
    .from('users')
    .insert({
      email,
      first_name: input.first_name || email.split('@')[0],
      last_name: input.last_name || '',
      department: input.department ?? null,
      role: dbRole,
    })
    .select()
    .single();

  if (createError) {
    console.error('[profile-sync] email-only users insert failed', {
      email,
      authId: input.authId,
      payload: {
        email,
        first_name: input.first_name || email.split('@')[0],
        last_name: input.last_name || '',
        department: input.department ?? null,
        role: dbRole,
      },
      error: createError,
    });

    if (createError.code === '23505') {
      const { data: existing } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      if (existing) {
        return {
          profile: toUserProfile({ ...existing, auth_id: input.authId } as Record<string, unknown>),
        };
      }
    }
    if (isRoleEnumError(createError)) {
      const { data: retry } = await supabaseAdmin
        .from('users')
        .insert({
          email,
          first_name: input.first_name || email.split('@')[0],
          last_name: input.last_name || '',
          department: input.department ?? null,
          role: 'Admin',
        })
        .select()
        .single();
      if (retry) {
        return { profile: toUserProfile({ ...retry, auth_id: input.authId } as Record<string, unknown>) };
      }
    }
    if (isLegacyRequiredColumnError(createError) && isSuperAdminEmail(email)) {
      return { profile: createVirtualSuperAdminProfile(input) };
    }
    return { profile: null, error: formatProfileDatabaseError('ensureUserProfile.emailOnly.insertProfile', createError) };
  }

  return {
    profile: toUserProfile({ ...created, auth_id: input.authId } as Record<string, unknown>),
  };
}

export async function ensureUserProfile(
  user: User | EnsureProfileInput
): Promise<{ profile: UserProfile | null; error?: string }> {
  const input = 'authId' in user ? user : profileFromAuthUser(user);
  const email = input.email.trim().toLowerCase();

  if (!input.authId || !email) {
    return {
      profile: null,
      error: [
        'step: ensureUserProfile.inputValidation',
        'message: Authenticated user is missing id or email.',
        'code: missing_auth_identity',
        'status: n/a',
        'name: ProfileSyncError',
        `stack: ${new Error().stack ?? 'n/a'}`,
      ].join(' | '),
    };
  }

  const { data: byAuth, error: byAuthError } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('auth_id', input.authId)
    .maybeSingle();

  if (byAuthError && isMissingAuthIdColumnError(byAuthError)) {
    logAuthEvent('profile-sync', { step: 'legacy-email-fallback', email, reason: byAuthError.message });
    return ensureUserProfileByEmailOnly(input);
  }

  if (byAuthError) {
    return { profile: null, error: formatProfileDatabaseError('ensureUserProfile.lookupByAuthId', byAuthError) };
  }

  if (byAuth) {
    return { profile: toUserProfile(byAuth as Record<string, unknown>) };
  }

  const { data: byEmail, error: byEmailError } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (byEmailError) {
    return { profile: null, error: formatProfileDatabaseError('ensureUserProfile.lookupByEmail', byEmailError) };
  }

  const appRole =
    input.roleOverride ??
    (isAppRole(byEmail?.role as string) ? (byEmail!.role as AppRole) : await resolveDefaultRoleForNewUser(email));

  if (byEmail) {
    const { data: linked, error: linkError } = await supabaseAdmin
      .from('users')
      .update({
        auth_id: input.authId,
        email,
        first_name: byEmail.first_name || input.first_name || email.split('@')[0],
        last_name: byEmail.last_name || input.last_name || '',
        department: byEmail.department ?? input.department ?? null,
        ...(input.roleOverride ? { role: roleForDatabase(appRole) } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', byEmail.id)
      .select()
      .single();

    if (linkError && isMissingAuthIdColumnError(linkError)) {
      return ensureUserProfileByEmailOnly(input);
    }
    if (linkError && isRoleEnumError(linkError)) {
      return ensureUserProfileByEmailOnly(input);
    }
    if (linkError && isLegacyRequiredColumnError(linkError) && isSuperAdminEmail(email)) {
      return { profile: createVirtualSuperAdminProfile(input) };
    }
    if (linkError) {
      console.error('[profile-sync] users email link failed', {
        email,
        authId: input.authId,
        existingUserId: byEmail.id,
        error: linkError,
      });
      return { profile: null, error: formatProfileDatabaseError('ensureUserProfile.linkExistingProfile', linkError) };
    }

    return { profile: toUserProfile(linked as Record<string, unknown>) };
  }

  const { data: created, error: createError } = await supabaseAdmin
    .from('users')
    .insert({
      auth_id: input.authId,
      email,
      first_name: input.first_name || email.split('@')[0],
      last_name: input.last_name || '',
      department: input.department ?? null,
      role: roleForDatabase(appRole),
    })
    .select()
    .single();

  if (createError && (isMissingAuthIdColumnError(createError) || isRoleEnumError(createError))) {
    return ensureUserProfileByEmailOnly(input);
  }

  if (createError) {
    console.error('[profile-sync] users insert failed', {
      email,
      authId: input.authId,
      payload: {
        auth_id: input.authId,
        email,
        first_name: input.first_name || email.split('@')[0],
        last_name: input.last_name || '',
        department: input.department ?? null,
        role: roleForDatabase(appRole),
      },
      error: createError,
    });

    if (createError.code === '23505') {
      return ensureUserProfileByEmailOnly(input);
    }
    if (isLegacyRequiredColumnError(createError) && isSuperAdminEmail(email)) {
      return { profile: createVirtualSuperAdminProfile(input) };
    }
    return { profile: null, error: formatProfileDatabaseError('ensureUserProfile.insertProfile', createError) };
  }

  return { profile: toUserProfile(created as Record<string, unknown>) };
}
