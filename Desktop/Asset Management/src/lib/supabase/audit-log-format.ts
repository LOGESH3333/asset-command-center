import type { AuditLog } from './audit-logs';

const LABEL_KEYS = [
  'name',
  'title',
  'sku',
  'asset_tag',
  'email',
  'justification',
  'po_number',
  'reason',
] as const;

const SKIP_DETAIL_KEYS = new Set(['id', 'created_at', 'updated_at']);

const TABLE_LABELS: Record<string, string> = {
  assets: 'asset',
  asset_requests: 'request',
  asset_allocations: 'allocation',
  maintenance_records: 'maintenance record',
  inventory: 'inventory item',
  procurements: 'procurement',
  purchase_orders: 'purchase order',
  request_approvals: 'approval',
  asset_disposals: 'disposal',
  users: 'user',
  vendors: 'vendor',
  asset_categories: 'category',
};

function humanizeKey(key: string): string {
  return key
    .replace(/_id$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeTableName(table: string): string {
  return TABLE_LABELS[table] ?? table.replace(/_/g, ' ');
}

/** Prefer new_data on create/update, old_data on delete. */
export function getAuditRecordData(
  log: Pick<AuditLog, 'action' | 'old_data' | 'new_data'>
): Record<string, unknown> | null {
  if (log.action === 'DELETE') return log.old_data;
  return log.new_data ?? log.old_data;
}

export function formatAuditLogSummary(
  log: Pick<AuditLog, 'action' | 'table_name' | 'record_id' | 'old_data' | 'new_data'>
): string {
  const data = getAuditRecordData(log);
  if (data) {
    for (const key of LABEL_KEYS) {
      const val = data[key];
      if (typeof val === 'string' && val.trim()) {
        const text = val.trim();
        return key === 'justification' && text.length > 80 ? `${text.slice(0, 80)}…` : text;
      }
    }
    const first = data.first_name;
    const last = data.last_name;
    if (typeof first === 'string' || typeof last === 'string') {
      return `${first ?? ''} ${last ?? ''}`.trim();
    }
  }

  const verb =
    log.action === 'INSERT'
      ? 'Created'
      : log.action === 'UPDATE'
        ? 'Updated'
        : log.action === 'DELETE'
          ? 'Deleted'
          : log.action;
  return `${verb} ${humanizeTableName(log.table_name)}`;
}

export function formatAuditLogDetail(
  log: Pick<AuditLog, 'action' | 'old_data' | 'new_data'>
): string | null {
  const data = getAuditRecordData(log);
  if (!data) return null;

  const parts: string[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (SKIP_DETAIL_KEYS.has(key) || key.endsWith('_id')) continue;
    if (val === null || val === undefined || val === '') continue;
    if (typeof val === 'object') continue;
    const str = String(val);
    if (str.length > 120) continue;
    parts.push(`${humanizeKey(key)}: ${str}`);
  }

  if (parts.length === 0) return null;
  const text = parts.slice(0, 4).join(' · ');
  return text.length > 200 ? `${text.slice(0, 200)}…` : text;
}

/** Dashboard link for an audited row (uses business keys when available). */
export function getAuditRecordHref(
  log: Pick<AuditLog, 'table_name' | 'record_id' | 'old_data' | 'new_data' | 'action'>
): string | null {
  const id = log.record_id;
  if (!id) return null;

  const data = getAuditRecordData(log);

  switch (log.table_name) {
    case 'assets': {
      const tag = typeof data?.asset_tag === 'string' ? data.asset_tag : null;
      return tag ? `/dashboard/assets/${tag}` : null;
    }
    case 'asset_requests':
      return `/dashboard/requests/${id}`;
    case 'asset_allocations':
      return `/dashboard/allocations/${id}`;
    case 'maintenance_records':
      return `/dashboard/maintenance/${id}`;
    case 'inventory':
      return `/dashboard/inventory/${id}`;
    case 'procurements':
      return `/dashboard/procurement/${id}`;
    case 'purchase_orders':
      return `/dashboard/purchase-orders/${id}`;
    case 'request_approvals':
      return `/dashboard/approvals/${id}`;
    case 'asset_disposals':
      return `/dashboard/disposals/${id}`;
    case 'vendors':
      return `/dashboard/vendors/${id}`;
    case 'asset_categories':
      return `/dashboard/categories/${id}`;
    case 'users':
      return `/dashboard/users/${id}`;
    default:
      return '/dashboard/audit-logs';
  }
}
