'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { insertAssetRequestRow, updateAssetRequestRow } from '@/lib/supabase/asset-request-insert';
import type { AssetRequestInsert, AssetRequestUpdate } from '@/lib/supabase/requests';
import { revalidatePath } from 'next/cache';
import type { Asset } from '@/lib/supabase/assets';
import { getSessionUser } from '@/lib/auth/session';
import { DEFAULT_REQUEST_STATUS, REQUEST_STATUS } from '@/lib/constants/request-status';
import { canRegisterAssetForRequest } from '@/lib/brd/request-workflow';
import { ensureAssetQrMetadata } from '@/lib/assets/ensure-asset-qr';
import { resolveSerialNumber } from '@/lib/assets/qr-code';
import { formatAuditTriggerDbError } from '@/lib/supabase/audit-db-errors';

function mapDbError(message: string) {
  return formatAuditTriggerDbError(message);
}

export type FormOptions = {
  categories: { id: string; name: string }[];
  vendors: { id: string; name: string }[];
  users: { id: string; first_name: string; last_name: string; department: string | null }[];
  assets: { id: string; name: string; asset_tag: string }[];
};

function revalidateCore() {
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/assets');
  revalidatePath('/dashboard/reports');
  revalidatePath('/dashboard/audit-logs');
}

