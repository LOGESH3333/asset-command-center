'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/auth/session';
import { canInviteUsers, type AppRole, INVITABLE_ROLES, isAppRole } from '@/lib/auth/roles';
import { roleForDatabase } from '@/lib/auth/role-db';
import { getAppUrl } from '@/lib/auth/site-url';
import { logAuthAuditEvent } from '@/lib/auth/audit-auth';

export type InvitationRecord = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: AppRole;
  department: string | null;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

async function requireSuperAdmin() {
  const { user, profile } = await getSessionUser();
  const authorized = Boolean(profile && canInviteUsers(profile.role));

  console.log({
    role: profile?.role ?? null,
    userId: profile?.id ?? user?.id ?? null,
    action: 'requireSuperAdmin',
    authorized,
  });

  if (!authorized || !profile) {
    throw new Error('Unauthorized: Super Admin access required.');
  }
  return profile;
}

function generateToken() {
  return randomBytes(32).toString('hex');
}

function describeSupabaseError(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error ?? 'Unknown error');
  const err = error as {
    message?: string;
    code?: string | null;
    details?: string | null;
    hint?: string | null;
    status?: number;
    name?: string;
  };
  return [
    err.message,
    err.code ? `code: ${err.code}` : null,
    err.details ? `details: ${err.details}` : null,
    err.hint ? `hint: ${err.hint}` : null,
    err.status ? `status: ${err.status}` : null,
    err.name ? `name: ${err.name}` : null,
  ]
    .filter(Boolean)
    .join(' | ');
}

export async function listInvitationsAction(): Promise<{
  data?: InvitationRecord[];
  error?: string;
}> {
  try {
    await requireSuperAdmin();
    const { data, error } = await supabaseAdmin
      .from('user_invitations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return { error: error.message };
    return { data: (data ?? []) as InvitationRecord[] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to load invitations' };
  }
}

export async function inviteUserAction(input: {
  first_name: string;
  last_name: string;
  email: string;
  department?: string;
  role: AppRole;
}): Promise<{ success?: boolean; error?: string; activationUrl?: string }> {
  try {
    const actor = await requireSuperAdmin();
    const email = input.email.trim().toLowerCase();
    const role = isAppRole(input.role) && INVITABLE_ROLES.includes(input.role) ? input.role : 'Employee';
    const dbRole = roleForDatabase(role);
    console.log('STEP 0 INVITE USER PREFLIGHT STARTED', {
      email,
      role,
      invitedBy: actor.id,
    });

    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, status')
      .eq('email', email)
      .maybeSingle();

    if (existingUser?.status === 'Active') {
      return { error: 'A user with this email already exists.' };
    }

    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const siteUrl = getAppUrl();
    const activatePath = `/activate-account?token=${token}`;
    const redirectTo = `${siteUrl}/auth/callback?redirect=${encodeURIComponent(activatePath)}`;

    const { data: invited, error: inviteAuthError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo,
        data: {
          first_name: input.first_name,
          last_name: input.last_name,
          department: input.department ?? '',
          role,
          invitation_pending: true,
        },
      }
    );

    console.error('STEP 1 INVITE AUTH USER CREATED RESPONSE', {
      email,
      authUserId: invited.user?.id ?? null,
      authUserEmail: invited.user?.email ?? null,
      error: inviteAuthError,
    });

    if (inviteAuthError) {
      return { error: describeSupabaseError(inviteAuthError) };
    }

    const authId = invited.user?.id;
    if (!authId) return { error: 'Failed to create invited auth user.' };
    console.log('STEP 1 AUTH USER CREATED', { email, authId });

    const { error: profileError } = await supabaseAdmin.from('users').upsert(
      {
        auth_id: authId,
        email,
        first_name: input.first_name,
        last_name: input.last_name,
        department: input.department ?? null,
        role: dbRole,
        status: 'Invited',
      },
      { onConflict: 'auth_id' }
    );

    console.error('STEP 2 INVITE PROFILE UPSERT RESPONSE', {
      email,
      authId,
      role: dbRole,
      status: 'Invited',
      error: profileError,
    });

    if (profileError) {
      return { error: describeSupabaseError(profileError) };
    }
    console.log('STEP 2 PROFILE CREATED', { email, authId });
    console.log('STEP 3 ROLE ASSIGNED', { email, role, dbRole });

    const invitationPayload = {
      email,
      first_name: input.first_name,
      last_name: input.last_name,
      role,
      department: input.department ?? null,
      token,
      expires_at: expiresAt.toISOString(),
      created_by: actor.id,
      auth_id: authId,
      accepted_at: null,
    };
    const existingInvitation = await supabaseAdmin
      .from('user_invitations')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    const invitationWrite = existingInvitation.data?.id
      ? await supabaseAdmin
          .from('user_invitations')
          .update(invitationPayload)
          .eq('id', existingInvitation.data.id)
          .select('id')
          .single()
      : await supabaseAdmin
          .from('user_invitations')
          .insert(invitationPayload)
          .select('id')
          .single();

    const inviteError = invitationWrite.error;

    console.error('STEP 4 INVITATION CREATED RESPONSE', {
      email,
      authId,
      existingInvitationId: existingInvitation.data?.id ?? null,
      lookupError: existingInvitation.error,
      error: inviteError,
    });

    if (existingInvitation.error) {
      return { error: describeSupabaseError(existingInvitation.error) };
    }

    if (inviteError) return { error: describeSupabaseError(inviteError) };
    console.log('STEP 4 INVITATION CREATED', {
      email,
      authId,
      expiresAt: expiresAt.toISOString(),
    });

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: `${siteUrl}${activatePath}` },
    });

    const activationUrl =
      linkData?.properties?.action_link ?? `${siteUrl}${activatePath}`;

    if (linkError) {
      console.warn('[invite] generateLink fallback:', linkError.message);
    }

    await logAuthAuditEvent('Invitation Sent', {
      record_id: invitationWrite.data?.id,
      invitation_id: invitationWrite.data?.id,
      email,
      role,
      department: input.department ?? null,
      invited_by: actor.id,
      expires_at: expiresAt.toISOString(),
    });

    revalidatePath('/dashboard/user-management');

    return { success: true, activationUrl };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to send invitation' };
  }
}

