'use server';

import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session';
import { canManageUsers, canInviteUsers } from '@/lib/auth/roles';
import { logAuthAuditEvent } from '@/lib/auth/audit-auth';
import type { AppRole } from '@/lib/auth/roles';
import { ensureUserProfile } from '@/lib/auth/user-profile-sync';
import { logAuthEvent, serializeAuthError } from '@/lib/auth/auth-log';
import { roleForDatabase } from '@/lib/auth/role-db';
import { generateTemporaryPassword } from '@/lib/auth/temporary-password';
import { getPasswordResetRedirectUrl } from '@/lib/auth/site-url';
import {
  type DeleteActionResponse,
  type DeleteBlockingInfo,
  blockingFromSupabaseError,
  logDeleteBlocked,
  resolveDeleteBlockingInfo,
  toBlockedDeleteResponse,
} from '@/lib/delete/delete-fk-blocking';
import { checkUserDeleteBlocking } from '@/lib/delete/delete-fk-blocking-server';

type CreateUserSchemaDiagnostics = {
  authIdColumn: 'present' | 'missing' | 'unknown';
  clerkIdColumn: 'present' | 'absent' | 'unknown';
  statusColumn: 'present' | 'missing' | 'unknown';
  roleColumn: 'present' | 'missing' | 'unknown';
  errors: string[];
};

type PgQuery = (sql: string, values?: unknown[]) => Promise<{
  rows: Record<string, unknown>[];
  rowCount: number | null;
}>;

type UserForeignKeyReference = {
  constraintName: string;
  tableSchema: string;
  tableName: string;
  columnName: string;
  columnNullable: boolean;
  onDeleteAction: string;
};

type UserForeignKeyCleanupResult = UserForeignKeyReference & {
  referencedRows: number;
  action: 'none' | 'set_null';
};

class UserDeleteBlockedError extends Error {
  readonly blocking: DeleteBlockingInfo;

  constructor(blocking: DeleteBlockingInfo) {
    super(blocking.explanation);
    this.name = 'UserDeleteBlockedError';
    this.blocking = blocking;
  }
}

