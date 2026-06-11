/** Maps database errors to concise, user-facing UI messages. */

const AUDIT_DETAILS_PATTERN = /column "details" of relation "audit_logs"/i;
const AUDIT_RECORD_ID_UUID_PATTERN =
  /column "record_id" is of type uuid but expression is of type text/i;

const ASSETS_SCHEMA_MIGRATION = '023_assets_schema_sync.sql';

const MISSING_COLUMN_HINTS: Record<string, string> = {
  'assets.request_id': `Missing assets.request_id column. Apply migration ${ASSETS_SCHEMA_MIGRATION} in Supabase SQL Editor.`,
  'assets.serial_number': `Missing assets.serial_number column. Apply migration ${ASSETS_SCHEMA_MIGRATION} in Supabase SQL Editor.`,
  'assets.qr_payload': `Missing assets.qr_payload column. Apply migration ${ASSETS_SCHEMA_MIGRATION} in Supabase SQL Editor.`,
  'assets.qr_generated_at': `Missing assets.qr_generated_at column. Apply migration ${ASSETS_SCHEMA_MIGRATION} in Supabase SQL Editor.`,
  'assets.assigned_employee_id': `Missing assets.assigned_employee_id column. Apply migration ${ASSETS_SCHEMA_MIGRATION} in Supabase SQL Editor.`,
  'asset_requests.description':
    'Missing asset_requests.description column. Apply migration 005_asset_requests_description.sql.',
  'vendors.contact_email':
    'Missing vendor contact columns. Apply migration 006_vendors_contact_columns.sql.',
};

const REPORT_LIKE_PATTERN =
  /\b(Root Cause|Investigation|Before vs After|##\s|```|schema drift)\b/i;

function formatDuplicateKeyError(message: string): string | null {
  const match = message.match(/duplicate key value violates unique constraint "([^"]+)"/i);
  if (!match) return null;

  const constraint = match[1].toLowerCase();
  if (constraint.includes('asset_tag')) {
    return 'This asset tag is already registered. Refresh the page to get the next available tag, or enter a different tag.';
  }
  if (constraint.includes('serial')) {
    return 'This serial number is already assigned to another asset. Use a different serial number.';
  }
  return 'A record with these values already exists. Change the unique identifier and try again.';
}

function formatForeignKeyError(message: string): string | null {
  if (!/violates foreign key constraint/i.test(message)) return null;
  if (/category_id/i.test(message)) {
    return 'Selected category is invalid or was deleted. Refresh the page and choose again.';
  }
  if (/vendor_id/i.test(message)) {
    return 'Selected vendor is invalid or was deleted. Refresh the page and choose again.';
  }
  if (/assigned_employee_id|user_id/i.test(message)) {
    return 'Selected employee is invalid or was deleted. Refresh the page and choose again.';
  }
  if (/request_id/i.test(message)) {
    return 'Linked request is invalid or was deleted. Refresh the page and choose again.';
  }
  return 'A linked record is missing or invalid. Refresh the page and try again.';
}

function formatNotNullError(message: string): string | null {
  if (!/null value in column/i.test(message)) return null;
  const match = message.match(/null value in column "([^"]+)"/i);
  const column = match?.[1];
  if (column === 'asset_tag') return 'Asset tag is required.';
  if (column === 'name') return 'Asset name is required.';
  if (column === 'status') return 'Asset status is required.';
  return 'A required field is missing. Check the form and try again.';
}

function formatMissingColumnError(message: string): string | null {
  const match = message.match(/Could not find the '([^']+)' column of '([^']+)'/i);
  if (!match) return null;

  const [, column, table] = match;
  const key = `${table}.${column}`;
  return (
    MISSING_COLUMN_HINTS[key] ??
    (table === 'assets'
      ? `Missing assets.${column} column. Apply migration ${ASSETS_SCHEMA_MIGRATION} in Supabase SQL Editor.`
      : `Missing ${table}.${column} column. Apply the matching Supabase migration in SQL Editor.`)
  );
}

export function formatAuditTriggerDbError(message: string): string {
  const missingColumn = formatMissingColumnError(message);
  if (missingColumn) return missingColumn;

  const duplicateKey = formatDuplicateKeyError(message);
  if (duplicateKey) return duplicateKey;

  const foreignKey = formatForeignKeyError(message);
  if (foreignKey) return foreignKey;

  const notNull = formatNotNullError(message);
  if (notNull) return notNull;

  if (AUDIT_DETAILS_PATTERN.test(message)) {
    return (
      'Database audit trigger is outdated. Go to Settings → Fix Audit Log Trigger, ' +
      'or apply migration 009_audit_logs_old_new_data.sql in Supabase SQL Editor.'
    );
  }
  if (AUDIT_RECORD_ID_UUID_PATTERN.test(message)) {
    return (
      'Database audit trigger is outdated. Go to Settings → Copy Trigger SQL, ' +
      'or apply migration 010_audit_logs_record_id_uuid.sql in Supabase SQL Editor.'
    );
  }
  return message;
}

/** Preferred entry point for server actions — maps DB errors to short UI copy. */
export function formatUserFacingDbError(message: string): string {
  return formatAuditTriggerDbError(message.trim());
}

/**
 * Last-line defense for ErrorAlert — never render markdown reports or long debug dumps.
 */
export function sanitizeErrorMessageForUi(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return 'Something went wrong. Please try again.';

  if (trimmed.length > 300 || REPORT_LIKE_PATTERN.test(trimmed)) {
    const mapped = formatUserFacingDbError(trimmed.split('\n')[0] ?? trimmed);
    if (mapped !== (trimmed.split('\n')[0] ?? trimmed)) return mapped;
    return 'Something went wrong. Please try again or contact your administrator.';
  }

  return formatUserFacingDbError(trimmed);
}

export function isStaleAuditTriggerError(message: string): boolean {
  return AUDIT_DETAILS_PATTERN.test(message) || AUDIT_RECORD_ID_UUID_PATTERN.test(message);
}
