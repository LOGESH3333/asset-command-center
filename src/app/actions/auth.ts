'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/auth/session';
import { logAuthEvent, logLoginStep, normalizeAuthEmail, serializeAuthError } from '@/lib/auth/auth-log';
import { mapSignupError } from '@/lib/auth/errors';
import { ensureUserProfile } from '@/lib/auth/user-profile-sync';
import { isSuperAdmin, canManageUsers } from '@/lib/auth/roles';

function formatAuthFlowError(
  step: string,
  error: { message?: string; code?: string; status?: number; name?: string; stack?: string } | null | undefined
): string {
  return [
    `step: ${step}`,
    `message: ${error?.message ?? 'Unknown auth error'}`,
    `code: ${error?.code ?? 'n/a'}`,
    `status: ${error?.status ?? 'n/a'}`,
    `name: ${error?.name ?? 'n/a'}`,
    `stack: ${error?.stack ?? 'n/a'}`,
  ].join(' | ');
}

function formatDatabaseFlowError(
  step: string,
  error: { message?: string; code?: string; details?: string | null; hint?: string | null; stack?: string } | null | undefined
): string {
  return [
    `step: ${step}`,
    `message: ${error?.message ?? 'Unknown database error'}`,
    `code: ${error?.code ?? 'n/a'}`,
    `status: n/a`,
    `name: PostgrestError`,
    `details: ${error?.details ?? 'n/a'}`,
    `hint: ${error?.hint ?? 'n/a'}`,
    `stack: ${error?.stack ?? 'n/a'}`,
  ].join(' | ');
}

function formatProfileFlowError(step: string, message: string, code: string, stack?: string): string {
  return [
    `step: ${step}`,
    `message: ${message}`,
    `code: ${code}`,
    `status: n/a`,
    `name: ProfileSyncError`,
    `stack: ${stack ?? 'n/a'}`,
  ].join(' | ');
}

export async function getAuthSessionAction() {
  return getSessionUser();
}

export async function signOutAction() {
  const { user, profile } = await getSessionUser();
  const supabase = await createClient();
  await supabase.auth.signOut();
  if (user && profile) {
    const { logAuthAuditEvent } = await import('@/lib/auth/audit-auth');
    await logAuthAuditEvent('Logout', { email: profile.email, user_id: profile.id });
  }
  return { success: true };
}