function throwIfBlockingFkError(
  userId: string,
  error: { message?: string | null; details?: string | null; hint?: string | null; code?: string | null },
  context: string
): never {
  const blocking = blockingFromSupabaseError(error);
  if (blocking) {
    logDeleteBlocked(context, blocking, {
      userId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new UserDeleteBlockedError(blocking);
  }

  console.error(`[DELETE] CLEANUP FAILED (${context})`, {
    userId,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
  throw new Error(
    `FK cleanup failed: ${error.message} | code: ${error.code ?? 'n/a'} | details: ${error.details ?? 'n/a'}`
  );
}

function describeSupabaseError(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error ?? 'Unknown error');
  const err = error as {
    message?: string;
    details?: string | null;
    hint?: string | null;
    code?: string | null;
    status?: number;
    name?: string;
  };
  return [
    `message: ${err.message ?? 'Unknown Supabase error'}`,
    `code: ${err.code ?? 'n/a'}`,
    `details: ${err.details ?? 'n/a'}`,
    `hint: ${err.hint ?? 'n/a'}`,
    `status: ${err.status ?? 'n/a'}`,
    `name: ${err.name ?? 'n/a'}`,
  ]
    .join(' | ');
}

function formatCaughtError(error: unknown): string {
  if (error && typeof error === 'object') {
    return describeSupabaseError(error);
  }
  if (error instanceof Error) {
    return `message: ${error.message} | code: n/a | details: n/a | hint: n/a | status: n/a | name: ${error.name}`;
  }
  return `message: ${String(error ?? 'Failed to create user')} | code: n/a | details: n/a | hint: n/a | status: n/a | name: n/a`;
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function isMissingRpcFunctionError(error: { code?: string | null; message?: string | null }) {
  const message = error.message?.toLowerCase() ?? '';
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    message.includes('could not find the function') ||
    message.includes('function public.cleanup_user_delete_references') ||
    message.includes('does not exist')
  );
}

function getProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? null;
}

async function withPgClient<T>(fn: (query: PgQuery) => Promise<T>): Promise<T> {
  const password = process.env.SUPABASE_DB_PASSWORD;
  const ref = getProjectRef();

  if (!password || !ref) {
    throw new Error(
      'SUPABASE_DB_PASSWORD is required for production-safe dynamic FK cleanup before deleting users.'
    );
  }

  const { Client } = await import('pg');
  const client = new Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    return await fn((sql, values) => client.query(sql, values));
  } finally {
    await client.end();
  }
}

async function discoverUserForeignKeys(query: PgQuery): Promise<UserForeignKeyReference[]> {
  console.log('[DELETE] FK DISCOVERY START');
  const result = await query(`
    SELECT
      con.conname AS "constraintName",
      ns.nspname AS "tableSchema",
      rel.relname AS "tableName",
      att.attname AS "columnName",
      NOT att.attnotnull AS "columnNullable",
      CASE con.confdeltype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
        ELSE con.confdeltype::text
      END AS "onDeleteAction"
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    JOIN unnest(con.conkey) WITH ORDINALITY AS cols(attnum, ord) ON true
    JOIN unnest(con.confkey) WITH ORDINALITY AS refcols(attnum, ord) ON refcols.ord = cols.ord
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = cols.attnum
    JOIN pg_attribute refatt ON refatt.attrelid = con.confrelid AND refatt.attnum = refcols.attnum
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.users'::regclass
      AND refatt.attname = 'id'
      AND ns.nspname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY ns.nspname, rel.relname, con.conname, att.attname
  `);

  const references = result.rows.map((row) => ({
    constraintName: String(row.constraintName),
    tableSchema: String(row.tableSchema),
    tableName: String(row.tableName),
    columnName: String(row.columnName),
    columnNullable: Boolean(row.columnNullable),
    onDeleteAction: String(row.onDeleteAction),
  }));

  console.log('[DELETE] FK DISCOVERY SUCCESS', { count: references.length, references });
  return references;
}

async function cleanupUserForeignKeyReferences(
  query: PgQuery,
  userId: string,
  references: UserForeignKeyReference[]
): Promise<UserForeignKeyCleanupResult[]> {
  const cleanupResults: UserForeignKeyCleanupResult[] = [];

  for (const reference of references) {
    const tableRef = `${quoteIdentifier(reference.tableSchema)}.${quoteIdentifier(reference.tableName)}`;
    const columnRef = quoteIdentifier(reference.columnName);

    console.log('[DELETE] CLEANUP START', { userId, reference });
    const countResult = await query(
      `SELECT COUNT(*)::int AS count FROM ${tableRef} WHERE ${columnRef} = $1::uuid`,
      [userId]
    );
    const referencedRows = Number(countResult.rows[0]?.count ?? 0);

    if (referencedRows === 0) {
      const result = { ...reference, referencedRows, action: 'none' as const };
      cleanupResults.push(result);
      console.log('[DELETE] CLEANUP SUCCESS', result);
      continue;
    }

    if (!reference.columnNullable) {
      const blocking = resolveDeleteBlockingInfo(reference.tableName, reference.columnName, referencedRows);
      logDeleteBlocked('user-fk-cleanup', blocking, { userId, reference, referencedRows });
      throw new UserDeleteBlockedError(blocking);
    }

    await query(
      `UPDATE ${tableRef} SET ${columnRef} = NULL WHERE ${columnRef} = $1::uuid`,
      [userId]
    );
    const result = { ...reference, referencedRows, action: 'set_null' as const };
    cleanupResults.push(result);
    console.log('[DELETE] CLEANUP SUCCESS', result);
  }

  return cleanupResults;
}

async function verifyNoUserForeignKeyReferences(
  query: PgQuery,
  userId: string,
  references: UserForeignKeyReference[]
) {
  const remaining: Array<UserForeignKeyReference & { referencedRows: number }> = [];

  for (const reference of references) {
    const tableRef = `${quoteIdentifier(reference.tableSchema)}.${quoteIdentifier(reference.tableName)}`;
    const columnRef = quoteIdentifier(reference.columnName);
    const countResult = await query(
      `SELECT COUNT(*)::int AS count FROM ${tableRef} WHERE ${columnRef} = $1::uuid`,
      [userId]
    );
    const referencedRows = Number(countResult.rows[0]?.count ?? 0);
    if (referencedRows > 0) {
      remaining.push({ ...reference, referencedRows });
    }
  }

  if (remaining.length > 0) {
    const first = remaining[0];
    const blocking = resolveDeleteBlockingInfo(first.tableName, first.columnName, first.referencedRows);
    logDeleteBlocked('user-fk-verify', blocking, { userId, remaining });
    throw new UserDeleteBlockedError(blocking);
  }

  console.log('[DELETE] CLEANUP VERIFY SUCCESS', { userId });
}

async function cleanupAllUserForeignKeyReferences(userId: string) {
  console.log('[DELETE] FK DISCOVERY START', { mode: 'rpc', userId, rpcExists: 'checking' });
  const { data, error } = await supabaseAdmin.rpc('cleanup_user_delete_references', {
    target_user_id: userId,
  });

  if (!error) {
    console.log('[DELETE] RPC CALL RESULT', {
      mode: 'rpc',
      userId,
      rpcExists: true,
      fallbackPathEntered: false,
      result: data,
    });
    console.log('[DELETE] FK DISCOVERY SUCCESS', { mode: 'rpc', userId, rpcExists: true, result: data });
    console.log('[DELETE] CLEANUP SUCCESS', { mode: 'rpc', userId, rpcExists: true, result: data });
    return data;
  }

  if (!isMissingRpcFunctionError(error)) {
    throwIfBlockingFkError(userId, error, 'rpc');
  }

  console.warn('[DELETE] FK DISCOVERY RPC MISSING; FALLING BACK TO PG CATALOG', {
    userId,
    rpcExists: false,
    fallbackPathEntered: true,
    code: error.code,
    message: error.message,
  });

  try {
    return await withPgClient(async (query) => {
      const references = await discoverUserForeignKeys(query);
      const cleanupResults = await cleanupUserForeignKeyReferences(query, userId, references);
      await verifyNoUserForeignKeyReferences(query, userId, references);
      return cleanupResults;
    });
  } catch (fallbackError) {
    console.error('[DELETE] FK DISCOVERY FALLBACK FAILED', {
      userId,
      rpcExists: false,
      fallbackPathEntered: true,
      rpcError: {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      },
      fallbackError,
      fallbackMessage: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
    });
    throw new Error(
      [
        'User delete FK cleanup RPC is missing in Supabase.',
        'Apply supabase/migrations/019_user_delete_fk_cleanup_rpc.sql.',
        `RPC error: ${error.message}`,
        `Fallback error: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
      ].join(' ')
    );
  }
}

async function probeUsersSchemaForCreate(): Promise<CreateUserSchemaDiagnostics> {
  const diagnostics: CreateUserSchemaDiagnostics = {
    authIdColumn: 'unknown',
    clerkIdColumn: 'unknown',
    statusColumn: 'unknown',
    roleColumn: 'unknown',
    errors: [],
  };

  const probes = [
    ['authIdColumn', 'auth_id'],
    ['clerkIdColumn', 'clerk_id'],
    ['statusColumn', 'status'],
    ['roleColumn', 'role'],
  ] as const;

  for (const [key, column] of probes) {
    const { error } = await supabaseAdmin.from('users').select(`id, ${column}`).limit(1);
    if (!error) {
      diagnostics[key] = 'present' as never;
      continue;
    }

    const message = error.message.toLowerCase();
    const missing = message.includes(column.toLowerCase()) && message.includes('could not find');
    diagnostics[key] = key === 'clerkIdColumn' && missing ? ('absent' as never) : missing ? ('missing' as never) : ('unknown' as never);
    diagnostics.errors.push(`${column}: ${describeSupabaseError(error)}`);
  }

  return diagnostics;
}

function explainCreateUserAuthError(message: string, diagnostics: CreateUserSchemaDiagnostics): string {
  const lower = message.toLowerCase();
  if (lower.includes('database error creating new user')) {
    if (diagnostics.clerkIdColumn === 'present') {
      return [
        'Database error creating new user.',
        'Root cause detected: live public.users still contains legacy Clerk column `clerk_id`.',
        'Supabase Auth is firing the public.handle_new_user() trigger, and that trigger/profile write is failing against the Clerk-era users schema.',
        'Run `supabase/migrations/018_remove_remaining_clerk_schema.sql`, or use Settings → Repair Schema after setting SUPABASE_DB_PASSWORD.',
        `Original Supabase Auth error: ${message}`,
      ].join(' ');
    }

    if (diagnostics.authIdColumn === 'missing') {
      return [
        'Database error creating new user.',
        'Root cause detected: live public.users is missing `auth_id`, so the Supabase Auth profile trigger cannot link auth.users to public.users.',
        'Run `supabase/migrations/018_remove_remaining_clerk_schema.sql`.',
        `Original Supabase Auth error: ${message}`,
      ].join(' ');
    }
  }

  return message;
}

async function applyLegacyClerkIdIfRequired(
  profileId: string,
  diagnostics: CreateUserSchemaDiagnostics
): Promise<{ error?: string }> {
  if (diagnostics.clerkIdColumn !== 'present') return {};

  const { error } = await supabaseAdmin
    .from('users')
    .update({
      clerk_id: `user_supabase_${globalThis.crypto.randomUUID().replaceAll('-', '')}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId);

  if (error) {
    return { error: describeSupabaseError(error) };
  }

  return {};
}

async function rollbackCreatedAuthUser(authId: string, email: string) {
  try {
    await supabaseAdmin.auth.admin.deleteUser(authId);
  } catch (err) {
    console.error('[createUser] rollback auth delete failed', { authId, email, err });
  }

  await supabaseAdmin.from('users').delete().eq('auth_id', authId);
  await supabaseAdmin.from('users').delete().eq('email', email).is('auth_id', null);
}

export type SyncedUser = {
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

async function requireUserAdmin() {
  const { user, profile } = await getSessionUser();
  const authorized = Boolean(
    profile && (canManageUsers(profile.role) || canInviteUsers(profile.role) || profile.role === 'Admin')
  );

  console.log({
    role: profile?.role ?? null,
    userId: profile?.id ?? user?.id ?? null,
    action: 'requireUserAdmin',
    authorized,
  });

  if (!authorized || !profile) {
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

    if (profile) {
      if (profile.status === 'Suspended') {
        return { error: 'Your account has been suspended. Contact your administrator.' };
      }
      return { data: profile as SyncedUser };
    }

    if (!('aud' in user)) {
      return { error: 'Not authenticated' };
    }

    logAuthEvent('profile-sync', {
      step: 'ensure-profile',
      authId: user.id,
      email: user.email,
    });

    const { profile: ensured, error } = await ensureUserProfile(user as User);

    logAuthEvent('profile-sync', {
      step: 'ensure-profile-result',
      authId: user.id,
      email: user.email,
      userId: ensured?.id,
      role: ensured?.role,
      error: error ?? null,
    });

    if (ensured) return { data: ensured as SyncedUser };
    return { error: error ?? 'Failed to sync user profile' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to sync user';
    logAuthEvent('profile-sync', { step: 'exception', error: serializeAuthError({ message }) });
    return { error: message };
  }
}

export async function createUserAction(formData: {
  first_name: string;
  last_name: string;
  email: string;
  password?: string;
  department?: string;
  role?: AppRole;
  /** When true, email a password setup link instead of returning the password in the UI. */
  sendSetupEmail?: boolean;
}) {
  let createdAuthId: string | null = null;

  try {
    await requireUserAdmin();
    const { first_name, last_name, email, department, role, sendSetupEmail } = formData;
    const normalizedEmail = email.trim().toLowerCase();
    const requestedRole = role ?? 'Employee';
    const temporaryPassword = formData.password?.trim() || generateTemporaryPassword();

    if (temporaryPassword.length < 8) {
      return { error: 'Password must be at least 8 characters.' };
    }

    const schemaDiagnostics = await probeUsersSchemaForCreate();

    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
      .from('users')
      .select('id, auth_id, email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingProfileError) {
      return { error: describeSupabaseError(existingProfileError) };
    }

    if (existingProfile?.auth_id) {
      return {
        error: `A profile for ${normalizedEmail} is already linked to Supabase Auth. Use User Management to reset access instead of creating a duplicate.`,
      };
    }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        first_name,
        last_name,
        department: department ?? '',
        role: requestedRole,
      },
    });

    if (authError || !authUser.user?.id) {
      return {
        error: explainCreateUserAuthError(
          describeSupabaseError(authError ?? { message: 'Supabase Auth created no user id.' }),
          schemaDiagnostics
        ),
      };
    }

    createdAuthId = authUser.user.id;

    const { profile, error: profileError } = await ensureUserProfile({
      authId: createdAuthId,
      email: normalizedEmail,
      first_name,
      last_name,
      department: department ?? null,
      roleOverride: requestedRole,
    });

    if (profileError || !profile) {
      await rollbackCreatedAuthUser(createdAuthId, normalizedEmail);
      createdAuthId = null;
      return { error: profileError ?? 'Unable to create public.users profile after auth user creation.' };
    }

    const clerkPatch = await applyLegacyClerkIdIfRequired(profile.id, schemaDiagnostics);
    if (clerkPatch.error) {
      await rollbackCreatedAuthUser(createdAuthId, normalizedEmail);
      createdAuthId = null;
      return { error: clerkPatch.error };
    }

    const now = new Date().toISOString();
    const { data: finalized, error: finalizeError } = await supabaseAdmin
      .from('users')
      .update({
        auth_id: createdAuthId,
        email: normalizedEmail,
        first_name,
        last_name,
        department: department ?? null,
        role: roleForDatabase(requestedRole),
        status: 'Active',
        updated_at: now,
      })
      .eq('id', profile.id)
      .select()
      .single();

    if (finalizeError || !finalized) {
      await rollbackCreatedAuthUser(createdAuthId, normalizedEmail);
      createdAuthId = null;
      return {
        error: finalizeError
          ? describeSupabaseError(finalizeError)
          : 'Failed to finalize public.users profile after auth user creation.',
      };
    }

    if (!finalized.auth_id || finalized.auth_id !== createdAuthId) {
      await rollbackCreatedAuthUser(createdAuthId, normalizedEmail);
      createdAuthId = null;
      return { error: 'public.users.auth_id was not linked to the new Supabase Auth user.' };
    }

    let setupLink: string | undefined;
    if (sendSetupEmail) {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: normalizedEmail,
        options: { redirectTo: getPasswordResetRedirectUrl() },
      });

      if (linkError) {
        await rollbackCreatedAuthUser(createdAuthId, normalizedEmail);
        createdAuthId = null;
        return { error: describeSupabaseError(linkError) };
      }

      setupLink = linkData.properties?.action_link;
    }

    await logAuthAuditEvent('User Created', {
      record_id: finalized.id,
      user_id: finalized.id,
      email: normalizedEmail,
      role: requestedRole,
      auth_id: createdAuthId,
    });

    revalidatePath('/dashboard/users');
    revalidatePath('/dashboard/user-management');

    return {
      data: finalized as SyncedUser,
      authUserId: createdAuthId,
      temporaryPassword: sendSetupEmail ? undefined : temporaryPassword,
      setupLink,
    };
  } catch (err) {
    if (createdAuthId) {
      await rollbackCreatedAuthUser(createdAuthId, formData.email.trim().toLowerCase());
    }
    const formatted = formatCaughtError(err);
    console.error('[createUser] failed', { error: err, formatted });
    return { error: formatted };
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
    await requireUserAdmin();
    const { first_name, last_name, email, department, role } = formData;

    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('auth_id, email, role, department, status')
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
        role: roleForDatabase(role ?? 'Employee'),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await logAuthAuditEvent('User Updated', {
      record_id: id,
      user_id: id,
      email: data.email,
      old_role: existing?.role ?? null,
      new_role: data.role,
      old_department: existing?.department ?? null,
      new_department: data.department ?? null,
      old_status: existing?.status ?? null,
      new_status: data.status ?? null,
    });

    revalidatePath('/dashboard/users');
    revalidatePath(`/dashboard/users/${id}`);
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update user' };
  }
}