export async function getInvitationByTokenAction(token: string): Promise<{
  data?: {
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    expires_at: string;
  };
  error?: string;
}> {
  const { data, error } = await supabaseAdmin
    .from('user_invitations')
    .select('email, first_name, last_name, role, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle();

  if (error || !data) return { error: 'Invalid or expired invitation.' };
  if (data.accepted_at) return { error: 'This invitation has already been used.' };
  if (new Date(data.expires_at) < new Date()) return { error: 'This invitation has expired.' };

  return { data };
}

export async function activateAccountAction(input: {
  token: string;
  password: string;
}): Promise<{ success?: boolean; error?: string }> {
  try {
    const invitation = await getInvitationByTokenAction(input.token);
    if (invitation.error || !invitation.data) {
      return { error: invitation.error ?? 'Invalid invitation.' };
    }

    const { data: inviteRow } = await supabaseAdmin
      .from('user_invitations')
      .select('auth_id, email')
      .eq('token', input.token)
      .single();

    if (!inviteRow?.auth_id) {
      return { error: 'Invitation is not linked to an auth account.' };
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(inviteRow.auth_id, {
      password: input.password,
      email_confirm: true,
      user_metadata: { invitation_pending: false },
    });

    if (updateError) return { error: updateError.message };

    const now = new Date().toISOString();

    await supabaseAdmin
      .from('users')
      .update({ status: 'Active', updated_at: now })
      .eq('auth_id', inviteRow.auth_id);

    const { data: activatedUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('auth_id', inviteRow.auth_id)
      .maybeSingle();

    await supabaseAdmin
      .from('user_invitations')
      .update({ accepted_at: now })
      .eq('token', input.token);

    await logAuthAuditEvent('Invitation Accepted', {
      record_id: activatedUser?.id ?? inviteRow.auth_id,
      user_id: activatedUser?.id ?? null,
      email: inviteRow.email,
      auth_id: inviteRow.auth_id,
    });

    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Activation failed' };
  }
}

export async function suspendUserAction(userId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const actor = await requireSuperAdmin();

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('auth_id, email, role')
      .eq('id', userId)
      .single();

    if (!user) return { error: 'User not found.' };
    if (user.role === 'Super_Admin') return { error: 'Cannot suspend Super Admin.' };

    await supabaseAdmin.from('users').update({ status: 'Suspended' }).eq('id', userId);

    if (user.auth_id) {
      await supabaseAdmin.auth.admin.updateUserById(user.auth_id, {
        ban_duration: '876000h',
      });
    }

    await logAuthAuditEvent('User Suspended', {
      record_id: userId,
      user_id: userId,
      email: user.email,
      suspended_by: actor.id,
    });

    revalidatePath('/dashboard/user-management');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to suspend user' };
  }
}

export async function reactivateUserAction(userId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const actor = await requireSuperAdmin();

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('auth_id, email')
      .eq('id', userId)
      .single();

    if (!user) return { error: 'User not found.' };

    await supabaseAdmin.from('users').update({ status: 'Active' }).eq('id', userId);

    if (user.auth_id) {
      await supabaseAdmin.auth.admin.updateUserById(user.auth_id, { ban_duration: 'none' });
    }

    await logAuthAuditEvent('User Activated', {
      record_id: userId,
      user_id: userId,
      email: user.email,
      activated_by: actor.id,
    });

    revalidatePath('/dashboard/user-management');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to reactivate user' };
  }
}

export async function changeUserRoleAction(
  userId: string,
  role: AppRole
): Promise<{ success?: boolean; error?: string }> {
  try {
    const actor = await requireSuperAdmin();

    if (!INVITABLE_ROLES.includes(role) && role !== 'Super_Admin') {
      return { error: 'Invalid role for assignment.' };
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('auth_id, email, role')
      .eq('id', userId)
      .single();

    if (!user) return { error: 'User not found.' };
    if (user.role === 'Super_Admin' && role !== 'Super_Admin') {
      return { error: 'Cannot change Super Admin role.' };
    }

    const { error: roleUpdateError } = await supabaseAdmin
      .from('users')
      .update({ role: roleForDatabase(role) })
      .eq('id', userId);

    if (roleUpdateError) {
      return { error: 'Role update requires the Supabase auth schema migration.' };
    }

    if (user.auth_id) {
      await supabaseAdmin.auth.admin.updateUserById(user.auth_id, {
        user_metadata: { role },
      });
    }

    await logAuthAuditEvent('Role Changed', {
      record_id: userId,
      user_id: userId,
      email: user.email,
      from_role: user.role,
      to_role: role,
      changed_by: actor.id,
    });

    revalidatePath('/dashboard/user-management');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to change role' };
  }
}
