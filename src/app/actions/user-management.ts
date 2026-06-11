'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/auth/session';
import { canManageUsers } from '@/lib/auth/roles';
import type { AppRole } from '@/lib/auth/roles';
import { roleFromDatabase } from '@/lib/auth/role-db';
import { logLoginStep } from '@/lib/auth/auth-log';

export type ManagedUser = {
  id: string;
  auth_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  department: string | null;
  role: AppRole;
  status: string;
  last_login: string | null;
  created_at: string;
  updated_at: string;
};

export async function listManagedUsersAction(params?: {
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: ManagedUser[]; total: number; error?: string }> {
  try {
    const { user, profile } = await getSessionUser();
    const authorized = Boolean(profile && canManageUsers(profile.role));

    console.log({
      role: profile?.role ?? null,
      userId: profile?.id ?? user?.id ?? null,
      action: 'listManagedUsersAction',
      authorized,
    });

    if (!authorized || !profile) {
      return { data: [], total: 0, error: 'Unauthorized' };
    }

    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 10;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabaseAdmin.from('users').select('*', { count: 'exact' });

    if (params?.search?.trim()) {
      const term = params.search.trim();
      query = query.or(
        `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,department.ilike.%${term}%`
      );
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) return { data: [], total: 0, error: error.message };

    const rows = ((data ?? []) as ManagedUser[]).map((row) => ({
      ...row,
      role: roleFromDatabase(row.role, row.email),
    }));

    if (rows.length === 0 && profile.role === 'Super_Admin') {
      const superAdminRow: ManagedUser = {
        id: profile.id,
        auth_id: profile.auth_id,
        email: profile.email,
        first_name: profile.first_name,
        last_name: profile.last_name,
        department: profile.department,
        role: 'Super_Admin',
        status: profile.status ?? 'Active',
        last_login: profile.last_login ?? null,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      };
      return { data: [superAdminRow], total: 1 };
    }

    return { data: rows, total: count ?? rows.length };
  } catch (err) {
    return {
      data: [],
      total: 0,
      error: err instanceof Error ? err.message : 'Failed to load users',
    };
  }
}

export async function recordLoginAction(authId: string, email: string, loginId = 'server-login-unknown') {
  const now = new Date().toISOString();
  const normalizedEmail = email.trim().toLowerCase();

  logLoginStep(loginId, 'recordLoginAction.updateByAuthId', 'START', {
    authId,
    email: normalizedEmail,
  });
  const byAuth = await supabaseAdmin
    .from('users')
    .update({ last_login: now })
    .eq('auth_id', authId);

  if (byAuth.error) {
    logLoginStep(loginId, 'recordLoginAction.updateByAuthId', 'FAILED', {
      error: byAuth.error,
      stack: byAuth.error.stack,
    });
    logLoginStep(loginId, 'recordLoginAction.updateByEmail', 'START', {
      authId,
      email: normalizedEmail,
    });
    const byEmail = await supabaseAdmin
      .from('users')
      .update({ last_login: now })
      .eq('email', normalizedEmail);

    if (byEmail.error) {
      logLoginStep(loginId, 'recordLoginAction.updateByEmail', 'FAILED', {
        error: byEmail.error,
        stack: byEmail.error.stack,
      });
      return {
        error: [
          'step: postLogin.recordLastLogin',
          `message: ${byEmail.error.message}`,
          `code: ${byEmail.error.code ?? 'n/a'}`,
          'status: n/a',
          'name: PostgrestError',
          `details: ${byEmail.error.details ?? 'n/a'}`,
          `hint: ${byEmail.error.hint ?? 'n/a'}`,
        ].join(' | '),
      };
    }
    logLoginStep(loginId, 'recordLoginAction.updateByEmail', 'SUCCESS', {
      authId,
      email: normalizedEmail,
    });
  } else {
    logLoginStep(loginId, 'recordLoginAction.updateByAuthId', 'SUCCESS', {
      authId,
      email: normalizedEmail,
    });
  }

  try {
    logLoginStep(loginId, 'recordLoginAction.auditLog', 'START', {
      authId,
      email: normalizedEmail,
    });
    const { logAuthAuditEvent } = await import('@/lib/auth/audit-auth');
    await logAuthAuditEvent('Login', { auth_id: authId, email: normalizedEmail });
    logLoginStep(loginId, 'recordLoginAction.auditLog', 'SUCCESS', {
      authId,
      email: normalizedEmail,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logLoginStep(loginId, 'recordLoginAction.auditLog', 'FAILED', {
      error: err,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return {
      error: [
        'step: postLogin.auditLog',
        `message: ${message}`,
        'code: see server audit log',
        'status: n/a',
        'name: AuditLogError',
      ].join(' | '),
    };
  }

  return { success: true };
}