export async function deleteUserAction(userId: string): Promise<DeleteActionResponse> {
  console.log('[DELETE] SERVER ACTION START', userId);
  try {
    const actor = await requireUserAdmin();
    console.log('[DELETE] AUTHORIZED', { userId, actorId: actor.id });

    console.log('[DELETE] USER LOOKUP START', { userId });
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id, auth_id, email, role')
      .eq('id', userId)
      .single();
    console.log('[DELETE] USER LOOKUP RESULT', {
      userId,
      found: Boolean(existing),
      authId: existing?.auth_id ?? null,
      email: existing?.email ?? null,
      role: existing?.role ?? null,
    });

    if (!existing) {
      throw new Error('User not found.');
    }

    if (existing?.role === 'Super_Admin') {
      throw new Error('Cannot delete Super Admin.');
    }

    const precheck = await checkUserDeleteBlocking(userId);
    if (precheck) return toBlockedDeleteResponse(precheck, 'user', { userId });

    const authId = existing.auth_id;
    await cleanupAllUserForeignKeyReferences(userId);

    console.log('[DELETE] PUBLIC DELETE START', { userId });
    const { error, count } = await supabaseAdmin
      .from('users')
      .delete({ count: 'exact' })
      .eq('id', userId);
    if (error) {
      if (error.code === '23503') {
        throwIfBlockingFkError(userId, error, 'public-delete');
      }
      console.error('[DELETE] PUBLIC DELETE FAILED', {
        userId,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw new Error(error.message);
    }
    console.log('[DELETE] PUBLIC DELETE SUCCESS', { userId, deletedCount: count ?? null });

    console.log('[DELETE] PUBLIC DELETE VERIFY START', { userId });
    const { data: publicAfterDelete, error: verifyPublicError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (verifyPublicError) {
      console.error('[DELETE] PUBLIC DELETE VERIFY FAILED', {
        userId,
        code: verifyPublicError.code,
        message: verifyPublicError.message,
        details: verifyPublicError.details,
        hint: verifyPublicError.hint,
      });
      throw new Error(verifyPublicError.message);
    }

    if (publicAfterDelete) {
      console.error('[DELETE] PUBLIC DELETE VERIFY FAILED', {
        userId,
        message: 'public.users row still exists after delete',
      });
      throw new Error('public.users row still exists after delete.');
    }
    console.log('[DELETE] PUBLIC DELETE VERIFY SUCCESS', { userId });

    if (authId) {
      console.log('[DELETE] AUTH DELETE START', { userId, authId });
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(authId);
      if (authDeleteError) {
        console.error('[DELETE] AUTH DELETE FAILED', {
          userId,
          authId,
          message: authDeleteError.message,
          status: authDeleteError.status,
          name: authDeleteError.name,
        });
        throw new Error(authDeleteError.message);
      }
      console.log('[DELETE] AUTH DELETE SUCCESS', { userId, authId });
    } else {
      console.log('[DELETE] AUTH DELETE SKIPPED', { userId, reason: 'public.users.auth_id is null' });
    }

    console.log('[DELETE] AUDIT DELETE START', { userId });
    await logAuthAuditEvent('User Deleted', {
      record_id: existing.id,
      deleted_user_id: existing.id,
      email: existing?.email,
      deleted_by: actor.id,
    });
    console.log('[DELETE] AUDIT SUCCESS', { userId });

    console.log('[DELETE] REVALIDATE START', { userId });
    try {
      revalidatePath('/dashboard/users');
      revalidatePath('/dashboard/user-management');
    } catch (revalidateError) {
      console.error('[DELETE] REVALIDATE FAILED', {
        userId,
        error: revalidateError,
        message: revalidateError instanceof Error ? revalidateError.message : String(revalidateError),
      });
      throw revalidateError;
    }
    console.log('[DELETE] REVALIDATE SUCCESS', { userId });
    return { success: true };
  } catch (err) {
    if (err instanceof UserDeleteBlockedError) {
      return toBlockedDeleteResponse(err.blocking, 'user', { userId });
    }

    console.error('[DELETE] SERVER ACTION FAILED', {
      userId,
      error: err,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return { error: err instanceof Error ? err.message : 'Failed to delete user' };
  }
}
