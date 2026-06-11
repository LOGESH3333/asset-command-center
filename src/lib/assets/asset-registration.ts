import 'server-only';

import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Asset } from '@/lib/supabase/assets';

export type AssetCreateInput = Omit<Asset, 'id' | 'created_at' | 'updated_at'>;
import { canRegisterAssetForRequest } from '@/lib/brd/request-workflow';
import { resolveSerialNumber } from './qr-code';

export function normalizeAssetTag(tag: string): string {
  return tag.trim().toUpperCase();
}

export function nameFromRequestJustification(justification: string | null | undefined): string {
  const text = (justification ?? '').trim();
  if (!text) return '';
  const firstLine = text.split('\n')[0]?.trim() ?? text;
  return firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine;
}

export async function isAssetTagTaken(assetTag: string): Promise<boolean> {
  const normalized = normalizeAssetTag(assetTag);
  if (!normalized) return false;

  const { data, error } = await supabaseAdmin
    .from('assets')
    .select('asset_tag')
    .eq('asset_tag', normalized)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

/** Next available AST-#### tag (seed-compatible). */
export async function suggestNextAssetTag(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('assets')
    .select('asset_tag')
    .ilike('asset_tag', 'AST-%')
    .order('asset_tag', { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);

  let maxNum = 1000;
  for (const row of data ?? []) {
    const match = String(row.asset_tag ?? '').match(/^AST-(\d+)$/i);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }

  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = `AST-${String(maxNum + 1 + attempt).padStart(4, '0')}`;
    if (!(await isAssetTagTaken(candidate))) return candidate;
  }

  return `AST-${Date.now().toString(36).toUpperCase()}`;
}

export async function findAssetByTag(assetTag: string) {
  const normalized = normalizeAssetTag(assetTag);
  const { data, error } = await supabaseAdmin
    .from('assets')
    .select('*')
    .eq('asset_tag', normalized)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Asset | null;
}

export async function findAssetByRequestId(requestId: string) {
  const { data, error } = await supabaseAdmin
    .from('assets')
    .select('*')
    .eq('request_id', requestId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Asset | null;
}

export type PreparedAssetInput = AssetCreateInput & {
  asset_tag: string;
  status: AssetCreateInput['status'];
  serial_number: string;
  assigned_employee_id: string | null;
};

export function sanitizeAssetInput(input: AssetCreateInput): AssetCreateInput {
  const emptyToNull = (value: string | null | undefined) => {
    const trimmed = (value ?? '').trim();
    return trimmed ? trimmed : null;
  };

  return {
    ...input,
    asset_tag: normalizeAssetTag(input.asset_tag),
    name: input.name.trim(),
    serial_number: emptyToNull(input.serial_number ?? null),
    notes: emptyToNull(input.notes ?? null),
    category_id: input.category_id || null,
    vendor_id: input.vendor_id || null,
    request_id: input.request_id || null,
    assigned_employee_id: input.assigned_employee_id || null,
    purchase_date: emptyToNull(input.purchase_date ?? null),
    warranty_expiry: emptyToNull(input.warranty_expiry ?? null),
  };
}

export async function validateAssetCreateInput(
  input: AssetCreateInput
): Promise<string | null> {
  if (!input.asset_tag) return 'Asset tag is required.';
  if (!input.name) return 'Asset name is required.';

  if (input.cost != null && (Number.isNaN(input.cost) || input.cost < 0)) {
    return 'Acquisition cost must be a positive number.';
  }

  if (input.status === 'Allocated' && !input.assigned_employee_id && !input.request_id) {
    return 'Select an employee or linked request before marking an asset as Allocated.';
  }

  if (input.request_id) {
    const { data: linkedRequest, error: reqErr } = await supabaseAdmin
      .from('asset_requests')
      .select('status')
      .eq('id', input.request_id)
      .maybeSingle();

    if (reqErr) return reqErr.message;
    if (!linkedRequest) return 'Linked asset request was not found.';
    if (!canRegisterAssetForRequest(linkedRequest.status)) {
      return 'Assets can only be registered after finance approval and purchase workflow (Approved, Purchasing, or Received).';
    }
  }

  if (input.category_id) {
    const { data } = await supabaseAdmin
      .from('asset_categories')
      .select('id')
      .eq('id', input.category_id)
      .maybeSingle();
    if (!data) return 'Selected category no longer exists. Refresh the page and try again.';
  }

  if (input.vendor_id) {
    const { data } = await supabaseAdmin
      .from('vendors')
      .select('id')
      .eq('id', input.vendor_id)
      .maybeSingle();
    if (!data) return 'Selected vendor no longer exists. Refresh the page and try again.';
  }

  if (input.assigned_employee_id) {
    const { data } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', input.assigned_employee_id)
      .maybeSingle();
    if (!data) return 'Selected employee no longer exists. Refresh the page and try again.';
  }

  return null;
}

export async function prepareAssetCreatePayload(
  input: AssetCreateInput
): Promise<PreparedAssetInput> {
  const sanitized = sanitizeAssetInput(input);

  let assigned = sanitized.assigned_employee_id;
  if (sanitized.request_id && !assigned) {
    const { data: linkedRequester } = await supabaseAdmin
      .from('asset_requests')
      .select('requester_id')
      .eq('id', sanitized.request_id)
      .maybeSingle();
    assigned = linkedRequester?.requester_id ?? null;
  }

  const status =
    assigned && sanitized.status === 'Available' ? 'Allocated' : sanitized.status;

  const serial_number = resolveSerialNumber({
    asset_tag: sanitized.asset_tag,
    serial_number: sanitized.serial_number,
  });

  return {
    ...sanitized,
    assigned_employee_id: assigned,
    status,
    serial_number,
  };
}

export async function resolveAssignedEmployeeId(
  requestId: string | null,
  assignedEmployeeId: string | null
): Promise<string | null> {
  if (assignedEmployeeId) return assignedEmployeeId;
  if (!requestId) return null;

  const { data } = await supabaseAdmin
    .from('asset_requests')
    .select('requester_id')
    .eq('id', requestId)
    .maybeSingle();

  return data?.requester_id ?? null;
}
