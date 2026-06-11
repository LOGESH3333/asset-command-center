import { supabaseAdmin } from './admin';
import { DEFAULT_REQUEST_STATUS } from '@/lib/constants/request-status';
import type { AssetRequestInsert, AssetRequestUpdate } from './requests';

function buildInsertPayload(row: AssetRequestInsert): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    justification: row.justification.trim(),
    status: row.status ?? DEFAULT_REQUEST_STATUS,
    priority: row.priority ?? 'Medium',
    requester_id: row.requester_id ?? null,
    category_id: row.category_id ?? null,
  };
  if (row.created_at) payload.created_at = row.created_at;
  return payload;
}

export async function insertAssetRequestRow(row: AssetRequestInsert) {
  const payload = buildInsertPayload(row);
  return supabaseAdmin.from('asset_requests').insert([payload]).select().single();
}

export async function insertAssetRequestRows(rows: AssetRequestInsert[]) {
  const payload = rows.map((row) => buildInsertPayload(row));
  return supabaseAdmin.from('asset_requests').insert(payload).select();
}

export async function updateAssetRequestRow(id: string, updates: AssetRequestUpdate) {
  const payload: Record<string, unknown> = { ...updates };
  if (typeof updates.justification === 'string') {
    payload.justification = updates.justification.trim();
  }

  return supabaseAdmin.from('asset_requests').update(payload).eq('id', id).select().single();
}
