export type DeleteBlockingInfo = {
  tableLabel: string;
  explanation: string;
  referencedRows?: number;
};

export type DeleteBlockedResponse = {
  blocked: true;
  blocking: DeleteBlockingInfo;
};

export type DeleteActionResponse =
  | { success: boolean }
  | DeleteBlockedResponse
  | { error: string };

/** @deprecated Use DeleteBlockingInfo */
export type UserDeleteBlockingFk = DeleteBlockingInfo & {
  tableName?: string;
  columnName?: string;
  constraintName?: string;
};

const TABLE_LABELS: Record<string, string> = {
  maintenance_records: 'Maintenance Records',
  asset_allocations: 'Allocations',
  asset_requests: 'Requests',
  asset_categories: 'Categories',
  assets: 'Assets',
  asset_disposals: 'Disposals',
  inventory: 'Inventory',
  procurements: 'Procurement',
  purchase_orders: 'Purchase Orders',
  vendors: 'Vendors',
  users: 'Users',
  request_approvals: 'Approvals',
  notifications: 'Notifications',
  audit_logs: 'Audit Trail',
};

const BLOCKING_EXPLANATIONS: Record<string, string> = {
  'maintenance_records.asset_id':
    'This asset is referenced by maintenance records. Remove or reassign those records before deleting the asset.',
  'asset_allocations.asset_id':
    'This asset has allocation records. Return or remove those allocations before deleting the asset.',
  'asset_disposals.asset_id':
    'This asset has disposal records. Resolve those records before deleting the asset.',
  'asset_requests.category_id':
    'This category is referenced by asset requests. Reassign or close those requests first.',
  'assets.category_id':
    'This category is assigned to assets. Reassign those assets before deleting the category.',
  'inventory.category_id':
    'This category is used by inventory items. Reassign those items before deleting the category.',
  'asset_requests.requester_id':
    'This user is referenced by asset requests. Reassign those requests before deleting the user.',
  'assets.vendor_id':
    'This vendor is linked to assets. Reassign those assets before deleting the vendor.',
  'maintenance_records.vendor_id':
    'This vendor is linked to maintenance records. Update those records before deleting the vendor.',
  'procurements.vendor_id':
    'This vendor is linked to procurement cases. Close or reassign those cases first.',
};

function humanizeTableName(tableName: string): string {
  return TABLE_LABELS[tableName] ?? tableName.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function resolveDeleteBlockingInfo(
  tableName: string,
  columnName: string,
  referencedRows?: number
): DeleteBlockingInfo {
  const key = `${tableName}.${columnName}`;
  const explanation =
    BLOCKING_EXPLANATIONS[key] ??
    `This record is still linked to ${humanizeTableName(tableName).toLowerCase()}. Remove those references before deleting.`;

  return {
    tableLabel: humanizeTableName(tableName),
    explanation,
    referencedRows,
  };
}

export function logDeleteBlocked(context: string, blocking: DeleteBlockingInfo, meta?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'development') {
    console.warn(`[DELETE] Blocked by business rule (${context})`, { blocking, ...meta });
  }
}

export function isDeleteBlocked(result: DeleteActionResponse): result is DeleteBlockedResponse {
  return 'blocked' in result && result.blocked === true && 'blocking' in result && Boolean(result.blocking);
}

function inferColumnFromConstraint(constraintName: string, tableName: string): string {
  const prefix = `${tableName}_`;
  const suffix = '_fkey';
  if (constraintName.startsWith(prefix) && constraintName.endsWith(suffix)) {
    return constraintName.slice(prefix.length, -suffix.length);
  }
  return 'id';
}

function parseReferencedRows(message: string): number | undefined {
  const match = message.match(/has (\d+) referencing row/i) ?? message.match(/has (\d+) row/i);
  return match ? Number(match[1]) : undefined;
}

function parseRawFkFromMessage(message: string): { tableName: string; columnName: string } | null {
  const explicitPatterns = [
    /Blocking FK (?:[\w]+\.)?([\w]+)\.([\w]+)/i,
    /because (?:[\w]+\.)?([\w]+)\.([\w]+)/i,
    /Remaining user FK reference(?: after cleanup)?: (?:[\w]+\.)?([\w]+)\.([\w]+)/i,
  ] as const;

  for (const pattern of explicitPatterns) {
    const match = message.match(pattern);
    if (match) {
      return { tableName: match[1], columnName: match[2] };
    }
  }

  const postgresMatch = message.match(/violates foreign key constraint "([^"]+)" on table "([^"]+)"/i);
  if (postgresMatch) {
    return {
      tableName: postgresMatch[2],
      columnName: inferColumnFromConstraint(postgresMatch[1], postgresMatch[2]),
    };
  }

  return null;
}

export function blockingFromSupabaseError(error: {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
}): DeleteBlockingInfo | null {
  if (error.code !== '23503') return null;

  const candidates = [error.message, error.details, error.hint].filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  );

  for (const candidate of candidates) {
    const raw = parseRawFkFromMessage(candidate);
    if (raw) {
      return resolveDeleteBlockingInfo(raw.tableName, raw.columnName, parseReferencedRows(candidate));
    }
  }

  return null;
}

export function toBlockedDeleteResponse(
  blocking: DeleteBlockingInfo,
  context: string,
  meta?: Record<string, unknown>
): DeleteBlockedResponse {
  logDeleteBlocked(context, blocking, meta);
  return { blocked: true, blocking };
}

export function handleDeleteDbError(
  error: { message?: string | null; details?: string | null; hint?: string | null; code?: string | null },
  context: string,
  meta?: Record<string, unknown>
): DeleteBlockedResponse | { error: string } {
  const blocking = blockingFromSupabaseError(error);
  if (blocking) {
    return toBlockedDeleteResponse(blocking, context, meta);
  }
  return { error: error.message ?? 'Delete failed.' };
}
