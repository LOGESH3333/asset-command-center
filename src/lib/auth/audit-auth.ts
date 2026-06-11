'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/auth/session';

export type AuthAuditEvent =
  | 'User Created'
  | 'User Updated'
  | 'Invitation Sent'
  | 'Invitation Accepted'
  | 'Role Changed'
  | 'User Suspended'
  | 'User Activated'
  | 'User Deleted'
  | 'Login'
  | 'Logout';

function formatAuditError(error: { message?: string; code?: string; details?: string | null; hint?: string | null }) {
  return [
    `message: ${error.message ?? 'Unknown audit log error'}`,
    `code: ${error.code ?? 'n/a'}`,
    `details: ${error.details ?? 'n/a'}`,
    `hint: ${error.hint ?? 'n/a'}`,
  ].join(' | ');
}

export async function logAuthAuditEvent(
  event: AuthAuditEvent,
  details: Record<string, unknown> = {}
) {
  const { profile } = await getSessionUser();
  const recordId =
    details.record_id ??
    details.user_id ??
    details.deleted_user_id ??
    details.invitation_id ??
    details.auth_id ??
    profile?.id;

  if (typeof recordId !== 'string' || !recordId) {
    const error = new Error(`Audit log record_id is required for ${event}.`);
    console.error('[auth-audit] missing record_id', {
      event,
      details,
      actorId: profile?.id ?? null,
      error,
    });
    throw error;
  }

  const { error } = await supabaseAdmin.from('audit_logs').insert({
    action: 'INSERT',
    table_name: 'auth_events',
    record_id: recordId,
    old_data: null,
    new_data: {
      event,
      actor_id: profile?.id ?? null,
      actor_email: profile?.email ?? details.email ?? null,
      timestamp: new Date().toISOString(),
      ...details,
      record_id: recordId,
    },
  });

  if (error) {
    console.error('[auth-audit] insert failed', {
      event,
      record_id: recordId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(formatAuditError(error));
  }
}
