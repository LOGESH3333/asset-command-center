import { supabaseAdmin } from './admin';
import { randomUUID } from 'crypto';

export type MaintenanceAssetOption = { id: string; name: string; asset_tag: string };
export type MaintenanceVendorOption = { id: string; name: string };

export type MaintenanceRecordInsert = {
  asset_id: string;
  type: string;
  description: string;
  cost?: number | null;
  vendor_id?: string | null;
  scheduled_date?: string | null;
  completed_date?: string | null;
  performed_by?: string | null;
  notes?: string | null;
};

/** Ensure every asset row has a UUID id (required by maintenance_records FK). */
async function ensureAssetIds(): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from('assets').select('id, asset_tag');
  if (error) {
    if (error.message.toLowerCase().includes('column') && error.message.toLowerCase().includes('id')) {
      return 'assets.id column missing — run schema repair in Settings or apply migration 001_asset_id.sql';
    }
    return error.message;
  }

  const missing = (data ?? []).filter((row) => !row.id);
  for (const row of missing) {
    const { error: updateError } = await supabaseAdmin
      .from('assets')
      .update({ id: randomUUID() })
      .eq('asset_tag', row.asset_tag);
    if (updateError) return updateError.message;
  }
  return null;
}

export async function fetchMaintenanceLookups(): Promise<{
  assets: MaintenanceAssetOption[];
  vendors: MaintenanceVendorOption[];
  warnings: string[];
  error?: string;
}> {
  const warnings: string[] = [];

  const idError = await ensureAssetIds();
  if (idError) warnings.push(idError);

  const [assetsRes, vendorsRes] = await Promise.all([
    supabaseAdmin.from('assets').select('id, name, asset_tag').order('asset_tag'),
    supabaseAdmin.from('vendors').select('id, name').order('name'),
  ]);

  if (assetsRes.error) warnings.push(`Assets: ${assetsRes.error.message}`);
  if (vendorsRes.error) warnings.push(`Vendors: ${vendorsRes.error.message}`);

  if (assetsRes.error && vendorsRes.error) {
    return {
      assets: [],
      vendors: [],
      warnings,
      error: `${assetsRes.error.message}; ${vendorsRes.error.message}`,
    };
  }

  const assets = (assetsRes.data ?? []).filter(
    (a): a is MaintenanceAssetOption => Boolean(a.id && a.name && a.asset_tag)
  );
  const vendors = (vendorsRes.data ?? []).filter(
    (v): v is MaintenanceVendorOption => Boolean(v.id && v.name)
  );

  return { assets, vendors, warnings };
}

export function validateMaintenanceRecord(record: MaintenanceRecordInsert): string | null {
  if (!record.asset_id?.trim()) return 'Please select an asset.';
  if (!record.type?.trim()) return 'Maintenance type is required.';
  if (!['Preventive', 'Corrective'].includes(record.type)) return 'Invalid maintenance type.';
  if (!record.description?.trim()) return 'Description is required.';
  if (record.cost != null && (Number.isNaN(record.cost) || record.cost < 0)) {
    return 'Cost must be a positive number.';
  }
  return null;
}

export function buildMaintenancePayload(record: MaintenanceRecordInsert) {
  return {
    asset_id: record.asset_id.trim(),
    type: record.type === 'Corrective' ? 'Corrective' : 'Preventive',
    description: record.description.trim(),
    cost: record.cost ?? null,
    vendor_id: record.vendor_id?.trim() || null,
    scheduled_date: record.scheduled_date || null,
    completed_date: record.completed_date || null,
    performed_by: record.performed_by?.trim() || null,
    notes: record.notes?.trim() || null,
  };
}

export async function insertMaintenanceRecord(record: MaintenanceRecordInsert) {
  const validationError = validateMaintenanceRecord(record);
  if (validationError) return { error: { message: validationError } };

  const payload = buildMaintenancePayload(record);
  const { data, error } = await supabaseAdmin
    .from('maintenance_records')
    .insert([payload])
    .select('id')
    .single();

  return { data, error: error ? { message: error.message } : null };
}

export async function updateMaintenanceRecordRow(
  id: string,
  record: Partial<MaintenanceRecordInsert>
) {
  const updates: Record<string, unknown> = {};
  if (record.asset_id !== undefined) updates.asset_id = record.asset_id.trim();
  if (record.type !== undefined) {
    updates.type = record.type === 'Corrective' ? 'Corrective' : 'Preventive';
  }
  if (record.description !== undefined) updates.description = record.description.trim();
  if (record.cost !== undefined) updates.cost = record.cost;
  if (record.vendor_id !== undefined) updates.vendor_id = record.vendor_id?.trim() || null;
  if (record.scheduled_date !== undefined) updates.scheduled_date = record.scheduled_date || null;
  if (record.completed_date !== undefined) updates.completed_date = record.completed_date || null;
  if (record.performed_by !== undefined) updates.performed_by = record.performed_by?.trim() || null;
  if (record.notes !== undefined) updates.notes = record.notes?.trim() || null;

  const { data, error } = await supabaseAdmin
    .from('maintenance_records')
    .update(updates)
    .eq('id', id)
    .select('id')
    .single();

  return { data, error: error ? { message: error.message } : null };
}
