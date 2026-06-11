import 'server-only';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { mutateWithSchemaFallback } from '@/lib/supabase/schema-utils';

/** Columns written by createAssetAction / updateAssetAction (excluding id, timestamps). */
export const ASSET_MUTABLE_COLUMNS = [
  'asset_tag',
  'name',
  'category_id',
  'vendor_id',
  'cost',
  'purchase_date',
  'warranty_expiry',
  'status',
  'assigned_employee_id',
  'request_id',
  'serial_number',
  'notes',
  'qr_payload',
  'qr_generated_at',
] as const;

const ASSET_INSERT_PROTECTED = ['asset_tag', 'name', 'status'];

export async function insertAssetRow(payload: Record<string, unknown>) {
  return mutateWithSchemaFallback<Record<string, unknown>>(
    async (body) => {
      const result = await supabaseAdmin.from('assets').insert([body]).select().single();
      return {
        data: (result.data as Record<string, unknown> | null) ?? null,
        error: result.error ? { message: result.error.message } : null,
      };
    },
    payload,
    [...ASSET_INSERT_PROTECTED]
  );
}

export async function updateAssetRow(
  matchColumn: 'id' | 'asset_tag',
  matchValue: string,
  payload: Record<string, unknown>
) {
  return mutateWithSchemaFallback<null>(
    async (body) => {
      if (Object.keys(body).length === 0) {
        return { data: null, error: null };
      }
      const result = await supabaseAdmin.from('assets').update(body).eq(matchColumn, matchValue);
      return {
        data: null,
        error: result.error ? { message: result.error.message } : null,
      };
    },
    payload,
    []
  );
}
