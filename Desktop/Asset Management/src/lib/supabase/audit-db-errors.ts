/** Maps stale audit trigger errors to actionable repair instructions. */

const AUDIT_DETAILS_PATTERN = /column "details" of relation "audit_logs"/i;
const AUDIT_RECORD_ID_UUID_PATTERN =
  /column "record_id" is of type uuid but expression is of type text/i;

export function formatAuditTriggerDbError(message: string): string {
  if (AUDIT_DETAILS_PATTERN.test(message)) {
    return (
      'Database audit trigger is outdated (still writes to audit_logs.details). ' +
      'Go to Settings → Fix Audit Log Trigger, or run supabase/migrations/009_audit_logs_old_new_data.sql ' +
      'in Supabase Dashboard → SQL Editor.'
    );
  }
  if (AUDIT_RECORD_ID_UUID_PATTERN.test(message)) {
    return (
      'Database audit trigger writes TEXT into audit_logs.record_id (live column is UUID). ' +
      'Go to Settings → Copy Trigger SQL → paste in Supabase SQL Editor → Run. ' +
      '(Migration: supabase/migrations/010_audit_logs_record_id_uuid.sql)'
    );
  }
  return message;
}

export function isStaleAuditTriggerError(message: string): boolean {
  return AUDIT_DETAILS_PATTERN.test(message) || AUDIT_RECORD_ID_UUID_PATTERN.test(message);
}