export async function postLoginAction(authId: string, email: string, loginId = 'server-login-unknown') {
  try {
    logLoginStep(loginId, 'postLoginAction', 'START', { authId, email });
    const supabase = await createClient();
    let currentUserResponse: Awaited<ReturnType<typeof supabase.auth.getUser>>;
    try {
      logLoginStep(loginId, 'getUser', 'START', { authId, email });
      currentUserResponse = await supabase.auth.getUser();
      logLoginStep(loginId, 'getUser', 'SUCCESS', {
        authId,
        email,
        userId: currentUserResponse.data.user?.id ?? null,
        error: serializeAuthError(currentUserResponse.error),
      });
    } catch (err) {
      logLoginStep(loginId, 'getUser', 'FAILED', {
        email,
        authId,
        error: err,
        stack: err instanceof Error ? err.stack : undefined,
      });
      throw err;
    }

    const {
      data: { user },
      error: sessionError,
    } = currentUserResponse;

    logAuthEvent('login', {
      step: 'getCurrentUser',
      email,
      authId,
      sessionUserId: user?.id ?? null,
      error: serializeAuthError(sessionError),
    });

    if (sessionError) {
      logLoginStep(loginId, 'getUser', 'FAILED', {
        error: sessionError,
        stack: sessionError.stack,
      });
      return { error: formatAuthFlowError('getCurrentUser', sessionError) };
    }

    if (!user || user.id !== authId) {
      logLoginStep(loginId, 'getUser', 'FAILED', {
        message: `Session user mismatch. Expected ${authId}, received ${user?.id ?? 'none'}.`,
        code: 'session_user_mismatch',
      });
      return {
        error: formatAuthFlowError('getCurrentUser.sessionIdentity', {
          message: `Session user mismatch. Expected ${authId}, received ${user?.id ?? 'none'}.`,
          code: 'session_user_mismatch',
          status: 401,
          name: 'SessionIdentityError',
        }),
      };
    }

    const normalizedEmail = email.trim().toLowerCase();
    let ensuredProfile: Awaited<ReturnType<typeof ensureUserProfile>>;
    try {
      logLoginStep(loginId, 'ensureUserProfile', 'START', {
        authId,
        email: normalizedEmail,
      });
      ensuredProfile = await ensureUserProfile(user);
      logLoginStep(loginId, 'ensureUserProfile', 'SUCCESS', {
        authId,
        email: normalizedEmail,
        profileId: ensuredProfile.profile?.id ?? null,
        role: ensuredProfile.profile?.role ?? null,
        status: ensuredProfile.profile?.status ?? null,
        error: ensuredProfile.error ?? null,
      });
    } catch (err) {
      logLoginStep(loginId, 'ensureUserProfile', 'FAILED', {
        email: normalizedEmail,
        authId,
        error: err,
        stack: err instanceof Error ? err.stack : undefined,
      });
      throw err;
    }

    logAuthEvent('login', {
      step: 'ensureUserProfile',
      email: normalizedEmail,
      authId,
      profileId: ensuredProfile.profile?.id ?? null,
      role: ensuredProfile.profile?.role ?? null,
      status: ensuredProfile.profile?.status ?? null,
      error: ensuredProfile.error ?? null,
    });

    if (ensuredProfile.error || !ensuredProfile.profile) {
      logLoginStep(loginId, 'ensureUserProfile', 'FAILED', {
        error: ensuredProfile.error ?? 'No profile returned',
      });
      return {
        error: formatProfileFlowError(
          'ensureUserProfile',
          ensuredProfile.error ?? `No public.users profile found or created for ${normalizedEmail}.`,
          ensuredProfile.error ? 'profile_sync_failed' : 'profile_not_found',
          new Error().stack
        ),
      };
    }

    let userRow: { id?: string; status?: string; role?: string; auth_id?: string | null; email?: string } | null = null;

    logLoginStep(loginId, 'profile lookup', 'START', {
      authId,
      email: normalizedEmail,
    });
    const byAuth = await supabaseAdmin
      .from('users')
      .select('id, auth_id, email, status, role')
      .eq('auth_id', authId)
      .maybeSingle();
    logLoginStep(loginId, 'profile lookup', 'SUCCESS', {
      authId,
      email: normalizedEmail,
      found: Boolean(byAuth.data),
      data: byAuth.data,
      error: byAuth.error
        ? {
            message: byAuth.error.message,
            code: byAuth.error.code,
            details: byAuth.error.details,
            hint: byAuth.error.hint,
          }
        : null,
    });

    logAuthEvent('login', {
      step: 'postLogin.profileLookupByAuthId',
      email: normalizedEmail,
      authId,
      found: Boolean(byAuth.data),
      error: byAuth.error ? {
        message: byAuth.error.message,
        code: byAuth.error.code,
      } : null,
    });

    if (byAuth.error) {
      logLoginStep(loginId, 'profile lookup', 'FAILED', {
        error: byAuth.error,
        stack: byAuth.error.stack,
      });
      return { error: formatDatabaseFlowError('postLogin.profileLookupByAuthId', byAuth.error) };
    }

    if (!byAuth.error && byAuth.data) {
      userRow = byAuth.data;
    } else {
      logLoginStep(loginId, 'profile lookup', 'START', {
        fallback: 'email',
        authId,
        email: normalizedEmail,
      });
      const byEmail = await supabaseAdmin
        .from('users')
        .select('id, auth_id, email, status, role')
        .eq('email', normalizedEmail)
        .maybeSingle();
      logLoginStep(loginId, 'profile lookup', 'SUCCESS', {
        fallback: 'email',
        authId,
        email: normalizedEmail,
        found: Boolean(byEmail.data),
        data: byEmail.data,
        error: byEmail.error
          ? {
              message: byEmail.error.message,
              code: byEmail.error.code,
              details: byEmail.error.details,
              hint: byEmail.error.hint,
            }
          : null,
      });

      logAuthEvent('login', {
        step: 'postLogin.profileLookupByEmail',
        email: normalizedEmail,
        authId,
        found: Boolean(byEmail.data),
        error: byEmail.error ? {
          message: byEmail.error.message,
          code: byEmail.error.code,
        } : null,
      });

      if (byEmail.error) {
        logLoginStep(loginId, 'profile lookup', 'FAILED', {
          error: byEmail.error,
          stack: byEmail.error.stack,
        });
        return { error: formatDatabaseFlowError('postLogin.profileLookupByEmail', byEmail.error) };
      }

      userRow = byEmail.data;
    }

    if (!userRow) {
      logLoginStep(loginId, 'profile lookup', 'FAILED', {
        message: `No public.users profile found for auth_id ${authId} or email ${normalizedEmail}.`,
        code: 'profile_not_found',
      });
      return {
        error: formatDatabaseFlowError('postLogin.profileLookup', {
          message: `No public.users profile found for auth_id ${authId} or email ${normalizedEmail}.`,
          code: 'profile_not_found',
        }),
      };
    }

    logLoginStep(loginId, 'role lookup', 'START', {
      authId,
      email: normalizedEmail,
      profileId: userRow.id ?? null,
    });
    logAuthEvent('login', {
      step: 'postLogin.roleLookup',
      email: normalizedEmail,
      authId,
      profileId: userRow.id,
      role: userRow.role ?? null,
      status: userRow.status ?? null,
    });
    logLoginStep(loginId, 'role lookup', 'SUCCESS', {
      authId,
      email: normalizedEmail,
      role: userRow.role ?? null,
      status: userRow.status ?? null,
      profileId: userRow.id ?? null,
    });

    if (!userRow.role) {
      logLoginStep(loginId, 'role lookup', 'FAILED', {
        message: `public.users profile ${userRow.id ?? '(unknown)'} has no role.`,
        code: 'role_missing',
      });
      return {
        error: formatDatabaseFlowError('postLogin.roleLookup', {
          message: `public.users profile ${userRow.id ?? '(unknown)'} has no role.`,
          code: 'role_missing',
        }),
      };
    }

    logLoginStep(loginId, 'status validation', 'START', {
      authId,
      email: normalizedEmail,
      status: userRow.status ?? null,
    });

    if (userRow?.status === 'Pending') {
      logLoginStep(loginId, 'status validation', 'FAILED', {
        authId,
        email: normalizedEmail,
        status: userRow.status,
      });
      await supabase.auth.signOut();
      return {
        error: formatDatabaseFlowError('postLogin.statusValidation', {
          message: 'Login blocked because public.users.status is Pending. Activate or approve this user before dashboard access.',
          code: 'user_status_pending',
        }),
      };
    }

    if (userRow?.status === 'Suspended') {
      logLoginStep(loginId, 'status validation', 'FAILED', {
        authId,
        email: normalizedEmail,
        status: userRow.status,
      });
      await supabase.auth.signOut();
      return {
        error: formatDatabaseFlowError('postLogin.statusValidation', {
          message: 'Your account has been suspended. Contact your administrator.',
          code: 'user_suspended',
        }),
      };
    }

    logLoginStep(loginId, 'status validation', 'SUCCESS', {
      authId,
      email: normalizedEmail,
      status: userRow.status ?? null,
    });

    if (userRow?.status === 'Invited') {
      logLoginStep(loginId, 'dashboard route selection', 'START', {
        authId,
        email: normalizedEmail,
      });
      logLoginStep(loginId, 'dashboard route selection', 'SUCCESS', {
        authId,
        email: normalizedEmail,
        redirect: '/activate-account',
      });
      logAuthEvent('login', {
        step: 'postLogin.redirect',
        email: normalizedEmail,
        redirect: '/activate-account',
      });
      return { redirect: '/activate-account' };
    }

    const { recordLoginAction } = await import('@/app/actions/user-management');
    logLoginStep(loginId, 'recordLoginAction', 'START', {
      authId,
      email: normalizedEmail,
    });
    const recordLogin = await recordLoginAction(authId, email, loginId);
    logLoginStep(loginId, 'recordLoginAction', 'SUCCESS', {
      authId,
      email: normalizedEmail,
      response: recordLogin,
    });
    if (recordLogin?.error) {
      logLoginStep(loginId, 'recordLoginAction', 'FAILED', recordLogin.error);
      return { error: recordLogin.error };
    }

    logLoginStep(loginId, 'dashboard route selection', 'START', {
      authId,
      email: normalizedEmail,
    });
    logLoginStep(loginId, 'dashboard route selection', 'SUCCESS', {
      authId,
      email: normalizedEmail,
      redirect: '/dashboard',
    });
    logAuthEvent('login', {
      step: 'postLogin.redirect',
      email: normalizedEmail,
      role: userRow.role,
      redirect: '/dashboard',
    });
    logLoginStep(loginId, 'postLoginAction', 'SUCCESS', {
      authId,
      email: normalizedEmail,
      redirect: '/dashboard',
    });
    return { success: true };
  } catch (err) {
    logLoginStep(loginId, 'postLoginAction', 'FAILED', {
      error: err,
      stack: err instanceof Error ? err.stack : undefined,
    });
    throw err;
  }
}

/** Resolve profile user id for notification scoping. */
export async function getCurrentUserIdAction(): Promise<string | null> {
  const { profile } = await getSessionUser();
  return profile?.id ?? null;
}

export async function getUsersByRolesAction(roles: string[]) {
  const { profile } = await getSessionUser();
  if (!profile || !canManageUsers(profile.role)) return [];

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

  const { profile: currentProfile } = await getSessionUser();
  if (!currentProfile || !isSuperAdmin(currentProfile.role)) {
    return { error: 'Public signup is disabled. Ask a Super Admin to invite this user.' };
  }

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

  const { profile, error: profileError } = await ensureUserProfile({
    authId: data.user.id,
    email,
    first_name: input.first_name,
    last_name: input.last_name,
  });

  if (profileError || !profile) {
    logAuthEvent('signup-server', {
      email,
      profileError: profileError ?? 'Profile row was not created',
    });
    return { error: profileError ?? 'Account created but profile setup failed. Please sign in again.' };
  }

  logAuthEvent('signup-server', {
    email,
    userId: profile.id,
    role: profile.role,
  });

  return { success: true, userId: data.user.id };
}