export async function getFormOptionsAction(): Promise<{ data?: FormOptions; error?: string }> {
  try {
    const [cats, vends, users, assets] = await Promise.all([
      supabaseAdmin.from('asset_categories').select('id, name').order('name'),
      supabaseAdmin.from('vendors').select('id, name').order('name'),
      supabaseAdmin.from('users').select('id, first_name, last_name, department').order('first_name'),
      supabaseAdmin.from('assets').select('id, name, asset_tag').order('asset_tag'),
    ]);

    return {
      data: {
        categories: cats.error ? [] : (cats.data ?? []),
        vendors: vends.error ? [] : (vends.data ?? []),
        users: users.error ? [] : (users.data ?? []),
        assets: assets.error ? [] : (assets.data ?? []).filter((a) => a.id),
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to load form options' };
  }
}

export async function getMaintenanceLookupsAction(): Promise<{
  data?: { assets: FormOptions['assets']; vendors: FormOptions['vendors'] };
  warnings?: string[];
  error?: string;
}> {
  try {
    const { fetchMaintenanceLookups } = await import('@/lib/supabase/maintenance-db');
    const result = await fetchMaintenanceLookups();
    if (result.error) return { error: result.error, warnings: result.warnings };
    return {
      data: { assets: result.assets, vendors: result.vendors },
      warnings: result.warnings.length ? result.warnings : undefined,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to load maintenance lookups' };
  }
}

export type CreateAssetInput = Omit<Asset, 'id' | 'created_at' | 'updated_at'>;

export async function createAssetAction(input: CreateAssetInput) {
  try {
    if (input.request_id) {
      const { data: linkedRequest, error: reqErr } = await supabaseAdmin
        .from('asset_requests')
        .select('status')
        .eq('id', input.request_id)
        .single();
      if (reqErr || !linkedRequest) {
        return { error: 'Linked asset request was not found.' };
      }
      if (!canRegisterAssetForRequest(linkedRequest.status)) {
        return {
          error:
            'Assets can only be registered after finance approval and purchase workflow (Approved, Purchasing, or Received).',
        };
      }
    }

    const assigned = input.assigned_employee_id;
    const status = assigned && input.status === 'Available' ? 'Allocated' : input.status;
    const serial_number = resolveSerialNumber({
      asset_tag: input.asset_tag,
      serial_number: input.serial_number,
    });
    const { data, error } = await supabaseAdmin
      .from('assets')
      .insert([{ ...input, status, serial_number }])
      .select()
      .single();
    if (error) return { error: mapDbError(error.message) };

    if (data?.id) {
      try {
        const qrMeta = await ensureAssetQrMetadata({
          id: data.id,
          name: data.name,
          asset_tag: data.asset_tag,
          serial_number: data.serial_number,
        });
        data.serial_number = qrMeta.serial_number;
        data.qr_payload = qrMeta.qr_payload;
        data.qr_generated_at = qrMeta.qr_generated_at;
      } catch (qrErr) {
        return {
          error: qrErr instanceof Error ? qrErr.message : 'Asset created but QR metadata failed',
        };
      }
    }

    if (assigned && data?.id) {
      await supabaseAdmin.from('asset_allocations').insert([
        {
          asset_id: data.id,
          user_id: assigned,
          notes: `Allocated during registration (${data.asset_tag})`,
          status: 'Active',
          allocated_at: new Date().toISOString(),
        },
      ]);
    }
    revalidateCore();
    return { data: data as Asset };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create asset' };
  }
}

export async function updateAssetAction(
  assetTag: string,
  input: Partial<CreateAssetInput>
) {
  try {
    const { data: existing } = await supabaseAdmin
      .from('assets')
      .select('id, assigned_employee_id, name, asset_tag, serial_number')
      .eq('asset_tag', assetTag)
      .single();

    const updates = { ...input };
    if (input.serial_number !== undefined) {
      updates.serial_number = resolveSerialNumber({
        asset_tag: assetTag,
        serial_number: input.serial_number,
      });
    }

    const { error } = await supabaseAdmin.from('assets').update(updates).eq('asset_tag', assetTag);
    if (error) return { error: mapDbError(error.message) };

    if (existing?.id) {
      const shouldRefreshQr =
        input.name !== undefined || input.serial_number !== undefined;

      if (shouldRefreshQr) {
        const { data: refreshed } = await supabaseAdmin
          .from('assets')
          .select('id, name, asset_tag, serial_number')
          .eq('id', existing.id)
          .single();

        if (refreshed) {
          try {
            await ensureAssetQrMetadata(refreshed);
          } catch (qrErr) {
            return {
              error: qrErr instanceof Error ? qrErr.message : 'Asset updated but QR refresh failed',
            };
          }
        }
      }
    }
    if (input.assigned_employee_id && existing?.id && input.assigned_employee_id !== existing.assigned_employee_id) {
      await supabaseAdmin.from('asset_allocations').insert([
        {
          asset_id: existing.id,
          user_id: input.assigned_employee_id,
          notes: `Reassigned via asset edit (${assetTag})`,
          status: 'Active',
          allocated_at: new Date().toISOString(),
        },
      ]);
    }
    revalidateCore();
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update asset' };
  }
}

export async function deleteAssetAction(assetTag: string) {
  try {
    const { error } = await supabaseAdmin.from('assets').delete().eq('asset_tag', assetTag);
    if (error) return { error: mapDbError(error.message) };
    revalidateCore();
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete asset' };
  }
}

export async function createCategoryAction(name: string) {
  try {
    const { error } = await supabaseAdmin.from('asset_categories').insert([{ name: name.trim() }]);
    if (error) return { error: mapDbError(error.message) };
    revalidatePath('/dashboard/categories');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create category' };
  }
}

export async function updateCategoryAction(id: string, name: string) {
  try {
    const { error } = await supabaseAdmin.from('asset_categories').update({ name: name.trim() }).eq('id', id);
    if (error) return { error: mapDbError(error.message) };
    revalidatePath('/dashboard/categories');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update category' };
  }
}

export async function deleteCategoryAction(id: string) {
  try {
    const { error } = await supabaseAdmin.from('asset_categories').delete().eq('id', id);
    if (error) return { error: mapDbError(error.message) };
    revalidatePath('/dashboard/categories');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete category' };
  }
}

export async function createVendorAction(vendor: {
  name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}) {
  try {
    const { insertVendorRow } = await import('@/lib/supabase/vendor-db');
    const { error } = await insertVendorRow(vendor);
    if (error) return { error: mapDbError(error.message) };
    revalidatePath('/dashboard/vendors');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create vendor' };
  }
}

export async function updateVendorAction(
  id: string,
  vendor: {
    name?: string;
    contact_person?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  }
) {
  try {
    const { updateVendorRow } = await import('@/lib/supabase/vendor-db');
    const { error } = await updateVendorRow(id, vendor);
    if (error) return { error: mapDbError(error.message) };
    revalidatePath('/dashboard/vendors');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update vendor' };
  }
}

export async function deleteVendorAction(id: string) {
  try {
    const { error } = await supabaseAdmin.from('vendors').delete().eq('id', id);
    if (error) return { error: mapDbError(error.message) };
    revalidatePath('/dashboard/vendors');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete vendor' };
  }
}

export async function createRequestAction(request: AssetRequestInsert) {
  try {
    if (!request.justification?.trim()) {
      return { error: 'Justification is required.' };
    }

    const { profile } = await getSessionUser();
    const requesterId = profile?.id ?? null;

    if (!requesterId) {
      return { error: 'Unable to resolve a valid requester. Seed or create a user record first.' };
    }

    const { data, error } = await insertAssetRequestRow({
      justification: request.justification,
      status: request.status ?? DEFAULT_REQUEST_STATUS,
      priority: request.priority ?? 'Medium',
      requester_id: requesterId,
      category_id: request.category_id ?? null,
    });

    if (error) return { error: mapDbError(error.message) };

    if (data?.id) {
      const { bootstrapRequestWorkflow } = await import('@/app/actions/brd/approvals');
      const boot = await bootstrapRequestWorkflow(data.id);
      if (boot.error) return { error: boot.error };
    }

    revalidatePath('/dashboard/requests');
    revalidatePath('/dashboard/approvals');
    revalidatePath('/dashboard');
    return { success: true, id: data?.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create request' };
  }
}

export async function updateRequestAction(id: string, updates: AssetRequestUpdate) {
  try {
    if (updates.status !== undefined) {
      const { profile } = await getSessionUser();
      if (profile?.role !== 'Admin') {
        return {
          error:
            'Request status is managed by the approval workflow. Approve or reject via the Approvals module.',
        };
      }
    }

    const { error } = await updateAssetRequestRow(id, updates);
    if (error) return { error: mapDbError(error.message) };
    revalidatePath('/dashboard/requests');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update request' };
  }
}

export async function deleteRequestAction(id: string) {
  try {
    const { error } = await supabaseAdmin.from('asset_requests').delete().eq('id', id);
    if (error) return { error: mapDbError(error.message) };
    revalidatePath('/dashboard/requests');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete request' };
  }
}

export async function createMaintenanceAction(record: {
  asset_id: string;
  type: string;
  description: string;
  cost?: number | null;
  vendor_id?: string | null;
  scheduled_date?: string | null;
  completed_date?: string | null;
  performed_by?: string | null;
  notes?: string | null;
}) {
  try {
    const { insertMaintenanceRecord } = await import('@/lib/supabase/maintenance-db');
    const { data, error } = await insertMaintenanceRecord(record);
    if (error) return { error: mapDbError(error.message) };
    revalidatePath('/dashboard/maintenance');
    revalidatePath('/dashboard');
    return { success: true, id: data?.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create maintenance record' };
  }
}

export async function updateMaintenanceAction(
  id: string,
  record: Partial<{
    asset_id: string;
    type: string;
    description: string;
    cost: number | null;
    vendor_id: string | null;
    scheduled_date: string | null;
    completed_date: string | null;
    performed_by: string | null;
    notes: string | null;
  }>
) {
  try {
    const { updateMaintenanceRecordRow } = await import('@/lib/supabase/maintenance-db');
    const { error } = await updateMaintenanceRecordRow(id, record);
    if (error) return { error: mapDbError(error.message) };
    revalidatePath('/dashboard/maintenance');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update maintenance record' };
  }
}

export async function deleteMaintenanceAction(id: string) {
  try {
    const { error } = await supabaseAdmin.from('maintenance_records').delete().eq('id', id);
    if (error) return { error: mapDbError(error.message) };
    revalidatePath('/dashboard/maintenance');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete maintenance record' };
  }
}
